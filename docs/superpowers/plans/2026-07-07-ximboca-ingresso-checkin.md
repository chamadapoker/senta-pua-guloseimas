# Ximboca — Ingresso com QR + Check-in de portaria — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao Ximboca tipos de ingresso com preços diferentes, ingresso individual com QR por participante pago, capa de evento, e check-in de portaria operado por militares logados com o papel **recepcionista** (vários podem ter).

**Architecture:** Backend Hono/D1 em `worker/src/routes/ximboca.ts` — as rotas de check-in usam um `recepcionistaMiddleware` (userAuthMiddleware + flag `is_recepcionista`) e ficam **antes** do `ximboca.use('*', authMiddleware)` (linha ~104, que é do admin). O papel recepcionista é um flag em `usuarios`, gerido na tela admin de usuários. Frontend React/Vite: ampliar telas admin e pública, e criar `/checkin` sob `RecepcionistaGuard`. QR gerado com `qrcode.react` (já existe) e lido com `html5-qrcode` (novo).

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind + React Router · Cloudflare Workers + Hono + D1 (SQLite) + R2 · `qrcode.react`, `html5-qrcode`.

## Global Constraints

- **Sem test runner no projeto.** Verificação por task:
  - Frontend: `pnpm build:app` (na raiz) — passa sem erro TS.
  - Worker: `cd worker && npx wrangler deploy --dry-run --outdir dist` — compila sem erro (não faz deploy).
- **Deploy automático** via GitHub Actions ao push em `main`. Migrations D1 aplicadas com `wrangler d1 execute` **após** a conta Cloudflare correta estar logada (ver nota final).
- **Copy em português.** Dinheiro `R$ 0.00` (`.toFixed(2)`). Datas `new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')`.
- **Reusar primitivos:** `api` (`app/src/services/api.ts`), `inputClass` (`components/ui/Field`), `Modal`, `Button`, `Badge`, `Icon`, `AppLayout`, `Loading`, `QRCodeCanvas`.
- **Padrão de papel:** `is_recepcionista` segue exatamente o padrão de `permite_fiado`/`is_visitante` em `usuarios` (endpoint `PUT /api/usuarios/admin/:id/fiado` como referência).
- **Nome do participante = trigrama** (`userTrigrama`). Ids = hex de 32 chars.
- **Versão:** ao final, `app/package.json` de `1.0.20` → `1.0.21`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `worker/src/db/migrations/029_ximboca_ingressos.sql` | Schema: tipos, colunas de check-in, capa, papel recepcionista | Criar |
| `worker/src/routes/ximboca.ts` | Tipos CRUD, participar/meus-eventos, capa, stats, check-in (recepcionista) | Modificar |
| `worker/src/routes/usuarios.ts` | Toggle `is_recepcionista` + incluir flag em lista/me/login | Modificar |
| `app/src/types/index.ts` | `is_recepcionista?` no tipo `Usuario` | Modificar |
| `app/src/services/api.ts` | Rotas `/api/ximboca/checkin` usam `user_token` | Modificar |
| `app/src/pages/admin/ximboca/XimbocaEvento.tsx` | Admin: tipos, capa, contador de entradas | Modificar |
| `app/src/pages/admin/Usuarios.tsx` | Toggle Recepcionista por usuário | Modificar |
| `app/src/pages/XimbocaPublica.tsx` | Escolher tipo + card de ingresso com QR | Modificar |
| `app/src/pages/CheckinRecepcionista.tsx` | Tela de check-in (lista eventos + scanner + fallback) | Criar |
| `app/src/App.tsx` | Rotas `/checkin` e `/checkin/:eventoId` sob RecepcionistaGuard | Modificar |
| `app/package.json` | Dep `html5-qrcode` + bump de versão | Modificar |

---

## Task 1: Migration do banco

**Files:**
- Create: `worker/src/db/migrations/029_ximboca_ingressos.sql`

**Interfaces:**
- Produces: tabela `ximboca_ingresso_tipos(id, evento_id, nome, valor, ordem)`; `ximboca_participantes` + `tipo_ingresso_id`, `numero_ingresso`, `checkin_at`, `checkin_por`; `ximboca_eventos` + `imagem_url`; `usuarios` + `is_recepcionista`.

- [ ] **Step 1: Criar o arquivo de migration**

Criar `worker/src/db/migrations/029_ximboca_ingressos.sql`:

```sql
-- Tipos de ingresso por evento (Militar, Convidado, Crianca...)
CREATE TABLE IF NOT EXISTS ximboca_ingresso_tipos (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  evento_id  TEXT NOT NULL REFERENCES ximboca_eventos(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  valor      REAL NOT NULL,
  ordem      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ximboca_ing_tipos_evento ON ximboca_ingresso_tipos(evento_id);

-- Participante: tipo comprado, numero visivel do ingresso e dados de check-in
ALTER TABLE ximboca_participantes ADD COLUMN tipo_ingresso_id TEXT;
ALTER TABLE ximboca_participantes ADD COLUMN numero_ingresso  INTEGER;
ALTER TABLE ximboca_participantes ADD COLUMN checkin_at       TEXT;
ALTER TABLE ximboca_participantes ADD COLUMN checkin_por      TEXT;

-- Evento: capa (R2)
ALTER TABLE ximboca_eventos ADD COLUMN imagem_url TEXT;

-- Papel de recepcionista (porteiro) em usuarios
ALTER TABLE usuarios ADD COLUMN is_recepcionista INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Validar o SQL no D1 local**

Run: `cd worker && npx wrangler d1 execute senta-pua-db --local --file=src/db/migrations/029_ximboca_ingressos.sql`
Expected: `Executed N commands` sem erro.

- [ ] **Step 3: Commit**

```bash
git add worker/src/db/migrations/029_ximboca_ingressos.sql
git commit -m "feat(ximboca): migration 029 - tipos, check-in, capa e papel recepcionista"
```

---

## Task 2: Backend — tipos de ingresso (admin CRUD) + expor tipos

**Files:**
- Modify: `worker/src/routes/ximboca.ts`

**Interfaces:**
- Produces: `GET/POST /api/ximboca/eventos/:id/tipos`, `PUT/DELETE /api/ximboca/tipos/:tipoId`; `IngressoTipo = { id, evento_id, nome, valor, ordem }`. `GET /eventos/:id` passa a devolver `tipos`; `GET /publico/eventos` inclui `tipos` por evento.

- [ ] **Step 1: Adicionar os endpoints admin de tipos**

Em `worker/src/routes/ximboca.ts`, **depois** de `ximboca.use('*', authMiddleware);` (perto do fim, antes do `export default`), adicionar:

```ts
// ============ TIPOS DE INGRESSO (admin) ============
ximboca.get('/eventos/:id/tipos', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_ingresso_tipos WHERE evento_id = ? ORDER BY ordem ASC, nome ASC'
  ).bind(c.req.param('id')).all();
  return c.json(results);
});

ximboca.post('/eventos/:id/tipos', async (c) => {
  const evento_id = c.req.param('id');
  const { nome, valor, ordem } = await c.req.json<{ nome: string; valor: number; ordem?: number }>();
  if (!nome || valor == null) return c.json({ error: 'Nome e valor obrigatórios' }, 400);
  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_ingresso_tipos (evento_id, nome, valor, ordem) VALUES (?, ?, ?, ?) RETURNING *'
  ).bind(evento_id, nome.trim(), valor, ordem ?? 0).all();
  return c.json(results[0], 201);
});

ximboca.put('/tipos/:tipoId', async (c) => {
  const id = c.req.param('tipoId');
  const body = await c.req.json();
  const fields: string[] = [];
  const values: unknown[] = [];
  if ('nome' in body) { fields.push('nome = ?'); values.push(body.nome); }
  if ('valor' in body) { fields.push('valor = ?'); values.push(body.valor); }
  if ('ordem' in body) { fields.push('ordem = ?'); values.push(body.ordem); }
  if (!fields.length) return c.json({ error: 'Nada para atualizar' }, 400);
  values.push(id);
  const { results } = await c.env.DB.prepare(
    `UPDATE ximboca_ingresso_tipos SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).all();
  if (!results.length) return c.json({ error: 'Tipo não encontrado' }, 404);
  return c.json(results[0]);
});

ximboca.delete('/tipos/:tipoId', async (c) => {
  const id = c.req.param('tipoId');
  const emUso = await c.env.DB.prepare(
    'SELECT id FROM ximboca_participantes WHERE tipo_ingresso_id = ? LIMIT 1'
  ).bind(id).first();
  if (emUso) return c.json({ error: 'Tipo já usado por um participante — não pode ser removido' }, 400);
  const result = await c.env.DB.prepare('DELETE FROM ximboca_ingresso_tipos WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return c.json({ error: 'Tipo não encontrado' }, 404);
  return c.json({ ok: true });
});
```

- [ ] **Step 2: Incluir `tipos` no GET admin de evento**

No handler `ximboca.get('/eventos/:id', ...)`, antes do `return c.json({ evento, participantes, despesas });`:

```ts
  const { results: tipos } = await c.env.DB.prepare(
    'SELECT * FROM ximboca_ingresso_tipos WHERE evento_id = ? ORDER BY ordem ASC, nome ASC'
  ).bind(id).all();

  return c.json({ evento, participantes, despesas, tipos });
```

- [ ] **Step 3: Incluir `tipos` na listagem pública**

No handler `ximboca.get('/publico/eventos', ...)`, substituir o `return c.json(results);` por:

```ts
  const eventoIds = (results as { id: string }[]).map(e => e.id);
  let tiposPorEvento: Record<string, unknown[]> = {};
  if (eventoIds.length) {
    const ph = eventoIds.map(() => '?').join(',');
    const { results: tipos } = await c.env.DB.prepare(
      `SELECT * FROM ximboca_ingresso_tipos WHERE evento_id IN (${ph}) ORDER BY ordem ASC, nome ASC`
    ).bind(...eventoIds).all();
    tiposPorEvento = (tipos as { evento_id: string }[]).reduce((acc, t) => {
      (acc[t.evento_id] ||= []).push(t); return acc;
    }, {} as Record<string, unknown[]>);
  }
  return c.json((results as { id: string }[]).map(e => ({ ...e, tipos: tiposPorEvento[e.id] || [] })));
```

- [ ] **Step 4: Compilar** — Run: `cd worker && npx wrangler deploy --dry-run --outdir dist` — Expected: sem erro.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/ximboca.ts
git commit -m "feat(ximboca): CRUD de tipos de ingresso + expor tipos nas leituras"
```

---

## Task 3: Backend — inscrição com tipo + número + meus-eventos estendido

**Files:**
- Modify: `worker/src/routes/ximboca.ts`

**Interfaces:**
- `POST /publico/eventos/:id/participar` aceita `{ categoria_consumo?, tipo_ingresso_id? }`; grava `valor_individual`, `tipo_ingresso_id`, `numero_ingresso`.
- `GET /publico/meus-eventos` retorna também `numero_ingresso`, `tipo_nome`, `checkin_at`, `imagem_url`.

- [ ] **Step 1: Alterar o handler `participar`**

Substituir o corpo de `ximboca.post('/publico/eventos/:id/participar', ...)` por:

```ts
ximboca.post('/publico/eventos/:id/participar', userAuthMiddleware, visitorActiveCheck, async (c) => {
  const eventoId = c.req.param('id');
  const trigrama = c.get('userTrigrama');
  const { categoria_consumo, tipo_ingresso_id } = await c.req.json<{ categoria_consumo?: string; tipo_ingresso_id?: string }>();

  const userId = c.get('userId');
  const user = await c.env.DB.prepare('SELECT whatsapp FROM usuarios WHERE id = ?').bind(userId).first<{ whatsapp: string }>();
  const whatsapp = user?.whatsapp || null;

  const evento = await c.env.DB.prepare(
    'SELECT id, status, valor_por_pessoa, valor_cerveja, valor_refri FROM ximboca_eventos WHERE id = ?'
  ).bind(eventoId).first<{ id: string; status: string; valor_por_pessoa: number; valor_cerveja: number | null; valor_refri: number | null }>();
  if (!evento) return c.json({ error: 'Evento não encontrado' }, 404);
  if (evento.status !== 'aberto') return c.json({ error: 'Evento está fechado' }, 400);

  const exist = await c.env.DB.prepare(
    'SELECT id FROM ximboca_participantes WHERE evento_id = ? AND nome = ? COLLATE NOCASE'
  ).bind(eventoId, trigrama).first();
  if (exist) return c.json({ error: 'Você já está inscrito neste evento' }, 409);

  const cat = (categoria_consumo || 'padrao').toLowerCase();
  let valorIndividual: number | null = null;
  let tipoId: string | null = null;

  if (tipo_ingresso_id) {
    const tipo = await c.env.DB.prepare(
      'SELECT id, valor FROM ximboca_ingresso_tipos WHERE id = ? AND evento_id = ?'
    ).bind(tipo_ingresso_id, eventoId).first<{ id: string; valor: number }>();
    if (!tipo) return c.json({ error: 'Tipo de ingresso inválido' }, 400);
    valorIndividual = tipo.valor;
    tipoId = tipo.id;
  } else if (cat === 'cerveja' && evento.valor_cerveja !== null) {
    valorIndividual = evento.valor_cerveja;
  } else if (cat === 'refri' && evento.valor_refri !== null) {
    valorIndividual = evento.valor_refri;
  }

  const maxNum = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(numero_ingresso), 0) as n FROM ximboca_participantes WHERE evento_id = ?'
  ).bind(eventoId).first<{ n: number }>();
  const numeroIngresso = (maxNum?.n || 0) + 1;

  const { results } = await c.env.DB.prepare(
    'INSERT INTO ximboca_participantes (evento_id, nome, whatsapp, valor_individual, categoria_consumo, tipo_ingresso_id, numero_ingresso) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(eventoId, trigrama, whatsapp, valorIndividual, cat, tipoId, numeroIngresso).all();

  return c.json(results[0], 201);
});
```

- [ ] **Step 2: Estender `meus-eventos`**

Substituir a query de `ximboca.get('/publico/meus-eventos', ...)` por:

```ts
  const { results } = await c.env.DB.prepare(`
    SELECT e.*, p.id as participante_id, p.categoria_consumo, p.valor_individual,
           p.status as meu_status, p.paid_at, p.numero_ingresso, p.checkin_at,
           t.nome as tipo_nome
    FROM ximboca_participantes p
    JOIN ximboca_eventos e ON e.id = p.evento_id
    LEFT JOIN ximboca_ingresso_tipos t ON t.id = p.tipo_ingresso_id
    WHERE p.nome = ? COLLATE NOCASE
    ORDER BY e.data DESC
  `).bind(trigrama).all();
```

- [ ] **Step 3: Compilar** — `cd worker && npx wrangler deploy --dry-run --outdir dist` — sem erro.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/ximboca.ts
git commit -m "feat(ximboca): inscricao com tipo + numero + meus-eventos estendido"
```

---

## Task 4: Backend — capa (R2) e stats de check-in (admin)

**Files:**
- Modify: `worker/src/routes/ximboca.ts`

**Interfaces:**
- `POST /api/ximboca/eventos/:id/imagem` (multipart `file`) → `{ url }` + grava `imagem_url`.
- `GET /api/ximboca/eventos/:id/checkin-stats` → `{ total_pagos, entraram, faltam }`.

- [ ] **Step 1: Endpoints admin (após os de tipos da Task 2)**

```ts
// Upload da capa do evento (R2)
ximboca.post('/eventos/:id/imagem', async (c) => {
  const id = c.req.param('id');
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'Nenhum arquivo enviado' }, 400);
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Arquivo deve ter no máximo 5MB' }, 400);
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    return c.json({ error: 'Formato não suportado. Use: jpg, png, webp, gif' }, 400);
  }
  const key = `ximboca/${crypto.randomUUID()}.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const url = `/api/images/${key}`;
  await c.env.DB.prepare('UPDATE ximboca_eventos SET imagem_url = ? WHERE id = ?').bind(url, id).run();
  return c.json({ url });
});

// Contadores de entrada
ximboca.get('/eventos/:id/checkin-stats', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status = 'pago' THEN 1 ELSE 0 END) as total_pagos,
      SUM(CASE WHEN status = 'pago' AND checkin_at IS NOT NULL THEN 1 ELSE 0 END) as entraram
    FROM ximboca_participantes WHERE evento_id = ?
  `).bind(id).first<{ total_pagos: number | null; entraram: number | null }>();
  const total_pagos = row?.total_pagos ?? 0;
  const entraram = row?.entraram ?? 0;
  return c.json({ total_pagos, entraram, faltam: total_pagos - entraram });
});
```

- [ ] **Step 2: Incluir `imagem_url` no update de evento**

No handler `ximboca.put('/eventos/:id', ...)`, adicionar junto aos outros `if ('x' in body)`:

```ts
  if ('imagem_url' in body) { fields.push('imagem_url = ?'); values.push(body.imagem_url || null); }
```

- [ ] **Step 3: Compilar** — `cd worker && npx wrangler deploy --dry-run --outdir dist` — sem erro.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/ximboca.ts
git commit -m "feat(ximboca): upload de capa e stats de check-in"
```

---

## Task 5: Backend — papel recepcionista (usuarios.ts)

**Files:**
- Modify: `worker/src/routes/usuarios.ts`

**Interfaces:**
- `PUT /api/usuarios/admin/:id/recepcionista` body `{ is_recepcionista: 0|1 }` → `{ ok: true }`.
- `is_recepcionista` incluído no retorno de `GET /admin/lista`, `GET /me` e `POST /login`.

- [ ] **Step 1: Endpoint de toggle (espelhar o `/admin/:id/fiado`)**

Localizar `usuarios.put('/admin/:id/fiado', authMiddleware, ...)` (linha ~739) e adicionar logo depois:

```ts
usuarios.put('/admin/:id/recepcionista', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { is_recepcionista } = await c.req.json<{ is_recepcionista: number }>();
  await c.env.DB.prepare('UPDATE usuarios SET is_recepcionista = ? WHERE id = ?')
    .bind(is_recepcionista ? 1 : 0, id).run();
  return c.json({ ok: true });
});
```

- [ ] **Step 2: Incluir `is_recepcionista` nas leituras**

Em `usuarios.get('/admin/lista', ...)` (linha ~692), `usuarios.get('/me', ...)` (linha ~231) e `usuarios.post('/login', ...)` (linha ~180): adicionar `is_recepcionista` na lista de colunas do `SELECT ... FROM usuarios` e no objeto `user` retornado (ao lado de `is_visitante`/`permite_fiado`). Ex. no `/login`, na query da linha ~190 acrescentar `, is_recepcionista` ao SELECT e no objeto de resposta `is_recepcionista: user.is_recepcionista`.

- [ ] **Step 3: Compilar** — `cd worker && npx wrangler deploy --dry-run --outdir dist` — sem erro.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/usuarios.ts
git commit -m "feat(usuarios): papel recepcionista (toggle admin + expor flag)"
```

---

## Task 6: Backend — rotas de check-in do recepcionista

**Files:**
- Modify: `worker/src/routes/ximboca.ts`

**Interfaces:**
- Consumes: `userAuthMiddleware`, `checkRateLimit`/`recordAttempt`/`clientKey`.
- Produces (registradas **antes** de `ximboca.use('*', authMiddleware)`):
  - `GET /api/ximboca/checkin/eventos` → `Array<{ id, nome, data, imagem_url, total_pagos, entraram }>`
  - `GET /api/ximboca/checkin/:eventoId/lista?q=` → `Array<{ id, nome, numero_ingresso, tipo_nome, checkin_at }>`
  - `POST /api/ximboca/checkin/:eventoId/validar` body `{ participante_id }` → `{ estado, nome?, tipo_nome?, numero_ingresso?, checkin_at? }`

- [ ] **Step 1: Importar rate limit no topo**

```ts
import { checkRateLimit, recordAttempt, clientKey } from '../lib/rateLimit';
```

- [ ] **Step 2: Middleware recepcionista + rotas (inserir antes de `// ROTAS ADMIN` / `ximboca.use('*', authMiddleware)`)**

```ts
// ============ CHECK-IN (recepcionista logado) ============
async function recepcionistaMiddleware(c: import('hono').Context<AppType>, next: import('hono').Next) {
  return userAuthMiddleware(c, async () => {
    const userId = c.get('userId');
    const u = await c.env.DB.prepare('SELECT is_recepcionista FROM usuarios WHERE id = ?')
      .bind(userId).first<{ is_recepcionista: number }>();
    if (!u || u.is_recepcionista !== 1) return c.json({ error: 'Acesso restrito a recepcionistas' }, 403);
    await next();
  });
}

ximboca.get('/checkin/eventos', recepcionistaMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT e.id, e.nome, e.data, e.imagem_url,
      SUM(CASE WHEN p.status='pago' THEN 1 ELSE 0 END) as total_pagos,
      SUM(CASE WHEN p.status='pago' AND p.checkin_at IS NOT NULL THEN 1 ELSE 0 END) as entraram
    FROM ximboca_eventos e
    LEFT JOIN ximboca_participantes p ON p.evento_id = e.id
    WHERE e.status = 'aberto'
    GROUP BY e.id ORDER BY e.data ASC
  `).all();
  return c.json(results);
});

ximboca.get('/checkin/:eventoId/lista', recepcionistaMiddleware, async (c) => {
  const eventoId = c.req.param('eventoId');
  const q = `%${(c.req.query('q') || '').trim()}%`;
  const { results } = await c.env.DB.prepare(`
    SELECT p.id, p.nome, p.numero_ingresso, p.checkin_at, t.nome as tipo_nome
    FROM ximboca_participantes p
    LEFT JOIN ximboca_ingresso_tipos t ON t.id = p.tipo_ingresso_id
    WHERE p.evento_id = ? AND p.status = 'pago' AND p.nome LIKE ? COLLATE NOCASE
    ORDER BY p.nome ASC LIMIT 50
  `).bind(eventoId, q).all();
  return c.json(results);
});

ximboca.post('/checkin/:eventoId/validar', recepcionistaMiddleware, async (c) => {
  const eventoId = c.req.param('eventoId');
  const trigrama = c.get('userTrigrama');

  const rlKey = `${trigrama}:${clientKey(c)}`;
  const rl = await checkRateLimit(c, 'ximboca_checkin_fail', rlKey, 30, 15);
  if (!rl.ok) return c.json({ error: 'Muitas tentativas inválidas. Aguarde alguns minutos.' }, 429);

  const { participante_id } = await c.req.json<{ participante_id: string }>();
  const p = await c.env.DB.prepare(`
    SELECT p.evento_id, p.nome, p.status, p.checkin_at, p.numero_ingresso, t.nome as tipo_nome
    FROM ximboca_participantes p
    LEFT JOIN ximboca_ingresso_tipos t ON t.id = p.tipo_ingresso_id
    WHERE p.id = ?
  `).bind(participante_id).first<{ evento_id: string; nome: string; status: string; checkin_at: string | null; numero_ingresso: number | null; tipo_nome: string | null }>();

  if (!p || p.evento_id !== eventoId) {
    await recordAttempt(c, 'ximboca_checkin_fail', rlKey);
    return c.json({ estado: 'NAO_ENCONTRADO' });
  }
  if (p.status !== 'pago') return c.json({ estado: 'NAO_PAGO', nome: p.nome, numero_ingresso: p.numero_ingresso, tipo_nome: p.tipo_nome });
  if (p.checkin_at) return c.json({ estado: 'JA_ENTROU', nome: p.nome, numero_ingresso: p.numero_ingresso, tipo_nome: p.tipo_nome, checkin_at: p.checkin_at });

  await c.env.DB.prepare(
    "UPDATE ximboca_participantes SET checkin_at = datetime('now'), checkin_por = ? WHERE id = ?"
  ).bind(trigrama, participante_id).run();

  return c.json({ estado: 'OK', nome: p.nome, numero_ingresso: p.numero_ingresso, tipo_nome: p.tipo_nome });
});
```

Nota: o rate limit só conta tentativas inválidas (`NAO_ENCONTRADO`), então um portão movimentado nunca é bloqueado.

- [ ] **Step 3: Compilar** — `cd worker && npx wrangler deploy --dry-run --outdir dist` — sem erro.

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/ximboca.ts
git commit -m "feat(ximboca): rotas de check-in autenticadas por recepcionista logado"
```

---

## Task 7: Frontend admin — tipos, capa e contador (XimbocaEvento)

**Files:**
- Modify: `app/src/pages/admin/ximboca/XimbocaEvento.tsx`

- [ ] **Step 1: Tipos, estado e carregamento**

Adicionar interface e estender `Evento` com `imagem_url`:

```ts
interface IngressoTipo { id: string; evento_id: string; nome: string; valor: number; ordem: number; }
```

Na interface `Evento`, adicionar `imagem_url: string | null;`. Adicionar estados:

```ts
  const [tipos, setTipos] = useState<IngressoTipo[]>([]);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoValor, setNovoTipoValor] = useState('');
  const [checkinStats, setCheckinStats] = useState<{ total_pagos: number; entraram: number; faltam: number } | null>(null);
```

Estender `carregar`:

```ts
  const carregar = () => {
    api.get<{ evento: Evento; participantes: Participante[]; despesas: Despesa[]; tipos: IngressoTipo[] }>(`/api/ximboca/eventos/${id}`).then(d => {
      setEvento(d.evento);
      setParticipantes(d.participantes);
      setDespesas(d.despesas);
      setTipos(d.tipos || []);
    });
    api.get<{ total_pagos: number; entraram: number; faltam: number }>(`/api/ximboca/eventos/${id}/checkin-stats`).then(setCheckinStats).catch(() => {});
  };
```

- [ ] **Step 2: Handlers de tipo e capa**

```ts
  const adicionarTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTipoNome || !novoTipoValor) return;
    await api.post(`/api/ximboca/eventos/${id}/tipos`, { nome: novoTipoNome, valor: parseFloat(novoTipoValor), ordem: tipos.length });
    setNovoTipoNome(''); setNovoTipoValor('');
    carregar();
  };

  const removerTipo = async (tipoId: string) => {
    try { await api.delete(`/api/ximboca/tipos/${tipoId}`); carregar(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Erro ao remover'); }
  };

  const enviarCapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await api.upload(`/api/ximboca/eventos/${id}/imagem`, fd);
    carregar();
  };
```

- [ ] **Step 3: Bloco de UI — Ingressos & Portaria (após `{/* Financial summary */}`)**

```tsx
      {/* Ingressos e Portaria */}
      <div className="bg-white rounded-xl border border-borda shadow-sm mb-6">
        <div className="bg-azul px-5 py-3 rounded-t-xl">
          <h2 className="text-sm font-medium text-white uppercase tracking-wider">Ingressos & Portaria</h2>
        </div>
        <div className="p-4 space-y-5">
          <div>
            <div className="text-xs font-medium text-texto uppercase tracking-wider mb-2">Capa do evento</div>
            {evento.imagem_url && <img src={evento.imagem_url} alt="capa" className="w-full max-w-xs rounded-lg border border-borda mb-2" />}
            <label className="text-xs font-medium px-3 py-1.5 rounded-lg text-azul bg-blue-50 border border-blue-200 hover:bg-blue-100 inline-flex items-center gap-1.5 cursor-pointer">
              <Icon name="image" size={12} /> {evento.imagem_url ? 'Trocar capa' : 'Enviar capa'}
              <input type="file" accept="image/*" onChange={enviarCapa} className="hidden" />
            </label>
          </div>

          <div>
            <div className="text-xs font-medium text-texto uppercase tracking-wider mb-2">Tipos de ingresso</div>
            <div className="space-y-1 mb-2">
              {tipos.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-fundo rounded-lg px-3 py-2 text-sm">
                  <span>{t.nome} — <span className="font-medium">R$ {t.valor.toFixed(2)}</span></span>
                  <button onClick={() => removerTipo(t.id)} className="text-xs font-medium px-1.5 py-1 rounded-lg text-vermelho bg-red-50 border border-red-200 hover:bg-red-100">X</button>
                </div>
              ))}
              {tipos.length === 0 && <p className="text-xs text-texto-fraco">Sem tipos — o evento usa o valor por pessoa padrão.</p>}
            </div>
            <form onSubmit={adicionarTipo} className="flex gap-2">
              <input value={novoTipoNome} onChange={e => setNovoTipoNome(e.target.value)} className={inputClass} placeholder="Ex: Militar" />
              <input type="number" step="0.01" value={novoTipoValor} onChange={e => setNovoTipoValor(e.target.value)} className={inputClass} placeholder="Valor" />
              <Button type="submit" size="sm">+ Tipo</Button>
            </form>
          </div>

          <div>
            <div className="text-xs font-medium text-texto uppercase tracking-wider mb-1">Check-in na portaria</div>
            {checkinStats
              ? <p className="text-sm">Entraram: <span className="font-display text-azul">{checkinStats.entraram}/{checkinStats.total_pagos}</span></p>
              : <p className="text-xs text-texto-fraco">Sem pagamentos ainda.</p>}
            <p className="text-[11px] text-texto-fraco mt-1">Quem faz o check-in são os militares marcados como <b>recepcionista</b> em Admin → Usuários. Eles acessam pelo menu <b>Check-in</b>.</p>
          </div>
        </div>
      </div>
```

- [ ] **Step 4: Build** — `pnpm build:app` — sem erro.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/admin/ximboca/XimbocaEvento.tsx
git commit -m "feat(ximboca): admin gerencia tipos, capa e ve contador de entradas"
```

---

## Task 8: Frontend admin — toggle Recepcionista (Usuarios)

**Files:**
- Modify: `app/src/pages/admin/Usuarios.tsx`
- Modify: `app/src/types/index.ts`

- [ ] **Step 1: Tipo**

Em `app/src/types/index.ts`, na interface `Usuario`, adicionar (junto de `permite_fiado`):

```ts
  is_recepcionista?: number;
```

- [ ] **Step 2: Handler + botão (espelhar o toggle de "fiado" existente)**

Em `Usuarios.tsx`, localizar o handler que faz `api.put('/api/usuarios/admin/${u.id}/fiado', ...)` (linha ~121) e adicionar um análogo:

```ts
  const toggleRecepcionista = async (u: Usuario) => {
    const novo = u.is_recepcionista ? 0 : 1;
    await api.put(`/api/usuarios/admin/${u.id}/recepcionista`, { is_recepcionista: novo });
    carregar(); // usar o mesmo nome do reload usado pelo toggle de fiado nesta página
  };
```

(Se o reload nesta página tiver outro nome, usar o mesmo do `toggle` de fiado.)

No JSX de cada usuário, ao lado do botão/badge de "Fiado", adicionar um controle equivalente:

```tsx
              <button
                onClick={() => toggleRecepcionista(u)}
                className={`text-xs font-medium px-2 py-1 rounded-lg border ${u.is_recepcionista ? 'text-verde bg-green-50 border-green-200' : 'text-texto-fraco bg-fundo border-borda'}`}
              >
                {u.is_recepcionista ? 'Recepcionista ✓' : 'Recepcionista'}
              </button>
```

- [ ] **Step 3: Build** — `pnpm build:app` — sem erro.

- [ ] **Step 4: Commit**

```bash
git add app/src/pages/admin/Usuarios.tsx app/src/types/index.ts
git commit -m "feat(usuarios): admin marca militar como recepcionista"
```

---

## Task 9: Frontend participante — escolher tipo + ingresso com QR

**Files:**
- Modify: `app/src/pages/XimbocaPublica.tsx`

- [ ] **Step 1: Import e interfaces**

Adicionar no topo:

```ts
import { QRCodeCanvas } from 'qrcode.react';
```

```ts
interface IngressoTipo { id: string; nome: string; valor: number; ordem: number; }
```

Em `EventoPublico` adicionar `tipos: IngressoTipo[];`. Em `MeuEvento` adicionar `numero_ingresso: number | null; tipo_nome: string | null; checkin_at: string | null; imagem_url: string | null;`.

- [ ] **Step 2: Estado de tipo**

```ts
  const [tipoEscolhido, setTipoEscolhido] = useState<string | null>(null);
```

No `abrirParticipar`, adicionar `setTipoEscolhido(null);`.

- [ ] **Step 3: Enviar tipo na inscrição**

Substituir `confirmarParticipar` por:

```ts
  const confirmarParticipar = async () => {
    if (!participarModal) return;
    if (participarModal.tipos?.length && !tipoEscolhido) { setErro('Escolha o tipo de ingresso'); return; }
    setAcaoLoading(true); setErro(''); setMsg('');
    try {
      await api.post(`/api/ximboca/publico/eventos/${participarModal.id}/participar`, {
        categoria_consumo: categoriaEscolhida,
        tipo_ingresso_id: tipoEscolhido,
      });
      setMsg('Inscrição confirmada! Você já está participando.');
      setParticiparModal(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao confirmar');
    } finally {
      setAcaoLoading(false);
    }
  };
```

- [ ] **Step 4: Seletor de tipo no modal** (após `<p ...>{formatData(participarModal.data)}</p>`)

```tsx
            {participarModal.tipos?.length > 0 && (
              <>
                <div className="text-sm font-medium mb-2">Tipo de ingresso:</div>
                <div className="space-y-2 mb-4">
                  {participarModal.tipos.map(t => (
                    <button key={t.id} type="button" onClick={() => setTipoEscolhido(t.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                        tipoEscolhido === t.id ? 'bg-azul text-white border-azul' : 'bg-white border-borda hover:border-azul/50'}`}>
                      <span>{t.nome}</span>
                      <span className="font-bold">R$ {t.valor.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
```

- [ ] **Step 5: Card de ingresso com QR** (na aba "meus", dentro do `.map`, quando pago)

```tsx
                  {ev.meu_status === 'pago' && (
                    <div className="mt-3 border border-green-200 rounded-xl overflow-hidden">
                      {ev.imagem_url && <img src={ev.imagem_url} alt="" className="w-full object-cover max-h-40" />}
                      <div className="p-4 text-center">
                        <div className="text-[10px] uppercase tracking-wider text-texto-fraco">Seu ingresso</div>
                        <div className="font-display text-lg text-azul">#{String(ev.numero_ingresso ?? 0).padStart(3, '0')}</div>
                        {ev.tipo_nome && <div className="text-xs text-texto-fraco mb-2">{ev.tipo_nome}</div>}
                        <div className="inline-block bg-white p-3 rounded-xl border border-borda">
                          <QRCodeCanvas value={ev.participante_id} size={180} level="M" includeMargin />
                        </div>
                        <p className="text-xs text-texto-fraco mt-2">
                          {ev.checkin_at ? 'Entrada já registrada ✓' : 'Mostre este QR na entrada'}
                        </p>
                      </div>
                    </div>
                  )}
```

- [ ] **Step 6: Build** — `pnpm build:app` — sem erro.

- [ ] **Step 7: Commit**

```bash
git add app/src/pages/XimbocaPublica.tsx
git commit -m "feat(ximboca): participante escolhe tipo e recebe ingresso com QR"
```

---

## Task 10: Frontend recepcionista — página `/checkin`

**Files:**
- Create: `app/src/pages/CheckinRecepcionista.tsx`
- Modify: `app/src/App.tsx`
- Modify: `app/src/services/api.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Instalar lib**

Run: `cd app && pnpm add html5-qrcode`

- [ ] **Step 2: Rotear o token de check-in para o `user_token`**

Em `app/src/services/api.ts`, dentro de `pickToken`, adicionar antes do `return adminToken || userToken;`:

```ts
  if (path.startsWith('/api/ximboca/checkin')) return userToken;
```

- [ ] **Step 3: Criar a página**

Criar `app/src/pages/CheckinRecepcionista.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../services/api';

interface EventoCheckin { id: string; nome: string; data: string; imagem_url: string | null; total_pagos: number; entraram: number; }
interface Resultado { estado: 'OK' | 'JA_ENTROU' | 'NAO_PAGO' | 'NAO_ENCONTRADO'; nome?: string; tipo_nome?: string | null; numero_ingresso?: number | null; checkin_at?: string; }
interface PagoItem { id: string; nome: string; numero_ingresso: number | null; tipo_nome: string | null; checkin_at: string | null; }

const CORES: Record<string, string> = { OK: 'bg-green-600', JA_ENTROU: 'bg-amber-500', NAO_PAGO: 'bg-red-600', NAO_ENCONTRADO: 'bg-red-600' };
const TITULOS: Record<string, string> = { OK: 'ENTROU', JA_ENTROU: 'JÁ ENTROU', NAO_PAGO: 'PAGAMENTO PENDENTE', NAO_ENCONTRADO: 'INGRESSO INVÁLIDO' };

export function CheckinRecepcionista() {
  const { eventoId } = useParams<{ eventoId?: string }>();
  const navigate = useNavigate();
  const [eventos, setEventos] = useState<EventoCheckin[]>([]);
  const [evento, setEvento] = useState<EventoCheckin | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<PagoItem[]>([]);
  const travadoRef = useRef(false);

  const carregarEventos = async () => {
    const data = await api.get<EventoCheckin[]>('/api/ximboca/checkin/eventos');
    setEventos(data);
    if (eventoId) setEvento(data.find(e => e.id === eventoId) || null);
  };

  useEffect(() => { carregarEventos().catch(() => {}); /* eslint-disable-next-line */ }, [eventoId]);

  const validar = async (participanteId: string) => {
    if (travadoRef.current || !eventoId) return;
    travadoRef.current = true;
    try {
      const d = await api.post<Resultado>(`/api/ximboca/checkin/${eventoId}/validar`, { participante_id: participanteId });
      setResultado(d);
      if (d.estado === 'OK') carregarEventos();
    } catch {
      setResultado({ estado: 'NAO_ENCONTRADO' });
    } finally {
      setTimeout(() => { travadoRef.current = false; setResultado(null); }, 2500);
    }
  };

  useEffect(() => {
    if (!eventoId) return;
    const scanner = new Html5Qrcode('leitor-qr');
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 },
      (texto) => { validar(texto.trim()); }, () => {}).catch(() => {});
    return () => { scanner.stop().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  const buscar = async (q: string) => {
    setBusca(q);
    if (!eventoId) return;
    const res = await api.get<PagoItem[]>(`/api/ximboca/checkin/${eventoId}/lista?q=${encodeURIComponent(q)}`);
    setLista(res);
  };

  // Lista de eventos (sem evento selecionado)
  if (!eventoId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <h1 className="font-display text-xl tracking-wider text-center mb-4">Check-in</h1>
        <div className="max-w-sm mx-auto space-y-2">
          {eventos.length === 0 && <p className="text-center text-gray-400">Nenhum evento aberto.</p>}
          {eventos.map(e => (
            <button key={e.id} onClick={() => navigate(`/checkin/${e.id}`)}
              className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-xl p-4">
              <div className="font-display tracking-wider">{e.nome}</div>
              <div className="text-sm text-gray-400">Entraram: {e.entraram}/{e.total_pagos}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <button onClick={() => navigate('/checkin')} className="text-sm text-gray-400 mb-2">‹ Eventos</button>
      <h1 className="font-display text-xl tracking-wider text-center">{evento?.nome || 'Check-in'}</h1>
      <p className="text-center text-lg mb-4">Entraram: <span className="font-bold text-green-400">{evento?.entraram ?? 0}/{evento?.total_pagos ?? 0}</span></p>

      <div id="leitor-qr" className="w-full max-w-sm mx-auto rounded-xl overflow-hidden mb-4" />

      {resultado && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center text-center ${CORES[resultado.estado]}`}>
          <div className="text-4xl font-display tracking-wider mb-2">{TITULOS[resultado.estado]}</div>
          {resultado.nome && <div className="text-2xl">{resultado.nome}</div>}
          {resultado.tipo_nome && <div className="text-lg opacity-90">{resultado.tipo_nome}</div>}
          {resultado.numero_ingresso != null && <div className="text-lg opacity-90">#{String(resultado.numero_ingresso).padStart(3, '0')}</div>}
          {resultado.checkin_at && <div className="text-sm opacity-80 mt-2">às {new Date(resultado.checkin_at + 'Z').toLocaleTimeString('pt-BR')}</div>}
        </div>
      )}

      <div className="max-w-sm mx-auto">
        <div className="text-xs text-gray-400 mb-1">Não leu? Busque pelo nome:</div>
        <input value={busca} onChange={e => buscar(e.target.value)} placeholder="Nome do participante"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-2" />
        <div className="space-y-1">
          {lista.map(p => (
            <button key={p.id} onClick={() => validar(p.id)} disabled={!!p.checkin_at}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${p.checkin_at ? 'bg-gray-800 text-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <span>{p.nome} {p.tipo_nome ? `· ${p.tipo_nome}` : ''}</span>
              <span>{p.checkin_at ? 'entrou ✓' : `#${String(p.numero_ingresso ?? 0).padStart(3, '0')}`}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: RecepcionistaGuard + rotas em `App.tsx`**

Adicionar o import lazy (junto aos outros):

```ts
const CheckinRecepcionista = lazy(() => import('./pages/CheckinRecepcionista').then(m => ({ default: m.CheckinRecepcionista })));
```

Adicionar o guard (perto do `VisitorGuard`):

```tsx
function RecepcionistaGuard({ children }: { children: React.ReactNode }) {
  const { user } = useUserAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_recepcionista) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

Adicionar as rotas (junto às públicas, ex. após `/ximboca`):

```tsx
        <Route path="/checkin" element={<RecepcionistaGuard><CheckinRecepcionista /></RecepcionistaGuard>} />
        <Route path="/checkin/:eventoId" element={<RecepcionistaGuard><CheckinRecepcionista /></RecepcionistaGuard>} />
```

- [ ] **Step 5: Build** — `pnpm build:app` — sem erro TS nem de import.

- [ ] **Step 6: Commit**

```bash
git add app/src/pages/CheckinRecepcionista.tsx app/src/App.tsx app/src/services/api.ts app/package.json pnpm-lock.yaml
git commit -m "feat(ximboca): tela de check-in do recepcionista (scanner + fallback)"
```

---

## Task 11: Bump de versão + verificação final

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Versão** — em `app/package.json`, `"version": "1.0.20"` → `"1.0.21"`.

- [ ] **Step 2: Build final** — `pnpm build:app` e `cd worker && npx wrangler deploy --dry-run --outdir dist` — ambos sem erro.

- [ ] **Step 3: Commit**

```bash
git add app/package.json
git commit -m "chore: v1.0.21 - ximboca ingresso com QR + check-in recepcionista"
```

- [ ] **Step 4: Aplicar migration no D1 remoto (após conta Cloudflare correta)**

Run: `cd worker && npx wrangler d1 execute senta-pua-db --remote --file=src/db/migrations/029_ximboca_ingressos.sql`
Expected: `Executed N commands`. **Só depois de `npx wrangler whoami` mostrar a conta correta.**

- [ ] **Step 5: Verificação manual (fluxo do spec §7)**

1. Criar evento, subir capa, cadastrar tipos (Militar/Convidado/Criança).
2. Marcar 1+ militares como recepcionista em `/admin/usuarios`.
3. Inscrever um usuário escolhendo o tipo → aprovar comprovante (`pago`).
4. Conferir o card de ingresso com QR e número em "Minhas Ximbocas".
5. Logar como recepcionista → abrir `/checkin` → escolher evento → escanear: 🟢 ENTROU; de novo 🟡 JÁ ENTROU; não-pago 🔴 PENDENTE; id de outro evento 🔴 INVÁLIDO; testar fallback por nome.
6. Logar como usuário SEM o papel → `/checkin` redireciona pra home (bloqueado).

---

## Nota de deploy — contas GitHub/Cloudflare

Deploy roda por GitHub Actions (secrets do repo) ao push em `main`. A migration D1 usa o `wrangler` local, então **o `wrangler whoami` precisa estar na conta Cloudflare que hospeda `senta-pua-db`** antes do Step 4 da Task 11. Ver a conversa para o procedimento de troca de conta (logout/login interativo).
```
