# Dashboard + Categoria Militar + Cantina Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add military category (Oficial/Graduado/Praca) to user registration, auto-assign café sala by category, show logged-in users a personalized dashboard, and let admin manage accounts from existing `/admin/clientes/:id` page.

**Architecture:** Extend `usuarios` table with `categoria` and `sala_cafe` columns. Derive `sala_cafe` from `categoria` in backend. Replace the Home component with conditional rendering: dashboard when logged in, polished public home otherwise. Add a new `/api/usuarios/me/dashboard` endpoint that aggregates debts, recent orders, and café status. Integrate account management into the existing `ClienteExtrato` admin page.

**Tech Stack:** React 19, TypeScript, Hono (Cloudflare Workers), Cloudflare D1 (SQLite), Zustand

---

## File Structure

### New Files
- `worker/src/db/migrations/012_usuarios_categoria.sql` — migration
- `worker/src/lib/categoria.ts` — helpers for categoria → sala_cafe mapping
- `app/src/pages/Dashboard.tsx` — logged-in user dashboard
- `app/src/components/admin/ContaMilitar.tsx` — admin account management section

### Modified Files
- `worker/src/routes/usuarios.ts` — accept categoria in cadastro, add dashboard endpoint, admin categoria endpoint
- `worker/src/routes/clientes.ts` — include usuario info in admin list/extrato
- `app/src/hooks/useUserAuth.ts` — add categoria/sala_cafe to Usuario type, pass categoria in cadastro
- `app/src/types/index.ts` — extend Usuario type
- `app/src/pages/UserCadastro.tsx` — add categoria selector
- `app/src/pages/Home.tsx` — conditional render Dashboard vs public home, rename Sala→Cantina in defaults
- `app/src/pages/CafePublico.tsx` — auto-redirect logged users to their sala, show message for Praca
- `app/src/pages/admin/ClienteExtrato.tsx` — embed ContaMilitar section
- `app/src/pages/admin/Clientes.tsx` — column showing if cliente has account

---

## Task 1: Database Migration for Categoria

**Files:**
- Create: `worker/src/db/migrations/012_usuarios_categoria.sql`

- [ ] **Step 1: Create migration SQL**

```sql
-- worker/src/db/migrations/012_usuarios_categoria.sql
ALTER TABLE usuarios ADD COLUMN categoria TEXT NOT NULL DEFAULT 'praca';
ALTER TABLE usuarios ADD COLUMN sala_cafe TEXT;

-- Backfill sala_cafe for existing users (all default to praca so sala_cafe stays NULL)
UPDATE usuarios SET sala_cafe = NULL WHERE categoria = 'praca';
```

- [ ] **Step 2: Run migration on remote D1**

Ask the user to run:

```bash
cd worker && npx wrangler d1 execute senta-pua-db --remote --file=src/db/migrations/012_usuarios_categoria.sql
```

Wait for confirmation before proceeding to next task.

- [ ] **Step 3: Commit**

```bash
git add worker/src/db/migrations/012_usuarios_categoria.sql
git commit -m "feat: migration adicionar categoria e sala_cafe em usuarios"
```

---

## Task 2: Categoria Helper Library

**Files:**
- Create: `worker/src/lib/categoria.ts`

- [ ] **Step 1: Create helper with validation and mapping**

```typescript
// worker/src/lib/categoria.ts
export type Categoria = 'oficial' | 'graduado' | 'praca';
export type SalaCafe = 'oficiais' | 'graduados' | null;

export const CATEGORIAS_VALIDAS: Categoria[] = ['oficial', 'graduado', 'praca'];

export function isCategoriaValida(v: unknown): v is Categoria {
  return typeof v === 'string' && (CATEGORIAS_VALIDAS as string[]).includes(v);
}

export function derivarSalaCafe(categoria: Categoria): SalaCafe {
  if (categoria === 'oficial') return 'oficiais';
  if (categoria === 'graduado') return 'graduados';
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add worker/src/lib/categoria.ts
git commit -m "feat: helper de categoria militar e mapeamento para sala_cafe"
```

---

## Task 3: Update Cadastro Endpoint to Accept Categoria

**Files:**
- Modify: `worker/src/routes/usuarios.ts`

- [ ] **Step 1: Update cadastro handler**

In `worker/src/routes/usuarios.ts`, add import at top:

```typescript
import { isCategoriaValida, derivarSalaCafe, type Categoria } from '../lib/categoria';
```

Replace the entire `usuarios.post('/cadastro', ...)` handler with:

```typescript
// Publico: cadastro
usuarios.post('/cadastro', async (c) => {
  const { email, senha, trigrama, saram, whatsapp, categoria } = await c.req.json<{
    email: string; senha: string; trigrama: string; saram: string; whatsapp: string; categoria: string;
  }>();

  if (!email || !senha || !trigrama || !saram || !whatsapp || !categoria) {
    return c.json({ error: 'Todos os campos são obrigatórios' }, 400);
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

  const existEmail = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?').bind(emailClean).first();
  if (existEmail) return c.json({ error: 'Email já cadastrado' }, 409);

  const existTrigrama = await c.env.DB.prepare('SELECT id FROM usuarios WHERE trigrama = ?').bind(trigramaClean).first();
  if (existTrigrama) return c.json({ error: 'Trigrama já cadastrado' }, 409);

  const existSaram = await c.env.DB.prepare('SELECT id FROM usuarios WHERE saram = ?').bind(saramClean).first();
  if (existSaram) return c.json({ error: 'SARAM já cadastrado' }, 409);

  const senhaHash = await hashPassword(senha);
  const whatsappClean = whatsapp.trim();
  const salaCafe = derivarSalaCafe(categoria as Categoria);

  const { results } = await c.env.DB.prepare(
    'INSERT INTO usuarios (email, senha_hash, trigrama, saram, whatsapp, categoria, sala_cafe) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id'
  ).bind(emailClean, senhaHash, trigramaClean, saramClean, whatsappClean, categoria, salaCafe).all<{ id: number }>();

  const userId = results[0].id;

  const existCliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigramaClean).first();

  if (!existCliente) {
    await c.env.DB.prepare(
      'INSERT INTO clientes (nome_guerra, whatsapp) VALUES (?, ?)'
    ).bind(trigramaClean, whatsappClean).run();
  } else {
    await c.env.DB.prepare('UPDATE clientes SET whatsapp = ? WHERE nome_guerra = ? COLLATE NOCASE')
      .bind(whatsappClean, trigramaClean).run();
  }

  const token = await sign(
    { tipo: 'usuario', id: userId, email: emailClean, trigrama: trigramaClean },
    c.env.JWT_SECRET,
    720
  );

  return c.json({
    token,
    user: { id: userId, email: emailClean, trigrama: trigramaClean, saram: saramClean, whatsapp: whatsappClean, foto_url: null, categoria, sala_cafe: salaCafe }
  }, 201);
});
```

- [ ] **Step 2: Update login handler to return categoria**

Find `usuarios.post('/login', ...)` and replace the SELECT and response:

Change the `.bind(email...).first<{...}>()` type to:

```typescript
.first<{
  id: number; email: string; senha_hash: string; trigrama: string; saram: string; whatsapp: string; foto_url: string | null; ativo: number; categoria: string; sala_cafe: string | null;
}>();
```

And change the SELECT query:

```typescript
  const user = await c.env.DB.prepare(
    'SELECT id, email, senha_hash, trigrama, saram, whatsapp, foto_url, ativo, categoria, sala_cafe FROM usuarios WHERE email = ?'
  ).bind(email.trim().toLowerCase()).first<{
    id: number; email: string; senha_hash: string; trigrama: string; saram: string; whatsapp: string; foto_url: string | null; ativo: number; categoria: string; sala_cafe: string | null;
  }>();
```

And at the end change the response to include categoria/sala_cafe:

```typescript
  return c.json({
    token,
    user: { id: user.id, email: user.email, trigrama: user.trigrama, saram: user.saram, whatsapp: user.whatsapp, foto_url: user.foto_url, categoria: user.categoria, sala_cafe: user.sala_cafe }
  });
```

- [ ] **Step 3: Update /me endpoint to include categoria**

Find `usuarios.get('/me', ...)` and replace the SELECT:

```typescript
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first();
```

And the final GET in `/me` update handler too:

```typescript
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first();
  return c.json(user);
```

- [ ] **Step 4: Typecheck**

```bash
cd worker && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/usuarios.ts
git commit -m "feat: cadastro/login/me aceitam e retornam categoria + sala_cafe"
```

---

## Task 4: Dashboard Endpoint

**Files:**
- Modify: `worker/src/routes/usuarios.ts`

- [ ] **Step 1: Add dashboard endpoint before the admin routes**

In `worker/src/routes/usuarios.ts`, locate the line `// Admin: listar usuarios` and insert this new endpoint right before it:

```typescript
// Usuario logado: dashboard
usuarios.get('/me/dashboard', userAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const trigrama = c.get('userTrigrama');

  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, created_at FROM usuarios WHERE id = ?'
  ).bind(userId).first();
  if (!user) return c.json({ error: 'Usuário não encontrado' }, 404);

  // Find cliente id
  const cliente = await c.env.DB.prepare(
    'SELECT id FROM clientes WHERE nome_guerra = ? COLLATE NOCASE'
  ).bind(trigrama).first<{ id: string }>();

  let debitoTotal = 0;
  let ultimosPedidos: unknown[] = [];

  if (cliente) {
    // Debito total: fiado + pix pendente
    const debitoRow = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE cliente_id = ? AND status IN ('fiado', 'pendente')"
    ).bind(cliente.id).first<{ total: number }>();
    debitoTotal = debitoRow?.total || 0;

    // Ultimos 5 pedidos com resumo
    const { results } = await c.env.DB.prepare(`
      SELECT p.id, p.total, p.status, p.metodo_pagamento, p.created_at, p.paid_at,
        GROUP_CONCAT(ip.nome_produto || ' x' || ip.quantidade, ', ') as itens_resumo
      FROM pedidos p
      LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
      WHERE p.cliente_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `).bind(cliente.id).all();
    ultimosPedidos = results;
  }

  // Cafe status
  type CafeStatus = { mes_atual: string; pago: boolean; valor: number | null; tem_assinatura: boolean };
  let cafeStatus: CafeStatus | null = null;

  if (user.sala_cafe && cliente) {
    const now = new Date();
    const mesAtual = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const assinante = await c.env.DB.prepare(
      "SELECT id, valor FROM cafe_assinantes WHERE cliente_id = ? AND tipo = ? AND ativo = 1"
    ).bind(cliente.id, user.sala_cafe === 'oficiais' ? 'oficial' : 'graduado').first<{ id: string; valor: number }>();

    if (!assinante) {
      cafeStatus = { mes_atual: mesAtual, pago: false, valor: null, tem_assinatura: false };
    } else {
      const pag = await c.env.DB.prepare(
        "SELECT status, valor FROM cafe_pagamentos WHERE assinante_id = ? AND referencia = ?"
      ).bind(assinante.id, mesAtual).first<{ status: string; valor: number }>();

      cafeStatus = {
        mes_atual: mesAtual,
        pago: pag?.status === 'pago',
        valor: pag?.valor ?? assinante.valor,
        tem_assinatura: true,
      };
    }
  }

  return c.json({
    user,
    debito_total: debitoTotal,
    ultimos_pedidos: ultimosPedidos,
    cafe_status: cafeStatus,
  });
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
git commit -m "feat: endpoint dashboard do usuario (debito, pedidos, cafe status)"
```

---

## Task 5: Admin Categoria Endpoint

**Files:**
- Modify: `worker/src/routes/usuarios.ts`

- [ ] **Step 1: Add admin endpoint for updating categoria**

In `worker/src/routes/usuarios.ts`, after the `usuarios.put('/admin/:id/senha', ...)` handler, add:

```typescript
// Admin: atualizar categoria do usuario (recalcula sala_cafe)
usuarios.put('/admin/:id/categoria', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { categoria } = await c.req.json<{ categoria: string }>();

  if (!isCategoriaValida(categoria)) {
    return c.json({ error: 'Categoria inválida' }, 400);
  }

  const salaCafe = derivarSalaCafe(categoria as Categoria);

  const result = await c.env.DB.prepare(
    'UPDATE usuarios SET categoria = ?, sala_cafe = ? WHERE id = ?'
  ).bind(categoria, salaCafe, id).run();

  if (!result.meta.changes) return c.json({ error: 'Usuário não encontrado' }, 404);
  return c.json({ ok: true, categoria, sala_cafe: salaCafe });
});

// Admin: buscar usuario pelo trigrama (usado na tela do cliente)
usuarios.get('/admin/por-trigrama/:trigrama', authMiddleware, async (c) => {
  const trigrama = c.req.param('trigrama').toUpperCase();
  const user = await c.env.DB.prepare(
    'SELECT id, email, trigrama, saram, whatsapp, foto_url, categoria, sala_cafe, ativo, created_at FROM usuarios WHERE trigrama = ? COLLATE NOCASE'
  ).bind(trigrama).first();

  if (!user) return c.json(null);
  return c.json(user);
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
git commit -m "feat: admin pode alterar categoria e buscar usuario por trigrama"
```

---

## Task 6: Frontend Usuario Type + Auth Store

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/hooks/useUserAuth.ts`

- [ ] **Step 1: Extend Usuario type**

In `app/src/types/index.ts`, replace the Usuario interface with:

```typescript
export type Categoria = 'oficial' | 'graduado' | 'praca';
export type SalaCafe = 'oficiais' | 'graduados' | null;

export interface Usuario {
  id: number;
  email: string;
  trigrama: string;
  saram: string;
  whatsapp: string;
  foto_url: string | null;
  categoria: Categoria;
  sala_cafe: SalaCafe;
  created_at?: string;
}
```

- [ ] **Step 2: Update useUserAuth cadastro signature**

In `app/src/hooks/useUserAuth.ts`, replace the `CadastroData` interface:

```typescript
interface CadastroData {
  email: string;
  senha: string;
  trigrama: string;
  saram: string;
  whatsapp: string;
  categoria: 'oficial' | 'graduado' | 'praca';
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/types/index.ts app/src/hooks/useUserAuth.ts
git commit -m "feat: tipos frontend com categoria e sala_cafe"
```

---

## Task 7: Cadastro Page — Categoria Selector

**Files:**
- Modify: `app/src/pages/UserCadastro.tsx`

- [ ] **Step 1: Add categoria state and selector**

In `app/src/pages/UserCadastro.tsx`:

Add to imports at top (if not already there):
```typescript
import type { Categoria } from '../types';
```

After the other `useState` declarations (near the top of the component), add:

```typescript
  const [categoria, setCategoria] = useState<Categoria | ''>('');
```

In the `handleSubmit` function, add validation before the trigrama check:

```typescript
    if (!categoria) {
      setErro('Selecione sua categoria militar');
      return;
    }
```

And add `categoria` to the `cadastrar({...})` call payload:

```typescript
      await cadastrar({
        email: email.trim(),
        senha,
        trigrama: trigramaClean,
        saram: saram.trim(),
        whatsapp: whatsapp.trim(),
        categoria,
      });
```

Now add the selector UI. In the JSX, insert this block right BEFORE the email input (before `<label>Email</label>`):

```typescript
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Categoria Militar</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'oficial', label: 'Oficial' },
                { v: 'graduado', label: 'Graduado/SO' },
                { v: 'praca', label: 'Praça' },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setCategoria(opt.v)}
                  className={`py-3 px-2 rounded-xl text-sm font-medium border transition-all
                    ${categoria === opt.v
                      ? 'bg-azul text-white border-azul shadow-sm'
                      : 'bg-white text-texto-fraco border-borda hover:border-azul/50'}
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
```

- [ ] **Step 2: Build to check for errors**

```bash
cd app && npm run build 2>&1 | tail -10
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/UserCadastro.tsx
git commit -m "feat: seletor de categoria militar no cadastro"
```

---

## Task 8: Dashboard Page

**Files:**
- Create: `app/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create Dashboard component**

```typescript
// app/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { api } from '../services/api';
import { useUserAuth } from '../hooks/useUserAuth';
import type { Usuario } from '../types';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

interface PedidoResumo {
  id: string;
  total: number;
  status: string;
  metodo_pagamento: string;
  created_at: string;
  paid_at: string | null;
  itens_resumo: string | null;
}

interface CafeStatus {
  mes_atual: string;
  pago: boolean;
  valor: number | null;
  tem_assinatura: boolean;
}

interface DashboardData {
  user: Usuario;
  debito_total: number;
  ultimos_pedidos: PedidoResumo[];
  cafe_status: CafeStatus | null;
}

const CATEGORIA_LABEL: Record<string, string> = {
  oficial: 'Oficial',
  graduado: 'Graduado/SO',
  praca: 'Praça',
};

function formatData(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, hoje)) return 'hoje';
  if (sameDay(d, ontem)) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function Dashboard() {
  const { user } = useUserAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/api/usuarios/me/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  return (
    <AppLayout>
      {/* Saudacao */}
      <div className="flex items-center gap-3 mb-6">
        {resolveImg(user.foto_url) ? (
          <img src={resolveImg(user.foto_url)!} alt={user.trigrama} className="w-14 h-14 rounded-full object-cover border-2 border-borda" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-azul/10 flex items-center justify-center font-display text-azul text-lg">
            {user.trigrama}
          </div>
        )}
        <div>
          <div className="text-lg font-display text-texto tracking-wider">Bem-vindo, {user.trigrama}</div>
          <div className="text-xs text-texto-fraco">{CATEGORIA_LABEL[user.categoria] || user.categoria}</div>
        </div>
      </div>

      {loading && <div className="text-center py-10 text-texto-fraco">Carregando...</div>}

      {!loading && data && (
        <>
          {/* Card Cafe */}
          <div className="bg-white rounded-2xl border border-borda p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-texto-fraco">Caixinha do Café</div>
              {data.cafe_status?.tem_assinatura && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  data.cafe_status.pago
                    ? 'bg-green-100 text-verde-escuro'
                    : 'bg-red-50 text-vermelho'
                }`}>
                  {data.cafe_status.pago ? 'Pago' : 'Pendente'}
                </span>
              )}
            </div>

            {!user.sala_cafe && (
              <p className="text-sm text-texto-fraco">Você não participa de caixinha do café.</p>
            )}

            {user.sala_cafe && data.cafe_status && !data.cafe_status.tem_assinatura && (
              <p className="text-sm text-texto-fraco">Você ainda não assinou a caixinha. Procure o administrador da sua cantina.</p>
            )}

            {user.sala_cafe && data.cafe_status?.tem_assinatura && (
              <div>
                <div className="text-2xl font-display text-azul tracking-wider">
                  R$ {(data.cafe_status.valor || 0).toFixed(2)}
                </div>
                <div className="text-xs text-texto-fraco mt-1">
                  Referência: {data.cafe_status.mes_atual}
                </div>
                {!data.cafe_status.pago && (
                  <Link to="/cafe" className="inline-block mt-3 text-sm text-azul font-medium hover:underline">
                    Ver detalhes →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Card Debito */}
          <div className="bg-white rounded-2xl border border-borda p-4 mb-4 shadow-sm">
            <div className="text-sm font-medium text-texto-fraco mb-2">Débito Total (Cantina)</div>
            <div className={`text-2xl font-display tracking-wider ${data.debito_total > 0 ? 'text-vermelho' : 'text-verde-escuro'}`}>
              R$ {data.debito_total.toFixed(2)}
            </div>
            {data.debito_total === 0 && (
              <div className="text-xs text-texto-fraco mt-1">Sem pendências 🎉</div>
            )}
          </div>

          {/* Ultimos pedidos */}
          <div className="bg-white rounded-2xl border border-borda p-4 mb-4 shadow-sm">
            <div className="text-sm font-medium text-texto-fraco mb-3">Últimos Pedidos</div>
            {data.ultimos_pedidos.length === 0 ? (
              <p className="text-sm text-texto-fraco text-center py-3">Nenhum pedido ainda</p>
            ) : (
              <div className="space-y-2">
                {data.ultimos_pedidos.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-borda last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.itens_resumo || 'Pedido'}</div>
                      <div className="text-xs text-texto-fraco">
                        {formatData(p.created_at)} · {p.status}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-azul ml-3">
                      R$ {p.total.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Atalhos */}
          <div className="grid grid-cols-2 gap-3">
            <Link to="/catalogo/oficiais" className="bg-white rounded-xl border border-borda p-4 shadow-sm hover:border-azul transition-colors text-center">
              <div className="font-display text-azul tracking-wider text-sm">Cantina dos Oficiais</div>
            </Link>
            <Link to="/catalogo/graduados" className="bg-white rounded-xl border border-borda p-4 shadow-sm hover:border-vermelho transition-colors text-center">
              <div className="font-display text-vermelho tracking-wider text-sm">Cantina dos Graduados</div>
            </Link>
            {user.sala_cafe && (
              <Link to="/cafe" className="bg-white rounded-xl border border-borda p-4 shadow-sm hover:border-azul transition-colors text-center">
                <div className="font-display text-texto tracking-wider text-sm">Meu Café</div>
              </Link>
            )}
            <Link to="/perfil" className="bg-white rounded-xl border border-borda p-4 shadow-sm hover:border-azul transition-colors text-center">
              <div className="font-display text-texto tracking-wider text-sm">Meu Perfil</div>
            </Link>
          </div>
        </>
      )}
    </AppLayout>
  );
}
```

- [ ] **Step 2: Build to check**

```bash
cd app && npm run build 2>&1 | tail -10
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/Dashboard.tsx
git commit -m "feat: Dashboard do usuario com cafe, debito e pedidos"
```

---

## Task 9: Home Conditional Render

**Files:**
- Modify: `app/src/pages/Home.tsx`

- [ ] **Step 1: Update Home to render Dashboard when logged in, and rename Sala to Cantina in defaults**

Replace `app/src/pages/Home.tsx` entirely:

```typescript
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { api } from '../services/api';
import { useUserAuth } from '../hooks/useUserAuth';
import { Dashboard } from './Dashboard';

type Sistema = 'guloseimas' | 'loja' | 'cafe';

const SISTEMAS: { id: Sistema; label: string }[] = [
  { id: 'guloseimas', label: 'Cantinas' },
  { id: 'loja', label: 'Loja' },
  { id: 'cafe', label: 'Caixinha do Café' },
];

export function Home() {
  const { user } = useUserAuth();
  const [sistema, setSistema] = useState<Sistema>('guloseimas');
  const [nomes, setNomes] = useState({
    nome_sala_oficiais: 'Cantina dos Oficiais',
    nome_sala_graduados: 'Cantina dos Graduados',
    nome_cafe_oficiais: 'Cantina dos Oficiais',
    nome_cafe_graduados: 'Sala do Lange'
  });
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Record<string, string>>('/api/config').then((c) => setNomes((n) => ({ ...n, ...c }))).catch(() => {});
  }, []);

  // Se logado, renderiza Dashboard
  if (user) return <Dashboard />;

  const selecionarSistema = (s: Sistema) => {
    if (s === 'loja') { navigate('/loja'); return; }
    setSistema(s);
  };

  return (
    <AppLayout>
      <div className="py-6 animate-fade-in">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="1/10 GpAv" className="w-28 h-28 mx-auto mb-5 object-contain" />
          <h1 className="font-display text-3xl sm:text-4xl text-azul tracking-wider">SENTA PUA</h1>
          <div className="w-16 h-[2px] bg-azul mx-auto mt-4" />
        </div>

        <div className="flex gap-1 bg-white rounded-2xl p-1.5 border border-borda shadow-sm mb-8 max-w-sm mx-auto">
          {SISTEMAS.map((s) => (
            <button
              key={s.id}
              onClick={() => selecionarSistema(s.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-medium transition-all ${
                sistema === s.id
                  ? 'bg-azul text-white shadow-md'
                  : 'text-texto-fraco hover:bg-fundo'
              }`}
            >
              <span className="leading-tight">{s.label}</span>
            </button>
          ))}
        </div>

        {sistema === 'guloseimas' && (
          <div className="space-y-4 max-w-sm mx-auto animate-fade-in">
            <p className="text-texto-fraco text-sm text-center mb-2">Escolha a cantina</p>
            <Link
              to="/catalogo/oficiais"
              className="group block bg-white rounded-2xl p-5 border border-borda hover:border-azul shadow-sm transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <img src="/sabre.png" alt="" className="w-10 h-10 object-contain" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg sm:text-xl text-azul tracking-wide uppercase">{nomes.nome_sala_oficiais}</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-azul group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </Link>

            <Link
              to="/catalogo/graduados"
              className="group block bg-white rounded-2xl p-5 border border-borda hover:border-vermelho shadow-sm transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <img src="/sabre.png" alt="" className="w-10 h-10 object-contain" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg sm:text-xl text-vermelho tracking-wide uppercase">{nomes.nome_sala_graduados}</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-vermelho group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </Link>
          </div>
        )}

        {sistema === 'cafe' && (
          <div className="space-y-4 max-w-sm mx-auto animate-fade-in">
            <p className="text-texto-fraco text-sm text-center mb-2">Escolha sua sala</p>
            <Link
              to="/cafe?sala=oficial"
              className="group block bg-white rounded-2xl p-5 border border-borda hover:border-azul shadow-sm transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <img src="/sabre.png" alt="" className="w-10 h-10 object-contain" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg sm:text-xl text-azul tracking-wide uppercase">{nomes.nome_cafe_oficiais}</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-azul group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </Link>

            <Link
              to="/cafe?sala=graduado"
              className="group block bg-white rounded-2xl p-5 border border-borda hover:border-vermelho shadow-sm transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <img src="/sabre.png" alt="" className="w-10 h-10 object-contain" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg sm:text-xl text-vermelho tracking-wide uppercase">{nomes.nome_cafe_graduados}</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-vermelho group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/Home.tsx
git commit -m "feat: Home renderiza Dashboard quando logado + renomear Sala para Cantina"
```

---

## Task 10: Cafe Page Redirect for Logged Users

**Files:**
- Modify: `app/src/pages/CafePublico.tsx`

- [ ] **Step 1: Read current file to preserve logic**

Read `app/src/pages/CafePublico.tsx` in full. We'll add logic at the top of the component to redirect logged users.

- [ ] **Step 2: Modify to handle logged-in user**

In `app/src/pages/CafePublico.tsx`, find the import block and add:

```typescript
import { useUserAuth } from '../hooks/useUserAuth';
import { Link } from 'react-router-dom';
```

(If `Link` is already imported, don't duplicate.)

Inside the `CafePublico` component function body, right after the existing hook calls (e.g., after `useSearchParams`), add:

```typescript
  const { user } = useUserAuth();

  // Se logado, forca sala do usuario
  const salaForcada = user?.sala_cafe
    ? (user.sala_cafe === 'oficiais' ? 'oficial' : 'graduado')
    : null;

  // Se Praça (user sem sala_cafe), mostra mensagem
  if (user && !user.sala_cafe) {
    return (
      <AppLayout>
        <div className="max-w-sm mx-auto py-16 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-fundo flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl text-azul tracking-wider mb-3">SEM CAIXINHA</h1>
          <p className="text-texto-fraco text-sm mb-8">Como Praça, você não participa de caixinha do café. Você pode comprar normalmente nas cantinas.</p>
          <Link to="/" className="inline-block text-azul font-medium hover:underline">Voltar para o início</Link>
        </div>
      </AppLayout>
    );
  }
```

Now find where the current code reads the `sala` query param. The existing code likely does something like:

```typescript
const salaParam = searchParams.get('sala');
```

Replace the line that decides which sala to use. Find the variable that holds the sala (it might be called `sala` or `salaSelecionada`) and make it fall back to `salaForcada` when the user is logged in.

Specifically, if the existing code has:

```typescript
const sala = searchParams.get('sala') === 'oficial' ? 'oficial' : 'graduado';
```

Change it to:

```typescript
const sala = salaForcada || (searchParams.get('sala') === 'oficial' ? 'oficial' : 'graduado');
```

If the variable name or logic differs, adapt the pattern: the user's forced sala always wins when present.

- [ ] **Step 3: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

Expected: successful build. If it fails because the pattern doesn't match, inspect the actual sala logic and adapt.

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/CafePublico.tsx
git commit -m "feat: CafePublico forca sala do usuario logado, mensagem para Praca"
```

---

## Task 11: Admin — Clientes List with Account Indicator

**Files:**
- Modify: `worker/src/routes/clientes.ts`
- Modify: `app/src/pages/admin/Clientes.tsx`

- [ ] **Step 1: Update backend to include usuario info**

Open `worker/src/routes/clientes.ts`. Find the admin listing query (the main `GET /` endpoint — admin protected). It uses a SELECT on clientes. Add LEFT JOIN with usuarios.

Locate the SELECT statement in the main GET handler and change the FROM/SELECT to include usuario fields. For example, if it currently says:

```typescript
SELECT c.*, ... FROM clientes c
```

Change to:

```typescript
SELECT c.*,
  u.id as usuario_id,
  u.categoria as usuario_categoria,
  u.ativo as usuario_ativo
FROM clientes c
LEFT JOIN usuarios u ON u.trigrama = c.nome_guerra COLLATE NOCASE
```

Keep all the rest of the query (WHERE clauses, GROUP BY, ORDER BY) intact.

If the endpoint uses multiple queries or doesn't have a direct SELECT like this, find where the final list is built and enrich it with a separate query mapping trigrama → usuario data.

- [ ] **Step 2: Update Cliente type in frontend**

In `app/src/types/index.ts`, extend the `Cliente` interface (do not remove existing fields):

Add these optional fields to the existing Cliente interface:

```typescript
  usuario_id?: number | null;
  usuario_categoria?: string | null;
  usuario_ativo?: number | null;
```

- [ ] **Step 3: Show account indicator in Clientes list**

In `app/src/pages/admin/Clientes.tsx`, find where clients are rendered in a list/table. Near the trigrama/nome_guerra display, add a small badge indicating if the client has an account.

Find a representative row render (e.g., a `<div>` or `<tr>` rendering each client). Add this snippet inside the row, in a visually appropriate location:

```typescript
  {cliente.usuario_id && (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-verde-escuro ml-2">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      Conta
    </span>
  )}
```

Adapt placement if the component uses a specific layout. The key is: when `cliente.usuario_id` is truthy, show the badge.

- [ ] **Step 4: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

Expected: successful build.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/clientes.ts app/src/types/index.ts app/src/pages/admin/Clientes.tsx
git commit -m "feat: listagem de militares mostra quem tem conta"
```

---

## Task 12: Admin — ContaMilitar Component

**Files:**
- Create: `app/src/components/admin/ContaMilitar.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/src/components/admin/ContaMilitar.tsx
import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import type { Usuario, Categoria } from '../../types';

interface Props {
  trigrama: string;
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  oficial: 'Oficial',
  graduado: 'Graduado/SO',
  praca: 'Praça',
};

export function ContaMilitar({ trigrama }: Props) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [mostrandoSenha, setMostrandoSenha] = useState(false);

  const carregar = async () => {
    try {
      const u = await api.get<Usuario | null>(`/api/usuarios/admin/por-trigrama/${trigrama}`);
      setUser(u);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, [trigrama]);

  const trocarCategoria = async (cat: Categoria) => {
    if (!user) return;
    setErro(''); setMsg('');
    try {
      await api.put(`/api/usuarios/admin/${user.id}/categoria`, { categoria: cat });
      setMsg(`Categoria alterada para ${CATEGORIA_LABEL[cat]}`);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao alterar');
    }
  };

  const resetarSenha = async () => {
    if (!user || novaSenha.length < 6) {
      setErro('Senha deve ter no minimo 6 caracteres');
      return;
    }
    setErro(''); setMsg('');
    try {
      await api.put(`/api/usuarios/admin/${user.id}/senha`, { nova_senha: novaSenha });
      setMsg('Senha resetada com sucesso');
      setNovaSenha('');
      setMostrandoSenha(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao resetar senha');
    }
  };

  const toggleAtivo = async () => {
    if (!user) return;
    setErro(''); setMsg('');
    const endpoint = user.ativo === 1 ? 'desativar' : 'ativar';
    try {
      await api.put(`/api/usuarios/admin/${user.id}/${endpoint}`, {});
      setMsg(user.ativo === 1 ? 'Conta desativada' : 'Conta reativada');
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao alterar status');
    }
  };

  if (loading) return <div className="bg-white rounded-xl border border-borda p-4 text-center text-sm text-texto-fraco">Carregando conta...</div>;

  if (!user) return (
    <div className="bg-white rounded-xl border border-borda p-4 text-center text-sm text-texto-fraco">
      Este militar ainda não tem conta de usuário cadastrada.
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-borda p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-texto-fraco">Email</div>
          <div className="font-medium text-sm">{user.email}</div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.ativo === 1 ? 'bg-green-100 text-verde-escuro' : 'bg-red-50 text-vermelho'}`}>
          {user.ativo === 1 ? 'Ativa' : 'Desativada'}
        </span>
      </div>

      <div>
        <div className="text-xs text-texto-fraco mb-2">Categoria</div>
        <div className="grid grid-cols-3 gap-2">
          {(['oficial', 'graduado', 'praca'] as Categoria[]).map(cat => (
            <button
              key={cat}
              onClick={() => trocarCategoria(cat)}
              className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all
                ${user.categoria === cat
                  ? 'bg-azul text-white border-azul'
                  : 'bg-white text-texto-fraco border-borda hover:border-azul/50'}
              `}
            >
              {CATEGORIA_LABEL[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-borda">
        {!mostrandoSenha ? (
          <Button variant="outline" size="sm" onClick={() => setMostrandoSenha(true)}>Resetar senha</Button>
        ) : (
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Nova senha"
              className="flex-1 bg-white border border-borda rounded-lg px-3 py-2 text-sm"
            />
            <Button size="sm" onClick={resetarSenha}>OK</Button>
            <Button variant="ghost" size="sm" onClick={() => { setMostrandoSenha(false); setNovaSenha(''); }}>×</Button>
          </div>
        )}
        <Button variant={user.ativo === 1 ? 'danger' : 'primary'} size="sm" onClick={toggleAtivo}>
          {user.ativo === 1 ? 'Desativar' : 'Reativar'}
        </Button>
      </div>

      {msg && <p className="text-verde text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}
      {erro && <p className="text-vermelho text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/admin/ContaMilitar.tsx
git commit -m "feat: componente ContaMilitar para gestao admin de conta"
```

---

## Task 13: Admin — Embed ContaMilitar in ClienteExtrato

**Files:**
- Modify: `app/src/pages/admin/ClienteExtrato.tsx`

- [ ] **Step 1: Import and render ContaMilitar**

In `app/src/pages/admin/ClienteExtrato.tsx`:

Add to imports:

```typescript
import { ContaMilitar } from '../../components/admin/ContaMilitar';
```

Find where the cliente info is rendered (likely at the top of the page after loading `data`). After the main cliente header/info block (and before the tabs), add:

```typescript
  {data && (
    <div className="mb-5">
      <h2 className="text-sm font-medium text-texto-fraco mb-2">Conta de Usuário</h2>
      <ContaMilitar trigrama={data.cliente.nome_guerra} />
    </div>
  )}
```

Place it in a location that makes visual sense — after the page title but before the tabs section. Look for an `<h1>` or similar heading that shows the cliente name, then insert the block after that section.

- [ ] **Step 2: Build**

```bash
cd app && npm run build 2>&1 | tail -10
```

Expected: successful build.

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/admin/ClienteExtrato.tsx
git commit -m "feat: ClienteExtrato mostra secao de conta de usuario"
```

---

## Task 14: Deploy

- [ ] **Step 1: Final typecheck + build**

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

- [ ] **Step 5: Manual smoke test**

Open `https://app-senta-pua.pages.dev` and test:

1. Logado como usuario:
   - `/` renderiza Dashboard (foto + trigrama + categoria, cards cafe/debito/pedidos/atalhos)
   - `/cafe` vai direto pra sala correta (ou mostra mensagem se Praca)
2. Deslogado:
   - `/` mostra home publica com tabs Cantinas/Loja/Caixinha
   - Textos mostram "Cantina" em vez de "Sala"
3. Novo cadastro:
   - Campo categoria aparece antes do email
   - Praca nao aparece botao Meu Cafe no dashboard
   - Oficial/Graduado sao enviados automaticamente para a sala correta
4. Admin:
   - `/admin/clientes` mostra badge "Conta" em militares com conta
   - `/admin/clientes/:id` mostra secao "Conta de Usuário" com categoria editavel, resetar senha, desativar
