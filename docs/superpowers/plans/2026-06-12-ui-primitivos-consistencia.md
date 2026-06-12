# Padronização de Primitivos de UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar 5 componentes-base canônicos (Card, PageHeader, Field, EmptyState, Loading) e adotá-los nas telas para uniformizar a UI, sem mudar a identidade visual.

**Architecture:** Componentes pequenos em `app/src/components/ui/`. Adoção faseada: Fase 1 telas do usuário, Fase 2 telas admin. Cada adoção é um find/replace guiado por um "recipe" de equivalências.

**Tech Stack:** React 19, Tailwind. **Sem framework de testes** — verificação por `pnpm build:app` + checagem visual.

**Spec:** `docs/superpowers/specs/2026-06-12-ui-primitivos-consistencia-design.md`

---

## Arquivos

- Create: `app/src/components/ui/Card.tsx`
- Create: `app/src/components/ui/PageHeader.tsx`
- Create: `app/src/components/ui/Field.tsx` (componente `Field` + export `inputClass`)
- Create: `app/src/components/ui/EmptyState.tsx`
- Create: `app/src/components/ui/Loading.tsx`
- Modify (Fase 1): telas do usuário (lista na Task 7)
- Modify (Fase 2): telas admin (lista na Task 9)
- Modify: `app/public/sw.js` + `app/package.json` (bump por fase)

---

### Task 1: `Card`

**Files:** Create `app/src/components/ui/Card.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'md' | 'lg'; // md = p-4 (padrão), lg = p-5
}

export function Card({ size = 'md', className = '', children, ...props }: CardProps) {
  const pad = size === 'lg' ? 'p-5' : 'p-4';
  return (
    <div className={`bg-white border border-borda rounded-2xl shadow-sm ${pad} ${className}`} {...props}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Build** — `pnpm build:app` → OK.

---

### Task 2: `PageHeader`

**Files:** Create `app/src/components/ui/PageHeader.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode; // ação à direita (ex: botão "+ Adicionar")
  className?: string;
}

export function PageHeader({ title, subtitle, right, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-5 ${className}`}>
      <div>
        <h1 className="font-display text-2xl text-azul tracking-wider">{title}</h1>
        {subtitle && <p className="text-sm text-texto-fraco mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Build** — `pnpm build:app` → OK.

---

### Task 3: `Field` + `inputClass`

**Files:** Create `app/src/components/ui/Field.tsx`

- [ ] **Step 1: Criar o componente e a classe canônica**

```tsx
import type { ReactNode } from 'react';

// Classe canônica de campos (input/select/textarea). Use direto em controles soltos.
export const inputClass =
  'w-full bg-white border border-borda rounded-xl px-3.5 py-2.5 text-sm text-texto focus:ring-2 focus:ring-azul/20 outline-none';

interface FieldProps {
  label?: string;
  hint?: string; // texto auxiliar abaixo do controle
  children: ReactNode; // o controle (input/select/textarea)
  className?: string;
}

export function Field({ label, hint, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
      {children}
      {hint && <p className="text-xs text-texto-fraco mt-1">{hint}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Build** — `pnpm build:app` → OK.

---

### Task 4: `EmptyState`

**Files:** Create `app/src/components/ui/EmptyState.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 text-texto-fraco">
      {icon && <div className="flex justify-center mb-3 opacity-60">{icon}</div>}
      <p className="text-sm">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Build** — `pnpm build:app` → OK.

---

### Task 5: `Loading`

**Files:** Create `app/src/components/ui/Loading.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
interface LoadingProps {
  label?: string;
}

export function Loading({ label = 'Carregando...' }: LoadingProps) {
  return <div className="text-center py-10 text-texto-fraco">{label}</div>;
}
```

- [ ] **Step 2: Build + commit dos primitivos**

```bash
pnpm build:app
git add app/src/components/ui/Card.tsx app/src/components/ui/PageHeader.tsx app/src/components/ui/Field.tsx app/src/components/ui/EmptyState.tsx app/src/components/ui/Loading.tsx
git commit -m "feat(ui): primitivos canonicos (Card, PageHeader, Field, EmptyState, Loading)"
```

---

## Recipe de adoção (vale para Fase 1 e Fase 2)

Em cada tela, aplicar estas equivalências (importar os componentes de `../components/ui/...`
ou `../../components/ui/...` conforme a profundidade):

1. **Card** — trocar containers de cartão:
   - De: `<div className="bg-white rounded-xl border border-borda p-4 shadow-sm">…</div>`
     (e variações `rounded-2xl/3xl`, `p-3/p-5/p-6`)
   - Para: `<Card>…</Card>` (passar extras via `className`, ex.: `<Card className="mb-4">`).
     Usar `size="lg"` onde o padding era `p-5`/`p-6`.

2. **Título de página** — trocar:
   - De: `<h1 className="font-display text-2xl text-azul tracking-wider …">TÍTULO</h1>`
     (e o bloco `flex justify-between` com botão à direita)
   - Para: `<PageHeader title="TÍTULO" />` ou `<PageHeader title="TÍTULO" right={<Button…/>} />`.

3. **Inputs/select/textarea soltos** — trocar a `className` ad-hoc pela canônica:
   - De: `className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto"`
     (e a variante `bg-fundo rounded-2xl px-4 py-3`)
   - Para: `className={inputClass}` (e, quando houver `<label>` + input, envolver em
     `<Field label="…">`).

4. **Loading** — trocar:
   - De: `<div className="text-center py-10 text-texto-fraco">Carregando...</div>`
   - Para: `<Loading />` (ou `<Loading label="Carregando café..." />`).

5. **Empty** — trocar:
   - De: `<div className="text-center py-12 text-texto-fraco">Nenhum X</div>`
   - Para: `<EmptyState message="Nenhum X" />` (com `action` quando houver botão).

6. **Botões soltos** que sejam ação primária/secundária padrão → usar `<Button>`.
   Não mexer em chips de filtro/toggles/botões-ícone.

**Regra de ouro:** não alterar conteúdo, textos, lógica ou estrutura — só os invólucros
visuais acima. Se um card tem layout especial, manter via `className`.

---

### Task 6: Fase 1 — adoção nas telas do usuário

**Files (Modify):**
- `app/src/pages/Dashboard.tsx`
- `app/src/pages/Catalogo.tsx`
- `app/src/pages/Checkout.tsx`
- `app/src/pages/PixPage.tsx`
- `app/src/pages/Perfil.tsx`
- `app/src/pages/LojaPublica.tsx`
- `app/src/pages/LojaMinhas.tsx`
- `app/src/pages/CafePublico.tsx`
- `app/src/pages/XimbocaPublica.tsx`
- `app/src/pages/AcessoExpirado.tsx`
- `app/src/components/perfil/MeuCafe.tsx`

- [ ] **Step 1: Aplicar o recipe em cada arquivo acima**, um de cada vez: ler o arquivo,
  trocar cards→`Card`, títulos→`PageHeader`, inputs→`inputClass`/`Field`,
  loading→`Loading`, empty→`EmptyState`, botões soltos→`Button`. Adicionar os imports
  necessários. Não mudar lógica.

- [ ] **Step 2: Build** — `pnpm build:app` → exit 0 (corrigir imports/JSX se acusar).

- [ ] **Step 3: Verificação visual** — `pnpm dev:app`, abrir as telas do usuário e
  confirmar que cantos/padding/campos/títulos ficaram uniformes e nada quebrou.

- [ ] **Step 4: Bump versão + commit**

Em `app/public/sw.js`: `'senta-pua-v1.0.14'` → `'senta-pua-v1.0.15'`.
Em `app/package.json`: `"version": "1.0.14"` → `"version": "1.0.15"`.

```bash
pnpm build:app
git add -A
git commit -m "refactor(ui): adota primitivos canonicos nas telas do usuario (v1.0.15)"
```

- [ ] **Step 5: Deploy (confirmar com o usuário antes do push)**

```bash
git push origin main
```
Expected: `Deploy App` verde.

---

### Task 7: Fase 2 — adoção nas telas admin

**Files (Modify):** `app/src/pages/admin/**` e subcomponentes de admin:
- Cantina: `admin/Dashboard.tsx`, `admin/Produtos.tsx`, `admin/Clientes.tsx`,
  `admin/ClienteExtrato.tsx`, `admin/Pedidos.tsx`, `admin/Relatorios.tsx`,
  `admin/Lucratividade.tsx`
- Loja: `admin/loja/LojaDashboard.tsx`, `admin/loja/LojaProdutos.tsx`,
  `admin/loja/LojaPedidos.tsx`
- Café: `admin/cafe/CafeDashboard.tsx`, `admin/cafe/CafeMensalidades.tsx`,
  `admin/cafe/CafeInsumos.tsx`, `admin/cafe/CafeAssinantes.tsx`,
  `admin/cafe/CafeDespesas.tsx`
- Ximboca: `admin/ximboca/XimbocaDashboard.tsx`, `admin/ximboca/XimbocaEventos.tsx`,
  `admin/ximboca/XimbocaEvento.tsx`, `admin/ximboca/XimbocaEstoque.tsx`
- Financeiro: `admin/Comprovantes.tsx`, `admin/Cobrancas.tsx`,
  `admin/CaixaConsolidado.tsx`, `admin/Auditoria.tsx`
- Pessoas: `admin/Usuarios.tsx`, `admin/Aniversariantes.tsx`, `admin/Admins.tsx`
- Config/Doc: `admin/Configuracoes.tsx`, `admin/Documentacao.tsx`
- Subcomponentes: `components/admin/ContaMilitar.tsx`, `components/admin/StatCard.tsx`

- [ ] **Step 1: Aplicar o mesmo recipe** em cada arquivo (um de cada vez). Nota: tabelas
  e `StatCard` têm estilo próprio — só padronizar o **container** (envolver em `Card`
  quando for um cartão branco) e os títulos/inputs/loading/empty; **não** reescrever as
  tabelas nem o StatCard internamente.

- [ ] **Step 2: Build** — `pnpm build:app` → exit 0.

- [ ] **Step 3: Verificação visual** — abrir as telas admin e conferir uniformidade.

- [ ] **Step 4: Bump versão + commit**

`sw.js` → `'senta-pua-v1.0.16'`; `package.json` → `"1.0.16"`.
```bash
pnpm build:app
git add -A
git commit -m "refactor(ui): adota primitivos canonicos nas telas admin (v1.0.16)"
```

- [ ] **Step 5: Deploy (confirmar antes)** — `git push origin main`.

---

## Self-Review (cobertura do spec)

- Tokens canônicos (card rounded-2xl, campos rounded-xl, título, empty, loading) →
  Tasks 1-5 implementam exatamente os tokens do spec. ✅
- 5 componentes novos (`Card`, `PageHeader`, `Field`, `EmptyState`, `Loading`) →
  Tasks 1-5. ✅
- `Field` exporta `inputClass` → Task 3. ✅
- Botões: usar `Button` para ações padrão; manter chips/toggles → Recipe item 6. ✅
- Rollout Fase 1 (usuário) → Task 6. Fase 2 (admin) → Task 7. ✅
- Não-objetivos (sem nova paleta/fonte, sem dark mode, sem mexer em chips/tabelas/backend)
  → Recipe "regra de ouro" + Task 7 Step 1. ✅
- Verificação build + visual por fase → Steps de build/visual em cada fase. ✅

Sem placeholders de lógica. Nomes consistentes: `Card`(size), `PageHeader`(title/subtitle/right),
`Field`(label/hint)+`inputClass`, `EmptyState`(message/icon/action), `Loading`(label) — usados
de forma idêntica no Recipe.
