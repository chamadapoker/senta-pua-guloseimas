# Visitantes + Cafe Privado + Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visitor registration with 30-day access, make café page a private payment flow per category, let admin manage visitor expiration, reorder sidebar.

**Architecture:** Extend `usuarios` with visitor flag, origin squadron, expiration date, and pause flag. Add a gate page that intercepts expired/paused visitors via an `acesso_bloqueado` computed field returned from `/me` and `/login`. Refactor `/cafe` to a clean payment flow that reads category-specific PIX and price from config (no more public subscriber list). Admin gets edit controls on `/admin/usuarios` for visitor-specific fields. Reorder user sidebar to put "Meu Perfil" last and add Ximboca placeholder.

**Tech Stack:** React 19, TypeScript, Hono (Cloudflare Workers), Cloudflare D1, Zustand

---

## File Structure

### New Files
- `worker/src/db/migrations/013_usuarios_visitante.sql`
- `worker/src/lib/visitante.ts` (helper for `acesso_bloqueado` computation)
- `worker/src/middleware/visitorActiveCheck.ts`
- `app/src/pages/CadastroEscolha.tsx` (tela de escolha militar/visitante)
- `app/src/pages/UserCadastroVisitante.tsx` (form de cadastro visitante)
- `app/src/pages/AcessoExpirado.tsx` (tela de acesso expirado)
- `app/src/components/perfil/MeuCafe.tsx` (card de café no perfil)

### Modified Files
- `worker/src/routes/usuarios.ts` — cadastro/visitante endpoint, me retorna acesso_bloqueado, admin visitante endpoint, me/cafe endpoint, apply visitorActiveCheck
- `worker/src/routes/pedidos.ts` — apply visitorActiveCheck to POST /
- `worker/src/routes/config.ts` (or wherever config is) — garantir que cafe_visitante_*_valor sao aceitos
- `app/src/types/index.ts` — extend Usuario type
- `app/src/hooks/useUserAuth.ts` — handle acesso_bloqueado
- `app/src/App.tsx` — rotas novas + VisitorGuard
- `app/src/components/Sidebar.tsx` — reorder user nav
- `app/src/pages/UserCadastro.tsx` — nao muda, continua sendo o cadastro de militar
- `app/src/pages/UserLogin.tsx` — apos login, respeita acesso_bloqueado
- `app/src/pages/CafePublico.tsx` — reescrever como payment flow
- `app/src/pages/Perfil.tsx` — inserir `<MeuCafe />`
- `app/src/pages/admin/Configuracoes.tsx` — adicionar 2 novos campos
- `app/src/pages/admin/Usuarios.tsx` — filtro visitantes + campos expira_em/pausado + contador dias restantes
- `app/src/services/api.ts` — interceptar 403 e redirecionar para /acesso-expirado

---

## Task 1: Database Migration

**Files:**
- Create: `worker/src/db/migrations/013_usuarios_visitante.sql`

- [ ] **Step 1: Create migration**

```sql
-- worker/src/db/migrations/013_usuarios_visitante.sql
ALTER TABLE usuarios ADD COLUMN is_visitante INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN esquadrao_origem TEXT;
ALTER TABLE usuarios ADD COLUMN expira_em TEXT;
ALTER TABLE usuarios ADD COLUMN acesso_pausado INTEGER NOT NULL DEFAULT 0;

-- Seed default visitor cafe values
INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES
  ('cafe_visitante_oficial_valor', '20.00'),
  ('cafe_visitante_graduado_valor', '20.00');
```

- [ ] **Step 2: Request user to run migration**

Ask the user to run:

```bash
cd worker && npx wrangler d1 execute senta-pua-db --remote --file=src/db/migrations/013_usuarios_visitante.sql
```

Wait for confirmation before proceeding.

- [ ] **Step 3: Commit**

```bash
git add worker/src/db/migrations/013_usuarios_visitante.sql
git commit -m "feat: migration adicionar campos visitante em usuarios"
```

---

## Task 2: Visitor Helper Library

**Files:**
- Create: `worker/src/lib/visitante.ts`

- [ ] **Step 1: Create helper**

```typescript
// worker/src/lib/visitante.ts
export interface UsuarioVisitanteStatus {
  is_visitante: number;
  expira_em: string | null;
  acesso_pausado: number;
}

export function dataHojeISO(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function calcularExpiracaoVisitante(dias = 30): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function visitanteBloqueado(u: UsuarioVisitanteStatus): boolean {
  if (u.is_visitante !== 1) return false;
  if (u.acesso_pausado === 1) return true;
  if (u.expira_em && u.expira_em < dataHojeISO()) return true;
  return false;
}

export function diasRestantes(expira_em: string | null): number | null {
  if (!expira_em) return null;
  const hoje = new Date(dataHojeISO() + 'T00:00:00Z').getTime();
  const alvo = new Date(expira_em + 'T00:00:00Z').getTime();
  return Math.ceil((alvo - hoje) / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/lib/visitante.ts
git commit -m "feat: helper de status de visitante (bloqueado, dias restantes)"
```

---

## Task 3: Visitor Active Check Middleware

**Files:**
- Create: `worker/src/middleware/visitorActiveCheck.ts`

- [ ] **Step 1: Create middleware**

```typescript
// worker/src/middleware/visitorActiveCheck.ts
import { Context, Next } from 'hono';
import { visitanteBloqueado } from '../lib/visitante';
import type { AppType } from '../index';

export async function visitorActiveCheck(c: Context<AppType>, next: Next) {
  const userId = c.get('userId');
  if (!userId) return next();

  const u = await c.env.DB.prepare(
    'SELECT is_visitante, expira_em, acesso_pausado FROM usuarios WHERE id = ?'
  ).bind(userId).first<{ is_visitante: number; expira_em: string | null; acesso_pausado: number }>();

  if (u && visitanteBloqueado(u)) {
    return c.json({ error: 'Acesso de visitante expirado ou pausado', acesso_bloqueado: true }, 403);
  }

  await next();
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/middleware/visitorActiveCheck.ts
git commit -m "feat: middleware bloqueia acoes de visitante expirado ou pausado"
```

---

## Task 4: Backend — Login and /me Return acesso_bloqueado

**Files:**
- Modify: `worker/src/routes/usuarios.ts`

- [ ] **Step 1: Update login endpoint to return new fields and acesso_bloqueado**

In `worker/src/routes/usuarios.ts`, find the `usuarios.post('/login', ...)` handler.

Replace the SELECT query and the response payload. The full new login handler:

```typescript
// Publico: login
usuarios.post('/login', async (c) => {
  const { email, senha } = await c.req.json<{ email: string; senha: string }>();

  if (!email || !senha) {
    return c.json({ error: 'Email e senha obrigatórios' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, senha_hash, trigrama, saram, whatsapp, foto_url, ativo, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado FROM usuarios WHERE email = ?'
  ).bind(email.trim().toLowerCase()).first<{
    id: number; email: string; senha_hash: string; trigrama: string; saram: string;
    whatsapp: string; foto_url: string | null; ativo: number;
    categoria: string; sala_cafe: string | null;
    is_visitante: number; esquadrao_origem: string | null; expira_em: string | null; acesso_pausado: number;
  }>();

  if (!user) return c.json({ error: 'Email ou senha incorretos' }, 401);
  if (!user.ativo) return c.json({ error: 'Conta desativada. Procure o administrador.' }, 403);

  const valid = await verifyPassword(senha, user.senha_hash);
  if (!valid) return c.json({ error: 'Email ou senha incorretos' }, 401);

  const token = await sign(
    { tipo: 'usuario', id: user.id, email: user.email, trigrama: user.trigrama },
    c.env.JWT_SECRET,
    720
  );

  const acesso_bloqueado = visitanteBloqueado({
    is_visitante: user.is_visitante,
    expira_em: user.expira_em,
    acesso_pausado: user.acesso_pausado,
  });

  return c.json({
    token,
    user: {
      id: user.id, email: user.email, trigrama: user.trigrama, saram: user.saram,
      whatsapp: user.whatsapp, foto_url: user.foto_url, categoria: user.categoria, sala_cafe: user.sala_cafe,
      is_visitante: user.is_visitante, esquadrao_origem: user.esquadrao_origem,
      expira_em: user.expira_em, acesso_pausado: user.acesso_pausado, acesso_bloqueado,
    }
  });
});
```

Add import at top of file (after existing imports):

```typescript
import { visitanteBloqueado, calcularExpiracaoVisitante } from '../lib/visitante';
```

- [ ] **Step 2: Update /me endpoint**

Find `usuarios.get('/me', userAuthMiddleware, ...)` and replace entire handler:

```typescript
// Usuario logado: dados do perfil
usuarios.get('/me', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first<{
    is_visitante: number; expira_em: string | null; acesso_pausado: number;
    [k: string]: unknown;
  }>();

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  const acesso_bloqueado = visitanteBloqueado({
    is_visitante: user.is_visitante,
    expira_em: user.expira_em,
    acesso_pausado: user.acesso_pausado,
  });

  return c.json({ ...user, acesso_bloqueado });
});
```

- [ ] **Step 3: Update PUT /me handler — include fields in final SELECT**

Find the `usuarios.put('/me', ...)` handler. Find the final SELECT that returns the updated user and replace with:

```typescript
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em, acesso_pausado, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first<{
    is_visitante: number; expira_em: string | null; acesso_pausado: number;
    [k: string]: unknown;
  }>();

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  const acesso_bloqueado = visitanteBloqueado({
    is_visitante: user.is_visitante,
    expira_em: user.expira_em,
    acesso_pausado: user.acesso_pausado,
  });

  return c.json({ ...user, acesso_bloqueado });
```

- [ ] **Step 4: Typecheck**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/usuarios.ts
git commit -m "feat: login e /me retornam acesso_bloqueado e campos de visitante"
```

---

## Task 5: Backend — Visitor Cadastro Endpoint

**Files:**
- Modify: `worker/src/routes/usuarios.ts`

- [ ] **Step 1: Add new endpoint right after the existing cadastro handler**

In `worker/src/routes/usuarios.ts`, after `usuarios.post('/cadastro', ...)` closing `});`, insert:

```typescript
// Publico: cadastro de visitante
usuarios.post('/cadastro/visitante', async (c) => {
  const { email, senha, trigrama, saram, whatsapp, categoria, esquadrao_origem } = await c.req.json<{
    email: string; senha: string; trigrama: string; saram: string; whatsapp: string;
    categoria: string; esquadrao_origem: string;
  }>();

  if (!email || !senha || !trigrama || !saram || !whatsapp || !categoria || !esquadrao_origem) {
    return c.json({ error: 'Todos os campos são obrigatórios (inclusive esquadrão de origem)' }, 400);
  }

  if (!isCategoriaValida(categoria)) {
    return c.json({ error: 'Categoria militar inválida' }, 400);
  }

  if (senha.length < 6) {
    return c.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);
  }

  const trigramaClean = trigrama.trim().toUpperCase();
  if (!/^[A-ZÀ-ÚÖ]{3}$/.test(trigramaClean)) {
    return c.json({ error: 'Trigrama deve ter exatamente 3 letras' }, 400);
  }

  const saramClean = saram.trim();
  if (!/^\d+$/.test(saramClean)) {
    return c.json({ error: 'SARAM deve conter apenas números' }, 400);
  }

  const emailClean = email.trim().toLowerCase();
  const esquadraoClean = esquadrao_origem.trim().toUpperCase();

  const existEmail = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(emailClean).first();
  if (existEmail) return c.json({ error: 'Email já cadastrado' }, 409);

  const existTrigrama = await c.env.DB.prepare('SELECT id FROM usuarios WHERE trigrama = ?').bind(trigramaClean).first();
  if (existTrigrama) return c.json({ error: 'Trigrama já cadastrado' }, 409);

  const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ?').bind(saramClean).first();
  if (existSaram) return c.json({ error: 'SARAM já cadastrado' }, 409);

  const senhaHash = await hashPassword(senha);
  const whatsappClean = whatsapp.trim();
  const salaCafe = derivarSalaCafe(categoria as Categoria);
  const expiraEm = calcularExpiracaoVisitante(30);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO usuarios (email, senha_hash, trigrama, saram, whatsapp, categoria, sala_cafe, is_visitante, esquadrao_origem, expira_em) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?) RETURNING id'
  ).bind(emailClean, senhaHash, trigramaClean, saramClean, whatsappClean, categoria, salaCafe, esquadraoClean, expiraEm).all<{ id: number }>();

  const userId = results[0].id;

  // Criar/atualizar cliente com visitante=1
  const existCliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigramaClean).first();

  if (!existCliente) {
    await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, whatsapp, visitante, esquadrao_origem) VALUES (?, ?, 1, ?)'
    ).bind(trigramaClean, whatsappClean, esquadraoClean).run();
  } else {
    await c.env.DB.prepare(
      'UPDATE clientes SET whatsapp = ?, visitante = 1, esquadrao_origem = ? WHERE nome_guerra = ? COLLATE NOCASE'
    ).bind(whatsappClean, esquadraoClean, trigramaClean).run();
  }

  const token = await sign(
    { tipo: 'usuario', id: userId, email: emailClean, trigrama: trigramaClean },
    c.env.JWT_SECRET,
    720
  );

  return c.json({
    token,
    user: {
      id: userId, email: emailClean, trigrama: trigramaClean, saram: saramClean,
      whatsapp: whatsappClean, foto_url: null, categoria, sala_cafe: salaCafe,
      is_visitante: 1, esquadrao_origem: esquadraoClean,
      expira_em: expiraEm, acesso_pausado: 0, acesso_bloqueado: false,
    }
  }, 201);
});
```

- [ ] **Step 2: Typecheck**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/usuarios.ts
git commit -m "feat: endpoint POST /api/usuarios/cadastro/visitante"
```

---

## Task 6: Backend — Admin Visitor Management Endpoint

**Files:**
- Modify: `worker/src/routes/usuarios.ts`

- [ ] **Step 1: Add admin visitor endpoint**

In `worker/src/routes/usuarios.ts`, after the existing `usuarios.put('/admin/:id/categoria', ...)` handler, insert:

```typescript
// Admin: atualizar campos de visitante
usuarios.put('/admin/:id/visitante', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { expira_em, acesso_pausado } = await c.req.json<{ expira_em?: string; acesso_pausado?: number }>();

  const u = await c.env.DB.prepare('SELECT is_visitante FROM usuarios WHERE id = ?').bind(id)
    .first<{ is_visitante: number }>();
  if (!u) return c.json({ error: 'Usuário não encontrado' }, 404);
  if (u.is_visitante !== 1) return c.json({ error: 'Esse usuário não é visitante' }, 400);

  const updates: string[] = [];
  const params: unknown[] = [];

  if (typeof expira_em === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expira_em)) return c.json({ error: 'Data inválida (use YYYY-MM-DD)' }, 400);
    updates.push('expira_em = ?');
    params.push(expira_em);
  }

  if (typeof acesso_pausado === 'number') {
    updates.push('acesso_pausado = ?');
    params.push(acesso_pausado ? 1 : 0);
  }

  if (!updates.length) return c.json({ error: 'Nenhum campo para atualizar' }, 400);

  params.push(id);
  await c.env.DB.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  return c.json({ ok: true });
});
```

- [ ] **Step 2: Update admin list endpoint to include visitor fields**

Find `usuarios.get('/admin/lista', ...)` and replace with:

```typescript
// Admin: listar usuarios
usuarios.get('/admin/lista', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, ativo, is_visitante, esquadrao_origem, expira_em, acesso_pausado, created_at FROM usuarios ORDER BY trigrama'
  ).all();
  return c.json(results);
});
```

Also find `usuarios.get('/admin/por-trigrama/:trigrama', ...)` and replace with:

```typescript
// Admin: buscar usuario pelo trigrama
usuarios.get('/admin/por-trigrama/:trigrama', authMiddleware, async (c) => {
  const trigrama = (c.req.param('trigrama') || '').toUpperCase();
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, ativo, is_visitante, esquadrao_origem, expira_em, acesso_pausado, created_at FROM usuarios WHERE trigrama = ? COLLATE NOCASE'
  ).bind(trigrama).first();

  if (!user) return c.json(null);
  return c.json(user);
});
```

- [ ] **Step 3: Typecheck**

```bash
cd worker && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/usuarios.ts
git commit -m "feat: admin gerencia visitantes (expira_em, acesso_pausado)"
```

---

## Task 7: Backend — Café Status Endpoint

**Files:**
- Modify: `worker/src/routes/usuarios.ts`

- [ ] **Step 1: Add /me/cafe endpoint**

In `worker/src/routes/usuarios.ts`, after the `/me/dashboard` handler, insert:

```typescript
// Usuario logado: status do cafe pessoal
usuarios.get('/me/cafe', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const trigrama = c.get('userTrigrama');

  const user = await c.env.DB.prepare(
    'SELECT sala_cafe, categoria FROM usuarios WHERE id = ?'
  ).bind(userId).first<{ sala_cafe: string | null; categoria: string }>();

  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  if (!user.sala_cafe) {
    return c.json({ tem_assinatura: false, tipo: null, sem_sala: true });
  }

  const cliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigrama).first<{ id: string }>();

  if (!cliente) return c.json({ tem_assinatura: false, tipo: user.sala_cafe, sem_sala: false });

  const assinante = await c.env.DB.prepare(
    "SELECT id, valor, tipo, plano FROM cafe_assinantes WHERE cliente_id = ? AND ativo = 1"
  ).bind(cliente.id).first<{ id: string; valor: number; tipo: string; plano: string }>();

  if (!assinante) return c.json({ tem_assinatura: false, tipo: user.sala_cafe, sem_sala: false });

  const now = new Date();
  const mesAtual = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  const pagMes = await c.env.DB.prepare(
    "SELECT status FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?"
  ).bind(assinante.id, mesAtual).first<{ status: string }>();

  const pendRow = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(valor), 0) as total FROM cafe_pagamentos WHERE assinante_id = ? AND status = 'pendente'"
  ).bind(assinante.id).first<{ total: number }>();

  const { results: historico } = await c.env.DB.prepare(
    "SELECT referencia, valor, status, paid_at FROM cafe_pagamentos WHERE assinante_id = ? ORDER BY referencia DESC LIMIT 6"
  ).bind(assinante.id).all();

  return c.json({
    tem_assinatura: true,
    tipo: assinante.tipo,
    plano: assinante.plano,
    valor_mensal: assinante.valor,
    mes_atual: mesAtual,
    mes_atual_pago: pagMes?.status === 'pago',
    total_pendente: pendRow?.total || 0,
    historico,
  });
});
```

- [ ] **Step 2: Typecheck**

```bash
cd worker && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/usuarios.ts
git commit -m "feat: endpoint GET /api/usuarios/me/cafe (status pessoal)"
```

---

## Task 8: Backend — Apply visitorActiveCheck to Critical Endpoints

**Files:**
- Modify: `worker/src/routes/pedidos.ts`

- [ ] **Step 1: Import middleware and apply to POST /**

In `worker/src/routes/pedidos.ts`, add import at top (after existing imports):

```typescript
import { visitorActiveCheck } from '../middleware/visitorActiveCheck';
import { userAuthMiddleware } from '../middleware/userAuth';
```

Find the current `pedidos.post('/', async (c) => {` handler (the public checkout endpoint).

This endpoint is currently public (no middleware). We want it to remain public for guests but when a user token is present, we need to enforce visitor active check. The cleanest approach: run userAuth+visitor check only if Authorization header is present.

Replace the handler declaration with:

```typescript
pedidos.post('/', async (c, next) => {
  // Se tiver token de usuario, valida acesso de visitante
  const header = c.req.header('Authorization');
  if (header?.startsWith('Bearer ')) {
    // Tenta rodar userAuth + visitorActiveCheck em cadeia
    let blocked = false;
    await userAuthMiddleware(c, async () => {
      await visitorActiveCheck(c, async () => {
        // ok
      });
      if (c.finalized) blocked = true;
    });
    if (c.finalized) return;
  }
  return next();
}, async (c) => {
  // Handler atual continua aqui (mesmo corpo de antes)
```

**Important:** This wraps the existing handler with a gate. The existing handler body stays the same. In Hono, to add a pre-middleware to a specific route, a cleaner pattern is:

```typescript
// Replace:
pedidos.post('/', async (c) => { /* ... existing body ... */ });

// With:
async function checkVisitanteSeLogado(c: any, next: any) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return next();
  await userAuthMiddleware(c, async () => {
    await visitorActiveCheck(c, next);
  });
}

pedidos.post('/', checkVisitanteSeLogado, async (c) => { /* ... existing body ... */ });
```

Put `checkVisitanteSeLogado` as a module-level function right after the imports, before `const pedidos = new Hono<AppType>();`.

- [ ] **Step 2: Typecheck**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add worker/src/routes/pedidos.ts
git commit -m "feat: checkout bloqueia se visitante estiver expirado"
```

---

## Task 9: Frontend — Update Usuario Type

**Files:**
- Modify: `app/src/types/index.ts`

- [ ] **Step 1: Extend Usuario interface**

In `app/src/types/index.ts`, replace the existing Usuario interface with:

```typescript
export interface Usuario {
  id: number;
  email: string;
  trigrama: string;
  saram: string;
  whatsapp: string;
  foto_url: string | null;
  categoria: Categoria;
  sala_cafe: SalaCafe;
  is_visitante?: number;
  esquadrao_origem?: string | null;
  expira_em?: string | null;
  acesso_pausado?: number;
  acesso_bloqueado?: boolean;
  ativo?: number;
  created_at?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat: Usuario type com campos de visitante"
```

---

## Task 10: Frontend — useUserAuth Support for cadastrarVisitante

**Files:**
- Modify: `app/src/hooks/useUserAuth.ts`

- [ ] **Step 1: Add cadastrarVisitante action**

In `app/src/hooks/useUserAuth.ts`, add to the `CadastroData` interface and the store:

Replace `CadastroData`:

```typescript
interface CadastroData {
  email: string;
  senha: string;
  trigrama: string;
  saram: string;
  whatsapp: string;
  categoria: 'oficial' | 'graduado' | 'praca';
}

interface CadastroVisitanteData extends CadastroData {
  esquadrao_origem: string;
}
```

Add to the interface `UserAuthState`:

```typescript
cadastrarVisitante: (dados: CadastroVisitanteData) => Promise<void>;
```

Add to the implementation (near `cadastrar`):

```typescript
  cadastrarVisitante: async (dados) => {
    set({ loading: true });
    try {
      const { token, user } = await api.post<{ token: string; user: Usuario }>(
        '/api/usuarios/cadastro/visitante',
        dados
      );
      localStorage.setItem('user_token', token);
      set({ token, user, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },
```

- [ ] **Step 2: Commit**

```bash
git add app/src/hooks/useUserAuth.ts
git commit -m "feat: useUserAuth.cadastrarVisitante"
```

---

## Task 11: Frontend — Cadastro Escolha Page

**Files:**
- Create: `app/src/pages/CadastroEscolha.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Create page**

```typescript
// app/src/pages/CadastroEscolha.tsx
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';

export function CadastroEscolha() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/';

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-10 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-2 text-center">CADASTRO</h1>
        <p className="text-sm text-texto-fraco text-center mb-8">Você é do 1/10 GpAv?</p>

        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={() => navigate('/cadastro/militar', { state: { returnTo } })}>
            Sim, sou do 1/10 GpAv
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/cadastro/visitante', { state: { returnTo } })}>
            Sou visitante de outro esquadrão
          </Button>
        </div>

        <p className="text-center text-xs text-texto-fraco mt-8">
          Visitantes têm acesso por 30 dias. Para estender, fale com o admin da cantina.
        </p>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Update App.tsx routing**

In `app/src/App.tsx`, replace the `<Route path="/cadastro" ... />` line with:

```typescript
        <Route path="/cadastro" element={<CadastroEscolha />} />
        <Route path="/cadastro/militar" element={<UserCadastro />} />
```

Add import near other page imports:

```typescript
import { CadastroEscolha } from './pages/CadastroEscolha';
```

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/CadastroEscolha.tsx app/src/App.tsx
git commit -m "feat: tela inicial de cadastro com escolha militar/visitante"
```

---

## Task 12: Frontend — Visitor Cadastro Page

**Files:**
- Create: `app/src/pages/UserCadastroVisitante.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Create visitor registration page**

```typescript
// app/src/pages/UserCadastroVisitante.tsx
import { useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';
import type { Categoria } from '../types';

export function UserCadastroVisitante() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [trigrama, setTrigrama] = useState('');
  const [saram, setSaram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [esquadraoOrigem, setEsquadraoOrigem] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { cadastrarVisitante, updateFoto, loading } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/';

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErro('Foto deve ter no máximo 2MB'); return; }
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!categoria) { setErro('Selecione sua categoria militar'); return; }
    if (!esquadraoOrigem.trim()) { setErro('Informe seu esquadrão de origem'); return; }
    if (senha.length < 6) { setErro('Senha deve ter no mínimo 6 caracteres'); return; }
    if (senha !== confirmarSenha) { setErro('Senhas não conferem'); return; }

    const trigramaClean = trigrama.trim().toUpperCase();
    if (!/^[A-ZÀ-ÚÖ]{3}$/.test(trigramaClean)) { setErro('Trigrama deve ter exatamente 3 letras'); return; }
    if (!/^\d+$/.test(saram.trim())) { setErro('SARAM deve conter apenas números'); return; }
    if (!whatsapp.trim()) { setErro('WhatsApp é obrigatório'); return; }

    try {
      await cadastrarVisitante({
        email: email.trim(),
        senha,
        trigrama: trigramaClean,
        saram: saram.trim(),
        whatsapp: whatsapp.trim(),
        categoria,
        esquadrao_origem: esquadraoOrigem.trim().toUpperCase(),
      });
      if (foto) { try { await updateFoto(foto); } catch { /* foto opcional */ } }
      navigate(returnTo, { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-6 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-2 text-center">VISITANTE</h1>
        <p className="text-center text-xs text-texto-fraco mb-6">
          Seu acesso será liberado por 30 dias. Para estender, fale com o admin da cantina.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded-full bg-fundo border-2 border-dashed border-borda flex items-center justify-center overflow-hidden hover:border-azul transition-colors">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <svg className="w-8 h-8 text-texto-fraco mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-[10px] text-texto-fraco">Foto</span>
                </div>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto} className="hidden" />
            <span className="text-xs text-texto-fraco mt-1">Opcional</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Categoria Militar</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'oficial', label: 'Oficial' },
                { v: 'graduado', label: 'Graduado/SO' },
                { v: 'praca', label: 'Praça' },
              ] as const).map((opt) => (
                <button key={opt.v} type="button" onClick={() => setCategoria(opt.v)}
                  className={`py-3 px-2 rounded-xl text-sm font-medium border transition-all
                    ${categoria === opt.v
                      ? 'bg-azul text-white border-azul shadow-sm'
                      : 'bg-white text-texto-fraco border-borda hover:border-azul/50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Esquadrão de Origem</label>
            <input type="text" value={esquadraoOrigem}
              onChange={(e) => setEsquadraoOrigem(e.target.value.toUpperCase())}
              placeholder="Ex: 2/5 GAV, 1/14 GAV..."
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-texto-fraco mb-1.5">Trigrama</label>
              <input type="text" value={trigrama}
                onChange={(e) => setTrigrama(e.target.value.toUpperCase().replace(/[^A-ZÀ-ÚÖ]/g, '').slice(0, 3))}
                maxLength={3} placeholder="RET"
                className="w-full bg-white border border-borda rounded-xl px-4 py-3 uppercase tracking-widest font-display text-lg text-center focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto-fraco mb-1.5">SARAM</label>
              <input type="text" inputMode="numeric" value={saram}
                onChange={(e) => setSaram(e.target.value.replace(/\D/g, ''))} placeholder="Identificação"
                className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">WhatsApp</label>
            <input type="tel" value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 62999998888"
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres"
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Confirmar Senha</label>
            <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar como Visitante'}
          </Button>
        </form>
        <p className="text-center text-sm text-texto-fraco mt-4">
          Já tem conta? <Link to="/login" state={{ returnTo }} className="text-azul font-medium hover:underline">Entrar</Link>
        </p>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Add route in App.tsx**

Add import near other page imports:

```typescript
import { UserCadastroVisitante } from './pages/UserCadastroVisitante';
```

Add route after `/cadastro/militar`:

```typescript
        <Route path="/cadastro/visitante" element={<UserCadastroVisitante />} />
```

- [ ] **Step 3: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

Expected: successful build.

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/UserCadastroVisitante.tsx app/src/App.tsx
git commit -m "feat: pagina de cadastro de visitante com esquadrao_origem"
```

---

## Task 13: Frontend — Acesso Expirado Page + VisitorGuard

**Files:**
- Create: `app/src/pages/AcessoExpirado.tsx`
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Create AcessoExpirado page**

```typescript
// app/src/pages/AcessoExpirado.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';
import { api } from '../services/api';

export function AcessoExpirado() {
  const { logout } = useUserAuth();
  const [whatsapp, setWhatsapp] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Record<string, string>>('/api/config')
      .then(c => setWhatsapp(c.pix_guloseimas_whatsapp || ''))
      .catch(() => {});
  }, []);

  const abrirWhats = () => {
    if (!whatsapp) return;
    const msg = 'Olá, meu acesso de visitante expirou. Poderia renovar?';
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-16 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl text-azul tracking-wider mb-3">ACESSO EXPIRADO</h1>
        <p className="text-texto-fraco text-sm mb-8">
          Seu acesso de visitante chegou ao fim ou foi pausado pelo administrador.
          Para renovar, fale com a Larissa.
        </p>
        <div className="space-y-3">
          <Button variant="success" size="lg" className="w-full" onClick={abrirWhats} disabled={!whatsapp}>
            Falar com Larissa (WhatsApp)
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => { logout(); navigate('/'); }}>
            Sair
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Add VisitorGuard and route in App.tsx**

In `app/src/App.tsx`, add import:

```typescript
import { AcessoExpirado } from './pages/AcessoExpirado';
```

Add a new guard function near `AdminGuard`:

```typescript
function VisitorGuard({ children }: { children: React.ReactNode }) {
  const { user } = useUserAuth();
  if (user?.acesso_bloqueado) {
    return <Navigate to="/acesso-expirado" replace />;
  }
  return <>{children}</>;
}
```

Add the route:

```typescript
        <Route path="/acesso-expirado" element={<AcessoExpirado />} />
```

Wrap the routes that require active visitor in `<VisitorGuard>`:

Change these lines:

```typescript
        <Route path="/checkout" element={<Checkout />} />
```

to:

```typescript
        <Route path="/checkout" element={<VisitorGuard><Checkout /></VisitorGuard>} />
```

Also wrap `/catalogo/:categoria`, `/loja`, `/cafe`, `/pix/:pedidoId`, `/obrigado` the same way. The dashboard (`/`) and `/perfil` stay accessible (show the banner via Dashboard checking `user.acesso_bloqueado`).

- [ ] **Step 3: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/AcessoExpirado.tsx app/src/App.tsx
git commit -m "feat: pagina e guard de acesso expirado do visitante"
```

---

## Task 14: Frontend — API Service Intercepts 403

**Files:**
- Modify: `app/src/services/api.ts`

- [ ] **Step 1: Intercept 403 with acesso_bloqueado flag**

In `app/src/services/api.ts`, replace the whole file content with:

```typescript
const BASE_URL = import.meta.env.VITE_WORKER_URL || '';

function pickToken(path: string): string | null {
  const adminToken = localStorage.getItem('token');
  const userToken = localStorage.getItem('user_token');

  if (path.startsWith('/api/usuarios/me')) return userToken;
  if (path === '/api/usuarios/login' || path === '/api/usuarios/cadastro' || path === '/api/usuarios/cadastro/visitante') return null;

  if (path.startsWith('/api/auth')) return adminToken;
  if (path.startsWith('/api/usuarios/admin')) return adminToken;
  if (path.startsWith('/api/admin')) return adminToken;

  return adminToken || userToken;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = pickToken(path);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido' })) as { error?: string; acesso_bloqueado?: boolean };
    if (res.status === 403 && body.acesso_bloqueado) {
      // Visitante expirado/pausado: redireciona
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/acesso-expirado')) {
        window.location.href = '/acesso-expirado';
      }
    }
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }),
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/services/api.ts
git commit -m "feat: api intercepta 403 acesso_bloqueado e redireciona"
```

---

## Task 15: Frontend — Café Page Refactor (Payment Flow)

**Files:**
- Modify: `app/src/pages/CafePublico.tsx`

- [ ] **Step 1: Rewrite CafePublico as payment flow**

Replace `app/src/pages/CafePublico.tsx` entirely:

```typescript
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import { gerarPayloadPix } from '../services/pix';
import { useUserAuth } from '../hooks/useUserAuth';

type Sala = 'oficial' | 'graduado' | null;

export function CafePublico() {
  const [searchParams] = useSearchParams();
  const { user } = useUserAuth();

  const userSala: Sala = user?.sala_cafe === 'oficiais' ? 'oficial'
    : user?.sala_cafe === 'graduados' ? 'graduado'
    : null;

  const salaParam = searchParams.get('sala');
  const salaInicial: Sala = userSala
    || (salaParam === 'oficial' || salaParam === 'graduado' ? salaParam : null);

  const [sala, setSala] = useState<Sala>(salaInicial);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [copiadoChave, setCopiadoChave] = useState(false);
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);

  useEffect(() => {
    api.get<Record<string, string>>('/api/config').then(setConfig).catch(() => {});
  }, []);

  // Praca logado sem sala
  if (user && !user.sala_cafe) {
    return (
      <AppLayout>
        <div className="max-w-sm mx-auto py-16 text-center animate-fade-in">
          <h1 className="font-display text-2xl text-azul tracking-wider mb-3">SEM CAIXINHA</h1>
          <p className="text-texto-fraco text-sm mb-8">Praças não participam de caixinha do café.</p>
          <Link to="/" className="text-azul font-medium hover:underline">Voltar</Link>
        </div>
      </AppLayout>
    );
  }

  if (!sala) {
    return (
      <AppLayout>
        <div className="py-6 animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl text-azul tracking-wider mb-2">CAIXINHA DO CAFÉ</h1>
            <p className="text-sm text-texto-fraco">Escolha sua cantina</p>
          </div>
          <div className="space-y-4 max-w-sm mx-auto">
            <button onClick={() => setSala('oficial')}
              className="w-full bg-white rounded-2xl p-5 border border-borda hover:border-azul shadow-sm transition-all text-left">
              <h2 className="font-display text-lg text-azul tracking-wide uppercase">Cantina dos Oficiais</h2>
            </button>
            <button onClick={() => setSala('graduado')}
              className="w-full bg-white rounded-2xl p-5 border border-borda hover:border-vermelho shadow-sm transition-all text-left">
              <h2 className="font-display text-lg text-vermelho tracking-wide uppercase">Cantina dos Graduados</h2>
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const chave = config[sala === 'oficial' ? 'pix_cafe_oficial_chave' : 'pix_cafe_graduado_chave'] || '';
  const nome = config[sala === 'oficial' ? 'pix_cafe_oficial_nome' : 'pix_cafe_graduado_nome'] || '';
  const whatsapp = config[sala === 'oficial' ? 'pix_cafe_oficial_whatsapp' : 'pix_cafe_graduado_whatsapp'] || '';
  const valorStr = config[sala === 'oficial' ? 'cafe_visitante_oficial_valor' : 'cafe_visitante_graduado_valor'] || '20.00';
  const valor = parseFloat(valorStr) || 20;
  const nomeCantina = sala === 'oficial' ? 'Cantina dos Oficiais' : 'Cantina dos Graduados';

  const copiarPix = async () => {
    if (!chave) return;
    const payload = gerarPayloadPix(valor, { chave, nome });
    await navigator.clipboard.writeText(payload);
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 3000);
  };

  const copiarChave = async () => {
    if (!chave) return;
    await navigator.clipboard.writeText(chave);
    setCopiadoChave(true);
    setTimeout(() => setCopiadoChave(false), 3000);
  };

  const enviarComprovante = () => {
    if (!whatsapp) return;
    const msg = `Comprovante Caixinha do Café\n${nomeCantina}\nValor: R$ ${valor.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          {!userSala && (
            <button onClick={() => setSala(null)} className="text-texto-fraco hover:text-texto">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <h1 className="font-display text-xl text-azul tracking-wider uppercase">Caixinha do Café</h1>
        </div>
        <p className="text-sm text-texto-fraco mb-6">{nomeCantina}</p>

        <div className="bg-azul rounded-2xl p-6 mb-4 text-center text-white shadow-sm">
          <div className="text-xs opacity-70 uppercase tracking-widest">Valor mensal</div>
          <div className="font-display text-4xl tracking-wider mt-1">R$ {valor.toFixed(2)}</div>
        </div>

        <div className="bg-white rounded-2xl p-5 mb-4 border border-borda shadow-sm">
          <p className="text-xs text-texto-fraco mb-1 uppercase tracking-wider text-center">Chave PIX</p>
          <p className="text-[10px] text-texto-fraco mb-3 text-center">{nome}</p>
          <div className="flex items-center justify-center gap-2 bg-fundo rounded-xl py-3 px-4">
            <span className="text-sm text-azul font-medium truncate">{chave}</span>
            <button onClick={copiarChave} className="shrink-0 p-2 rounded-lg hover:bg-white transition-colors">
              {copiadoChave ? (
                <svg className="w-4 h-4 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-4 h-4 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              )}
            </button>
          </div>
          {copiadoChave && <p className="text-verde text-xs mt-2 text-center">Chave copiada!</p>}
        </div>

        <div className="space-y-3">
          <Button variant="primary" size="lg" className="w-full" onClick={copiarPix}>
            {copiadoCodigo ? 'PIX copiado!' : 'Copiar código PIX'}
          </Button>
          <Button variant="success" size="lg" className="w-full" onClick={enviarComprovante}>
            Enviar comprovante (WhatsApp)
          </Button>
        </div>

        <p className="text-center text-xs text-texto-fraco mt-6">
          Após pagar, envie o comprovante pelo botão acima.
        </p>
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/CafePublico.tsx
git commit -m "refactor: /cafe vira pagina de pagamento (sem lista publica)"
```

---

## Task 16: Frontend — MeuCafe Profile Component

**Files:**
- Create: `app/src/components/perfil/MeuCafe.tsx`
- Modify: `app/src/pages/Perfil.tsx`

- [ ] **Step 1: Create component**

```typescript
// app/src/components/perfil/MeuCafe.tsx
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { gerarPayloadPix } from '../../services/pix';

interface CafeStatus {
  tem_assinatura: boolean;
  tipo: string | null;
  plano?: string;
  valor_mensal?: number;
  mes_atual?: string;
  mes_atual_pago?: boolean;
  total_pendente?: number;
  historico?: { referencia: string; valor: number; status: string; paid_at: string | null }[];
  sem_sala?: boolean;
}

export function MeuCafe() {
  const [status, setStatus] = useState<CafeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<CafeStatus>('/api/usuarios/me/cafe'),
      api.get<Record<string, string>>('/api/config'),
    ]).then(([s, c]) => { setStatus(s); setConfig(c); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white rounded-xl border border-borda p-4 text-sm text-texto-fraco text-center">Carregando café...</div>;
  if (!status || status.sem_sala) return null;

  if (!status.tem_assinatura) {
    return (
      <div className="bg-white rounded-xl border border-borda p-4">
        <div className="text-sm font-medium text-texto-fraco mb-2">Meu Café</div>
        <p className="text-xs text-texto-fraco">Você não tem assinatura ativa. Fale com o administrador.</p>
      </div>
    );
  }

  const tipo = status.tipo as 'oficial' | 'graduado';
  const chave = config[tipo === 'oficial' ? 'pix_cafe_oficial_chave' : 'pix_cafe_graduado_chave'] || '';
  const nome = config[tipo === 'oficial' ? 'pix_cafe_oficial_nome' : 'pix_cafe_graduado_nome'] || '';
  const whatsapp = config[tipo === 'oficial' ? 'pix_cafe_oficial_whatsapp' : 'pix_cafe_graduado_whatsapp'] || '';
  const totalPendente = status.total_pendente || 0;

  const copiarPix = async () => {
    if (!chave || totalPendente <= 0) return;
    const payload = gerarPayloadPix(totalPendente, { chave, nome });
    await navigator.clipboard.writeText(payload);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const enviarComprovante = () => {
    if (!whatsapp) return;
    const msg = `Comprovante Caixinha do Café\nValor: R$ ${totalPendente.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="bg-white rounded-xl border border-borda p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-texto-fraco">Meu Café</div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.mes_atual_pago ? 'bg-green-100 text-verde-escuro' : 'bg-red-50 text-vermelho'}`}>
          {status.mes_atual_pago ? 'Pago' : 'Pendente'}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <div className="text-xs text-texto-fraco">Mensalidade:</div>
        <div className="font-display text-azul text-lg tracking-wider">R$ {(status.valor_mensal || 0).toFixed(2)}</div>
      </div>

      {totalPendente > 0 && (
        <>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="text-xs text-vermelho font-medium">Total pendente</div>
            <div className="font-display text-2xl text-vermelho tracking-wider">R$ {totalPendente.toFixed(2)}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1" onClick={copiarPix}>
              {copiado ? 'Copiado!' : 'Copiar PIX'}
            </Button>
            <Button variant="success" size="sm" className="flex-1" onClick={enviarComprovante}>
              Enviar Comprovante
            </Button>
          </div>
        </>
      )}

      {status.historico && status.historico.length > 0 && (
        <div>
          <div className="text-xs text-texto-fraco mb-1.5 mt-2">Histórico</div>
          <div className="space-y-1">
            {status.historico.map(h => (
              <div key={h.referencia} className="flex items-center justify-between text-xs py-1 border-b border-borda last:border-0">
                <span>{h.referencia}</span>
                <span className="text-texto-fraco">R$ {h.valor.toFixed(2)}</span>
                <span className={h.status === 'pago' ? 'text-verde-escuro' : 'text-vermelho'}>{h.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Embed in Perfil page**

In `app/src/pages/Perfil.tsx`, add import:

```typescript
import { MeuCafe } from '../components/perfil/MeuCafe';
```

Insert the component in the JSX, right before the closing tags of the perfil content (after the form or at a logical position):

Find the section with the form `<form onSubmit={handleSave}` and AFTER it closes (`</form>`), and BEFORE the "Sair da conta" button, insert:

```typescript
        <div className="mt-5">
          <MeuCafe />
        </div>
```

- [ ] **Step 3: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/perfil/MeuCafe.tsx app/src/pages/Perfil.tsx
git commit -m "feat: card MeuCafe no perfil do militar"
```

---

## Task 17: Frontend — Admin Configuracoes Campos Novos

**Files:**
- Modify: `app/src/pages/admin/Configuracoes.tsx`

- [ ] **Step 1: Add new config fields**

In `app/src/pages/admin/Configuracoes.tsx`, locate the existing fields section. After the café-related fields (look for `pix_cafe_oficial_*` or `pix_cafe_graduado_*`), add two new input blocks.

Read the file to identify the exact pattern used, then add this block adapting to the existing structure:

```typescript
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1">Valor café visitante (Oficiais)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={v('cafe_visitante_oficial_valor', '20.00')}
              onChange={(e) => set('cafe_visitante_oficial_valor', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1">Valor café visitante (Graduados)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={v('cafe_visitante_graduado_valor', '20.00')}
              onChange={(e) => set('cafe_visitante_graduado_valor', e.target.value)}
              className={inputClass}
            />
          </div>
```

The helper `v` and `set` and `inputClass` already exist in that file. If the existing file doesn't have such helpers and instead uses different patterns, adapt to match.

- [ ] **Step 2: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/admin/Configuracoes.tsx
git commit -m "feat: admin config tem valores de cafe visitante oficial/graduado"
```

---

## Task 18: Frontend — Admin Usuarios com Controles de Visitante

**Files:**
- Modify: `app/src/pages/admin/Usuarios.tsx`

- [ ] **Step 1: Add visitante filter and controls**

In `app/src/pages/admin/Usuarios.tsx`:

Update the Filtro type and options:

Replace:
```typescript
type Filtro = 'todos' | 'ativos' | 'desativados' | 'oficial' | 'graduado' | 'praca';
```

With:
```typescript
type Filtro = 'todos' | 'ativos' | 'desativados' | 'oficial' | 'graduado' | 'praca' | 'visitantes' | 'expirados';
```

Update the filtrados computation to support visitantes/expirados filters. Locate the `useMemo(() => {` block and replace:

```typescript
  const filtrados = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return usuarios.filter(u => {
      if (busca) {
        const q = busca.toLowerCase();
        if (!u.trigrama.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      if (filtro === 'ativos') return u.ativo === 1;
      if (filtro === 'desativados') return u.ativo === 0;
      if (filtro === 'oficial' || filtro === 'graduado' || filtro === 'praca') return u.categoria === filtro;
      if (filtro === 'visitantes') return u.is_visitante === 1;
      if (filtro === 'expirados') return u.is_visitante === 1 && (
        u.acesso_pausado === 1 || (u.expira_em !== null && u.expira_em !== undefined && u.expira_em < hoje)
      );
      return true;
    });
  }, [usuarios, filtro, busca]);
```

Update the filter buttons list. Locate the filter buttons array and add:

```typescript
        {([
          { id: 'todos', label: 'Todos' },
          { id: 'ativos', label: 'Ativos' },
          { id: 'desativados', label: 'Desativados' },
          { id: 'oficial', label: 'Oficiais' },
          { id: 'graduado', label: 'Graduados' },
          { id: 'praca', label: 'Praças' },
          { id: 'visitantes', label: 'Visitantes' },
          { id: 'expirados', label: 'Visitantes expirados' },
        ] as const).map(f => (
```

- [ ] **Step 2: Add visitante card info and controls**

Locate the user card render (`{filtrados.map(u => (`). Inside the card, after the existing info row (trigrama + email + badges), add a section for visitante info. Find the closing `</div>` of the identification row and after it (before the categoria buttons), add:

```typescript
              {u.is_visitante === 1 && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-amber-800 font-semibold">VISITANTE</span>
                    {u.esquadrao_origem && <span className="text-texto-fraco">— {u.esquadrao_origem}</span>}
                    {u.expira_em && (() => {
                      const hoje = new Date();
                      const alvo = new Date(u.expira_em + 'T00:00:00');
                      const dias = Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <span className={`ml-auto px-2 py-0.5 rounded-full font-medium ${
                          dias < 0 ? 'bg-red-100 text-vermelho' : dias <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-verde-escuro'
                        }`}>
                          {dias < 0 ? `Expirou há ${-dias}d` : dias === 0 ? 'Expira hoje' : `${dias}d restantes`}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <label className="text-xs text-texto-fraco">Expira em:</label>
                    <input
                      type="date"
                      defaultValue={u.expira_em || ''}
                      onBlur={async (e) => {
                        if (e.target.value && e.target.value !== u.expira_em) {
                          setAcaoLoading(u.id);
                          try {
                            await api.put(`/api/usuarios/admin/${u.id}/visitante`, { expira_em: e.target.value });
                            setMsg(`${u.trigrama}: data de expiração atualizada`);
                            carregar();
                          } catch (err) {
                            setErro(err instanceof Error ? err.message : 'Erro ao salvar');
                          } finally {
                            setAcaoLoading(null);
                          }
                        }
                      }}
                      className="bg-white border border-borda rounded-lg px-2 py-1 text-xs"
                    />
                    <label className="flex items-center gap-1 text-xs text-texto-fraco cursor-pointer ml-auto">
                      <input
                        type="checkbox"
                        checked={u.acesso_pausado === 1}
                        onChange={async (e) => {
                          setAcaoLoading(u.id);
                          try {
                            await api.put(`/api/usuarios/admin/${u.id}/visitante`, { acesso_pausado: e.target.checked ? 1 : 0 });
                            setMsg(`${u.trigrama}: acesso ${e.target.checked ? 'pausado' : 'liberado'}`);
                            carregar();
                          } catch (err) {
                            setErro(err instanceof Error ? err.message : 'Erro ao salvar');
                          } finally {
                            setAcaoLoading(null);
                          }
                        }}
                        className="accent-vermelho"
                      />
                      Pausado
                    </label>
                  </div>
                </div>
              )}
```

- [ ] **Step 3: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/admin/Usuarios.tsx
git commit -m "feat: admin /usuarios com filtros e controles de visitante"
```

---

## Task 19: Frontend — Sidebar Reorder (Meu Perfil ultimo)

**Files:**
- Modify: `app/src/components/Sidebar.tsx`

- [ ] **Step 1: Reorder USER_NAV**

In `app/src/components/Sidebar.tsx`, replace `USER_NAV`:

```typescript
const USER_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <IconHome /> },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: <IconCart />, children: [
    { to: '/catalogo/oficiais', label: 'Cantina dos Oficiais' },
    { to: '/catalogo/graduados', label: 'Cantina dos Graduados' },
  ]},
  { to: '/loja', label: 'Loja', icon: <IconBag /> },
  { to: '/cafe', label: 'Café', icon: <IconCoffee /> },
  { to: '/ximboca', label: 'Ximboca', icon: <IconFire /> },
  { to: '/perfil', label: 'Meu Perfil', icon: <IconUser /> },
];
```

- [ ] **Step 2: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/Sidebar.tsx
git commit -m "style: Meu Perfil como ultimo item do sidebar"
```

---

## Task 20: Frontend — Dashboard Banner for Expired Visitor

**Files:**
- Modify: `app/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add banner when acesso_bloqueado**

In `app/src/pages/Dashboard.tsx`, inside the `Dashboard` component's return JSX, right after the welcome header (the flex with foto + saudação) and before the `{loading && ...}` line, insert:

```typescript
      {user.acesso_bloqueado && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-amber-900">
              <div className="font-medium">Seu acesso de visitante expirou ou foi pausado</div>
              <div className="text-xs mt-1">Você não pode realizar compras. <Link to="/acesso-expirado" className="underline font-medium">Renovar acesso</Link></div>
            </div>
          </div>
        </div>
      )}
```

Also add import if missing:

```typescript
import { Link } from 'react-router-dom';
```

- [ ] **Step 2: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/Dashboard.tsx
git commit -m "feat: Dashboard mostra banner se visitante expirou"
```

---

## Task 21: Deploy

- [ ] **Step 1: Final typecheck**

```bash
cd worker && npx tsc --noEmit
cd ../app && npm run build 2>&1 | tail -5
```

Both should succeed.

- [ ] **Step 2: Deploy worker**

```bash
cd worker && npx wrangler deploy
```

Expected: "Deployed senta-pua-worker triggers".

- [ ] **Step 3: Deploy frontend**

```bash
cd ../app && npx wrangler pages deploy dist --project-name=app-senta-pua --branch=main --commit-dirty=true
```

Expected: "Deployment complete!"

- [ ] **Step 4: Push to GitHub**

```bash
cd .. && git push
```

- [ ] **Step 5: Smoke test**

Open `https://app-senta-pua.pages.dev` and test:

1. **Cadastro militar (escolha Sim)**:
   - `/cadastro` mostra 2 botoes
   - Clicar "Sim, sou do 1/10" → abre cadastro atual
   - Completa cadastro → dashboard funciona normal

2. **Cadastro visitante (escolha Nao)**:
   - Clicar "Sou visitante" → abre form com campo "Esquadrão de Origem"
   - Cadastra → loga → dashboard mostra sem banner de expiracao (ainda tem 30 dias)
   - /perfil mostra card Meu Café

3. **Admin controla visitante**:
   - `/admin/usuarios` → filtro "Visitantes" aparece
   - Card do visitante mostra esquadrão, data expira_em editavel, toggle Pausado
   - Badge "Xd restantes" correto
   - Ativar Pausado → depois de F5 no usuario, ele vai pra /acesso-expirado
   - Desativar Pausado → visitante volta a funcionar

4. **Cafe novo fluxo**:
   - `/cafe` deslogado: escolha entre 2 cantinas
   - Oficial logado vai direto cantina oficiais com valor do config
   - Graduado logado vai direto cantina graduados
   - Praca logado ve "Sem caixinha"
   - Nao tem mais lista publica

5. **Sidebar**: Meu Perfil e o ultimo item, tem Ximboca antes
