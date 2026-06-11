# Separação das Cantinas (Oficiais × Graduados) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar cantina dos Oficiais e dos Graduados em produtos/estoque independentes (fim do "geral"), corrigir o bug de reabastecimento que deixa produtos presos em ESGOTADO, e publicar nova versão do app.

**Architecture:** Cloudflare Worker (Hono) + D1 (SQLite) no backend; React 19 + Vite no frontend. Mudança de uma migration de dados, filtro de catálogo estrito, regra de disponibilidade que acompanha estoque, e ajustes na tela admin de produtos. Sem mudança de acesso/menu; Loja intocada.

**Tech Stack:** TypeScript, Hono, Cloudflare D1/Workers, React, Tailwind. **Sem framework de testes** no repo — verificação = build (`tsc`/`pnpm build:app`) + checagens via `wrangler d1 execute`.

**Spec:** `docs/superpowers/specs/2026-06-11-separar-cantinas-design.md`

---

## Arquivos afetados

- Create: `worker/src/db/migrations/025_separar_cantinas.sql`
- Modify: `worker/src/routes/produtos.ts` (GET filtro estrito, POST default, PUT reabastecimento)
- Modify: `app/src/types/index.ts` (tipo `Produto.categoria`)
- Modify: `app/src/pages/admin/Produtos.tsx` (seletor sem "Geral", auto-toggle, selo, default)
- Modify: `app/public/sw.js` (bump `CACHE_NAME`)
- Modify: `app/package.json` (bump `version`)

---

### Task 1: Migration 025 — reassinar "geral" e destravar reabastecidos

**Files:**
- Create: `worker/src/db/migrations/025_separar_cantinas.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- 025_separar_cantinas.sql
-- Separação das cantinas: fim do "geral" compartilhado + correção do reabastecimento

-- 1) Move produtos "geral" para a cantina dos Oficiais (decisão de negócio)
UPDATE produtos SET categoria = 'oficiais' WHERE categoria = 'geral';

-- 2) Correção pontual: religa produtos reabastecidos mas presos em ESGOTADO
UPDATE produtos SET disponivel = 1
  WHERE disponivel = 0 AND estoque IS NOT NULL AND estoque > 0;
```

- [ ] **Step 2: Aplicar em produção (D1 remoto)**

Run:
```bash
cd worker && npx wrangler d1 execute senta-pua-db --remote --file=src/db/migrations/025_separar_cantinas.sql
```
Expected: execução com `success` e algumas linhas escritas (`rows_written` > 0).

- [ ] **Step 3: Verificar resultado no banco**

Run:
```bash
cd worker && npx wrangler d1 execute senta-pua-db --remote --command "SELECT categoria, disponivel, COUNT(*) qtd FROM produtos GROUP BY categoria, disponivel;"
```
Expected: **nenhuma** linha com `categoria = 'geral'`; produtos com `estoque > 0` agora com `disponivel = 1` (Monster, Baly, Coca-Cola Zero, Red Bull voltam a disponível).

- [ ] **Step 4: Commit**

```bash
git add worker/src/db/migrations/025_separar_cantinas.sql
git commit -m "feat(cantina): migration 025 - move geral para oficiais e destrava reabastecidos"
```

---

### Task 2: Backend — filtro de catálogo estrito + default oficiais

**Files:**
- Modify: `worker/src/routes/produtos.ts` (GET `/` e POST `/`)

- [ ] **Step 1: Substituir o handler GET `/` (filtro estrito)**

Trocar o bloco atual (linhas ~9-27) por:

```ts
// Público: lista produtos (filtro estrito por categoria da cantina)
produtos.get('/', async (c) => {
  const cat = c.req.query('categoria');
  let sql = 'SELECT * FROM produtos';
  const params: string[] = [];

  if (cat) {
    sql += ' WHERE categoria = ?';
    params.push(cat);
  }

  sql += ' ORDER BY ordem ASC';

  const stmt = params.length
    ? c.env.DB.prepare(sql).bind(...params)
    : c.env.DB.prepare(sql);

  const { results } = await stmt.all<Produto>();
  return c.json(results);
});
```

- [ ] **Step 2: Mudar o default de categoria no POST `/`**

Na linha do INSERT (POST `/`), trocar `categoria || 'geral'` por `categoria || 'oficiais'`:

```ts
  ).bind(nome, emoji || '🍬', preco, preco_custo ?? null, disponivel ?? 1, ordem ?? 0, imagem_url || null, categoria || 'oficiais', estoque ?? null).all<Produto>();
```

- [ ] **Step 3: Typecheck do worker**

Run: `npx tsc --noEmit -p worker/tsconfig.json`
Expected: sem erros.

- [ ] **Step 4: Verificação funcional (worker local)**

Run (em um terminal): `cd worker && npx wrangler dev`
Em outro: `curl "http://localhost:8787/api/produtos?categoria=graduados"` e `curl "http://localhost:8787/api/produtos?categoria=oficiais"`
Expected: `graduados` retorna só produtos graduados; `oficiais` retorna oficiais (incl. Monster/Baly). Nenhum vazamento entre as duas. Encerrar o `wrangler dev` depois.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/produtos.ts
git commit -m "feat(cantina): catalogo filtra estrito por cantina, sem geral"
```

---

### Task 3: Backend — disponibilidade acompanha o estoque (reabastecimento)

**Files:**
- Modify: `worker/src/routes/produtos.ts` (PUT `/:id`)

- [ ] **Step 1: Adicionar a regra de reabastecimento no PUT `/:id`**

No handler `produtos.put('/:id', ...)`, **depois** do bloco que monta `fields`/`values` a partir do body e **antes** de `if (!fields.length)`, inserir:

```ts
  // Reabastecimento: disponibilidade acompanha o estoque, salvo override explícito.
  // Só age quando 'disponivel' NÃO veio no corpo (admin no controle quando manda explícito).
  if ('estoque' in body && !('disponivel' in body)) {
    const est = body.estoque;
    if (typeof est === 'number') {
      if (est > 0) { fields.push('disponivel = ?'); values.push(1); }
      else if (est === 0) { fields.push('disponivel = ?'); values.push(0); }
      // est === null (ilimitado) → não mexe em disponivel
    }
  }
```

- [ ] **Step 2: Typecheck do worker**

Run: `npx tsc --noEmit -p worker/tsconfig.json`
Expected: sem erros.

- [ ] **Step 3: Verificação funcional (worker local)**

Com `wrangler dev` rodando, pegar um id de produto esgotado e mandar só estoque:
```bash
curl -X PUT "http://localhost:8787/api/produtos/<ID>" -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" -d '{"estoque": 5}'
```
Expected: resposta com `disponivel: 1`. Repetir com `{"estoque": 0}` → `disponivel: 0`. Com `{"estoque": 5, "disponivel": 0}` → `disponivel: 0` (override prevalece).

- [ ] **Step 4: Commit**

```bash
git add worker/src/routes/produtos.ts
git commit -m "fix(cantina): repor estoque religa o produto (fim do esgotado de mao unica)"
```

---

### Task 4: Frontend — tipo Produto.categoria

**Files:**
- Modify: `app/src/types/index.ts:10`

- [ ] **Step 1: Restringir o tipo**

Trocar:
```ts
  categoria: 'oficiais' | 'graduados' | 'geral';
```
por:
```ts
  categoria: 'oficiais' | 'graduados';
```

- [ ] **Step 2: (verificação acontece no build do Task 5/6)**

Sem comando isolado aqui — o `tsc -b` do build vai apontar todos os usos que precisam ajustar (Task 5).

---

### Task 5: Frontend — tela admin de Produtos

**Files:**
- Modify: `app/src/pages/admin/Produtos.tsx`

- [ ] **Step 1: Ajustar o tipo do estado `categoria` e o default (linha ~39)**

Trocar:
```tsx
  const [categoria, setCategoria] = useState<'oficiais' | 'graduados' | 'geral'>('geral');
```
por:
```tsx
  const [categoria, setCategoria] = useState<'oficiais' | 'graduados'>('oficiais');
```

- [ ] **Step 2: Ajustar `abrirNovo` (linha ~52)**

Trocar `setCategoria('geral')` por `setCategoria('oficiais')`.

- [ ] **Step 3: Ajustar `abrirEditar` (linha ~60)**

Trocar `setCategoria(p.categoria || 'geral')` por `setCategoria(p.categoria || 'oficiais')`.

- [ ] **Step 4: Selo da categoria no card (linha ~136-138)**

Trocar o `<span>` do selo por (sem ramo "Geral"):
```tsx
              <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                {p.categoria === 'oficiais' ? '🎖️ Oficiais' : '⭐ Graduados'}
              </span>
```

- [ ] **Step 5: Seletor "Sala" sem a opção Geral (linha ~233-241)**

Trocar o `<select>` por:
```tsx
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as 'oficiais' | 'graduados')}
                className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto"
              >
                <option value="oficiais">Sala dos Oficiais</option>
                <option value="graduados">Sala dos Graduados</option>
              </select>
```

- [ ] **Step 6: Auto-ligar disponível ao repor estoque (input de estoque, linha ~247-254)**

Trocar o `onChange` do input de estoque por:
```tsx
              onChange={(e) => {
                const v = e.target.value;
                setEstoque(v);
                const n = v === '' ? null : parseInt(v);
                if (n !== null && !Number.isNaN(n)) {
                  if (n > 0) setDisponivel(true);
                  else if (n === 0) setDisponivel(false);
                }
              }}
```

- [ ] **Step 7: Build do app**

Run: `pnpm build:app`
Expected: build conclui sem erros de tipo (incl. os de `categoria` do Task 4).

- [ ] **Step 8: Commit**

```bash
git add app/src/types/index.ts app/src/pages/admin/Produtos.tsx
git commit -m "feat(admin): produtos sem categoria 'geral' e disponivel acompanha estoque"
```

---

### Task 6: Nova versão do app (PWA) + build final

**Files:**
- Modify: `app/public/sw.js:1`
- Modify: `app/package.json` (`version`)

- [ ] **Step 1: Bump do cache do service worker**

Em `app/public/sw.js`, linha 1, trocar:
```js
const CACHE_NAME = 'senta-pua-v1.0.4';
```
por:
```js
const CACHE_NAME = 'senta-pua-v1.0.5';
```

- [ ] **Step 2: Bump da versão no package.json**

Em `app/package.json`, trocar `"version": "1.0.0"` por `"version": "1.0.5"` (alinhar com o cache do SW).

- [ ] **Step 3: Build final**

Run: `pnpm build:app`
Expected: build conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/public/sw.js app/package.json
git commit -m "chore(app): versao 1.0.5 (forca atualizacao do PWA)"
```

---

### Task 7: Deploy (produção)

**Files:** nenhum (publicação)

- [ ] **Step 1: Push para `main` (dispara GitHub Actions)**

Run: `git push origin main`
Expected: workflows `deploy-app.yml` (Pages) e `deploy-worker.yml` (Workers) rodam e concluem com sucesso.

> ⚠️ Confirmar com o usuário antes de dar push — é publicação em produção. A migration (Task 1) já foi aplicada manualmente no D1; o push publica worker + app.

- [ ] **Step 2: Verificação pós-deploy**

- Abrir a Cantina dos Oficiais → produtos disponíveis aparecem (incl. energéticos).
- Abrir a Cantina dos Graduados → vazia (esperado até o admin abastecer).
- No app, confirmar o toast "Nova versão disponível" / atualização do PWA.

---

## Self-Review (cobertura do spec)

- Spec §1 (migration: geral→oficiais + destravar) → Task 1. ✅
- Spec §2 (catálogo estrito + default oficiais) → Task 2. ✅
- Spec §3 (reabastecimento backend + UI + null não mexe) → Task 3 (backend) + Task 5 step 6 (UI). ✅
- Spec §4 (admin sem "Geral", selo, auto-toggle) → Task 5. ✅
- Spec §5 (tipo Produto.categoria) → Task 4. ✅
- Spec §6 (sem mudança de menu; loja intocada) → nenhum arquivo de menu/loja tocado. ✅
- Extra pedido pelo usuário (nova versão do app + sempre buildar) → Task 6 + steps de build em Tasks 2/3/5/6. ✅
