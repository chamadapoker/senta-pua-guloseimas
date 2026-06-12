# Bottom Navbar Contextual (mobile) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma barra de navegação inferior (mobile) que mostra as sub-páginas da seção ativa + um botão Menu que abre a sidebar.

**Architecture:** Componente `BottomNav` (só mobile) renderizado no `AppLayout`. A escolha dos itens vem de uma config de dados pura (`config/bottomNav.ts`) via função `itensBottomNav(pathname, {isAdmin,isUser})`. Desktop inalterado (sidebar).

**Tech Stack:** React 19, React Router, Tailwind. **Sem framework de testes** — verificação por `pnpm build:app` + checagem visual.

**Spec:** `docs/superpowers/specs/2026-06-12-bottom-nav-mobile-design.md`

---

## Arquivos

- Modify: `app/src/components/ui/Icon.tsx` (adicionar ícone `menu`)
- Create: `app/src/config/bottomNav.ts` (dados + `itensBottomNav`)
- Create: `app/src/components/BottomNav.tsx` (componente)
- Modify: `app/src/components/AppLayout.tsx` (render + padding + esconder hambúrguer)
- Modify: `app/public/sw.js` + `app/package.json` (bump versão)

---

### Task 1: Ícone `menu` (☰)

**Files:** Modify `app/src/components/ui/Icon.tsx`

- [ ] **Step 1: Adicionar `'menu'` na union `IconName`**

Em `Icon.tsx`, na linha 8, trocar o final da union:
```ts
  | 'plus' | 'qr-code' | 'refresh' | 'info' | 'eye' | 'bell' | 'coffee' | 'fire' | 'cutlery' | 'vault' | 'users' | 'menu';
```

- [ ] **Step 2: Adicionar o path do `menu` no objeto `PATHS`**

Em `PATHS`, logo após a linha de `'users': '...'` (linha 54), adicionar:
```ts
  'menu':          'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5',
```

- [ ] **Step 3: Verificar build**

Run: `pnpm build:app`
Expected: build OK (exit 0), sem erro de tipo.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ui/Icon.tsx
git commit -m "feat(ui): adiciona icone menu (hamburguer)"
```

---

### Task 2: Config da barra inferior

**Files:** Create `app/src/config/bottomNav.ts`

- [ ] **Step 1: Criar o arquivo com dados + seletor**

```ts
export interface BottomItem {
  to: string;
  label: string;
  icon: string; // nome de Icon
}

interface BottomSection {
  match: (path: string) => boolean;
  items: BottomItem[];
}

// ---- Usuário (logado) ----
const USER_DEFAULT: BottomItem[] = [
  { to: '/', label: 'Início', icon: 'info' },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: 'cutlery' },
  { to: '/loja', label: 'Loja', icon: 'cart' },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
];

const USER_SECTIONS: BottomSection[] = [
  {
    match: (p) => p.startsWith('/catalogo'),
    items: [
      { to: '/catalogo/oficiais', label: 'Oficiais', icon: 'cutlery' },
      { to: '/catalogo/graduados', label: 'Graduados', icon: 'cutlery' },
    ],
  },
  {
    match: (p) => p === '/loja' || p.startsWith('/loja/'),
    items: [
      { to: '/loja', label: 'Catálogo', icon: 'cart' },
      { to: '/loja/minhas', label: 'Minhas', icon: 'archive' },
    ],
  },
];

// ---- Visitante (sem login) ----
const VISITOR_DEFAULT: BottomItem[] = [
  { to: '/', label: 'Início', icon: 'info' },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: 'cutlery' },
  { to: '/loja', label: 'Loja', icon: 'cart' },
  { to: '/cafe', label: 'Café', icon: 'coffee' },
];

// ---- Admin ----
const ADMIN_CANTINA: BottomItem[] = [
  { to: '/admin', label: 'Dashboard', icon: 'info' },
  { to: '/admin/pedidos', label: 'Pedidos', icon: 'cart' },
  { to: '/admin/produtos', label: 'Produtos', icon: 'tag' },
  { to: '/admin/clientes', label: 'Militares', icon: 'users' },
];

const ADMIN_SECTIONS: BottomSection[] = [
  {
    match: (p) => p.startsWith('/admin/loja'),
    items: [
      { to: '/admin/loja', label: 'Dashboard', icon: 'info' },
      { to: '/admin/loja/pedidos', label: 'Pedidos', icon: 'cart' },
      { to: '/admin/loja/produtos', label: 'Produtos', icon: 'tag' },
    ],
  },
  {
    match: (p) => p.startsWith('/admin/cafe'),
    items: [
      { to: '/admin/cafe', label: 'Dashboard', icon: 'info' },
      { to: '/admin/cafe/mensalidades', label: 'Mensal.', icon: 'cash' },
      { to: '/admin/cafe/assinantes', label: 'Assinantes', icon: 'users' },
      { to: '/admin/cafe/despesas', label: 'Despesas', icon: 'credit-card' },
    ],
  },
  {
    match: (p) => p.startsWith('/admin/ximboca'),
    items: [
      { to: '/admin/ximboca', label: 'Dashboard', icon: 'info' },
      { to: '/admin/ximboca/eventos', label: 'Eventos', icon: 'fire' },
      { to: '/admin/ximboca/estoque', label: 'Estoque', icon: 'archive' },
    ],
  },
  {
    match: (p) =>
      p.startsWith('/admin/comprovantes') ||
      p.startsWith('/admin/cobrancas') ||
      p.startsWith('/admin/caixa') ||
      p.startsWith('/admin/auditoria'),
    items: [
      { to: '/admin/comprovantes', label: 'Comprov.', icon: 'paper-clip' },
      { to: '/admin/cobrancas', label: 'Cobranças', icon: 'cash' },
      { to: '/admin/caixa', label: 'Caixa', icon: 'vault' },
      { to: '/admin/auditoria', label: 'Auditoria', icon: 'note' },
    ],
  },
  {
    match: (p) =>
      p.startsWith('/admin/usuarios') ||
      p.startsWith('/admin/aniversariantes') ||
      p.startsWith('/admin/admins'),
    items: [
      { to: '/admin/usuarios', label: 'Militares', icon: 'users' },
      { to: '/admin/aniversariantes', label: 'Niver', icon: 'bell' },
      { to: '/admin/admins', label: 'Admins', icon: 'user' },
    ],
  },
];

export function itensBottomNav(
  pathname: string,
  opts: { isAdmin: boolean; isUser: boolean }
): BottomItem[] {
  if (opts.isAdmin) {
    const sec = ADMIN_SECTIONS.find((s) => s.match(pathname));
    return sec ? sec.items : ADMIN_CANTINA;
  }
  const sec = USER_SECTIONS.find((s) => s.match(pathname));
  if (sec) return sec.items;
  return opts.isUser ? USER_DEFAULT : VISITOR_DEFAULT;
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build:app`
Expected: build OK (o módulo ainda não é importado, mas deve compilar).

- [ ] **Step 3: Commit**

```bash
git add app/src/config/bottomNav.ts
git commit -m "feat(nav): config da barra inferior por seção"
```

---

### Task 3: Componente `BottomNav`

**Files:** Create `app/src/components/BottomNav.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { Icon } from './ui/Icon';
import { itensBottomNav } from '../config/bottomNav';

export function BottomNav({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  const { pathname } = useLocation();
  const { token: adminToken } = useAuth();
  const { user, token: userToken } = useUserAuth();
  const isAdmin = !!adminToken;
  const isUser = !!(userToken || user);

  const itens = useMemo(
    () => itensBottomNav(pathname, { isAdmin, isUser }),
    [pathname, isAdmin, isUser]
  );

  // Item ativo = correspondência exata; senão o prefixo mais longo (ex: /admin/clientes/:id)
  const activeTo = useMemo(() => {
    const exato = itens.find((i) => i.to === pathname);
    if (exato) return exato.to;
    const prefixos = itens
      .filter((i) => pathname.startsWith(i.to + '/'))
      .sort((a, b) => b.to.length - a.to.length);
    return prefixos[0]?.to ?? null;
  }, [itens, pathname]);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-borda shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${itens.length + 1}, minmax(0, 1fr))` }}
      >
        {itens.map((item) => {
          const ativo = item.to === activeTo;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                ativo ? 'text-azul' : 'text-texto-fraco'
              }`}
            >
              <Icon name={item.icon as never} size={22} />
              <span className="truncate max-w-[68px]">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onAbrirMenu}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-texto-fraco"
          aria-label="Abrir menu"
        >
          <Icon name="menu" size={22} />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build:app`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/BottomNav.tsx
git commit -m "feat(nav): componente BottomNav contextual mobile"
```

---

### Task 4: Integrar no `AppLayout`

**Files:** Modify `app/src/components/AppLayout.tsx`

- [ ] **Step 1: Importar o componente**

Após a linha `import { Sidebar } from './Sidebar';` (linha 3), adicionar:
```tsx
import { BottomNav } from './BottomNav';
```

- [ ] **Step 2: Esconder o hambúrguer do header no mobile**

Trocar o `className` do botão hambúrguer (linha ~70):
```tsx
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-fundo"
```
por:
```tsx
            className="hidden w-10 h-10 items-center justify-center rounded-xl hover:bg-fundo"
```

- [ ] **Step 3: Dar espaço no `<main>` e no `<footer>` para a barra**

Trocar a abertura do `<main>` (linha ~163):
```tsx
      <main className={`transition-all duration-300 ${sidebarPl}`}>
```
por:
```tsx
      <main className={`transition-all duration-300 ${sidebarPl} pb-24 lg:pb-0`}>
```

E a abertura do `<footer>` (linha ~169):
```tsx
      <footer className={`transition-all duration-300 ${sidebarPl} text-center py-4 text-[10px] text-texto-fraco tracking-wider space-y-1`}>
```
por:
```tsx
      <footer className={`transition-all duration-300 ${sidebarPl} text-center py-4 pb-24 lg:pb-4 text-[10px] text-texto-fraco tracking-wider space-y-1`}>
```

- [ ] **Step 4: Renderizar o `BottomNav`**

Logo antes do `</div>` que fecha o container raiz (depois do `</footer>`, linha ~172), adicionar:
```tsx
      <BottomNav onAbrirMenu={() => setSidebarOpen(true)} />
```

- [ ] **Step 5: Build**

Run: `pnpm build:app`
Expected: build OK (exit 0).

- [ ] **Step 6: Verificação visual (DevTools responsivo)**

Run: `pnpm dev:app` e abrir `http://localhost:5173` em viewport mobile (≤ 1024px).
Expected:
- Barra inferior aparece; no desktop (≥1024px) some e a sidebar fica normal.
- `/admin/pedidos` → `Dashboard · Pedidos · Produtos · Militares` + Menu, "Pedidos" em azul.
- `/catalogo/graduados` → `Oficiais · Graduados` + Menu.
- Botão **Menu** abre a sidebar; escolher outra seção reconfigura a barra.
- Conteúdo não fica atrás da barra; rodapé visível ao rolar.
Encerrar o `dev` depois.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/AppLayout.tsx
git commit -m "feat(nav): integra BottomNav no AppLayout (mobile) e remove hamburguer do topo"
```

---

### Task 5: Nova versão + deploy

**Files:** Modify `app/public/sw.js`, `app/package.json`

- [ ] **Step 1: Bump do cache do SW**

Em `app/public/sw.js` linha 1: `'senta-pua-v1.0.13'` → `'senta-pua-v1.0.14'`.

- [ ] **Step 2: Bump da versão**

Em `app/package.json`: `"version": "1.0.13"` → `"version": "1.0.14"`.

- [ ] **Step 3: Build final**

Run: `pnpm build:app`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/public/sw.js app/package.json
git commit -m "chore(app): versao 1.0.14 (bottom navbar mobile)"
```

- [ ] **Step 5: Deploy (push para main)**

> ⚠️ Confirmar com o usuário antes do push — publica em produção.

Run: `git push origin main`
Expected: workflow `Deploy App (Cloudflare Pages)` conclui com sucesso (só app mudou).

---

## Self-Review (cobertura do spec)

- Spec "BottomNav só mobile, fixo, padding no main" → Task 3 (`lg:hidden fixed`) + Task 4 (pb-24). ✅
- Spec "config centralizada / fonte única" → Task 2 (`config/bottomNav.ts` como fonte única dos itens da barra). Nota: optei por **config própria da barra** (curada, com ícones) em vez de mover os arrays do Sidebar — os formatos diferem (a barra precisa de ícone por item e curadoria de 4), então uma config dedicada é mais clara e de menor risco. O objetivo do spec (não divergir/centralizar) é atendido: os itens da barra têm uma única fonte. ✅
- Spec "sub-páginas da seção ativa (máx 4) + Menu" → Task 2 (conjuntos ≤4) + Task 3 (botão Menu). ✅
- Spec "conjuntos por seção (user/admin)" → Task 2 (USER_*, VISITOR_*, ADMIN_*). ✅
- Spec "item ativo destacado" → Task 3 (`activeTo`). ✅
- Spec "header perde hambúrguer no mobile" → Task 4 Step 2. ✅
- Spec "ícone menu ☰" → Task 1. ✅
- Spec "não mostrar em rotas fora do app (/login,/obrigado)" → essas telas não usam `AppLayout`, então o `BottomNav` (renderizado no `AppLayout`) não aparece nelas. ✅
- Spec "ícone box para estoque" → usei `archive` (já existe e tem cara de caixa), evitando criar ícone novo desnecessário. ✅ (desvio consciente, YAGNI)

Sem placeholders. Tipos/nomes consistentes entre Task 2 (`BottomItem`, `itensBottomNav`) e Task 3 (uso).
