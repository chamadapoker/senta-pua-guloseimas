# Design: Bottom Navbar contextual (mobile)

**Data:** 2026-06-12
**Status:** Aprovado para implementação

## Objetivo

Dar cara de app nativo no mobile com uma **barra de navegação inferior** que mostra
as **sub-páginas da seção atual** (máx 4) + um botão **Menu** que abre a sidebar para
trocar de seção. Ao escolher outra seção na sidebar, a barra se reconfigura. Só no
mobile; no desktop a sidebar continua como está.

## Decisões (alinhadas com o usuário)

- Conteúdo = **sub-páginas da seção ativa** (máx 4), curadas; o restante fica acessível
  pela sidebar.
- 5º slot é sempre o botão **Menu** (☰) que abre a sidebar.
- **Só no mobile** (`lg:hidden`). Desktop inalterado.
- O **hambúrguer do header some no mobile** (redundante — quem abre a sidebar agora é o
  botão Menu da barra inferior). Header mantém logo, sino e avatar.
- Ícone do botão de menu = **☰ (menu)**, não engrenagem.

## Arquitetura

### Config de navegação centralizada
Hoje os arrays `VISITOR_NAV`, `USER_NAV`, `ADMIN_NAV` vivem dentro de `Sidebar.tsx`.
Mover para um módulo compartilhado **`app/src/config/nav.tsx`** (exporta os arrays e os
tipos), para que `Sidebar` e `BottomNav` usem a mesma fonte de verdade e não divirjam.
`Sidebar.tsx` passa a importar de lá (sem mudança de comportamento).

Tipo (já existente, movido):
```ts
interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  children?: { to: string; label: string }[];
}
```

### Determinação da "seção ativa"
Função pura `secaoAtiva(pathname, nav): NavItem | null` em `nav.tsx`:
- Retorna o `NavItem` (seção) cujo `to` === pathname **ou** que tenha um `children[].to`
  cujo path (sem query) === pathname.
- Se nenhuma casar, retorna `null` (usa-se o conjunto padrão — ver abaixo).

### Itens da barra inferior
Função pura `itensBottomNav(pathname, nav, isAdmin, isUser): { itens: {to,label,icon}[] }`:
- Acha a seção ativa.
- Se a seção tem `children`: usa os **4 primeiros** (curadoria feita reordenando os
  children na config — ver "Conjuntos").
- Se a seção não tem `children` (ou é null): usa o **conjunto padrão** do modo.
- Sempre adiciona o botão **Menu** como item final (não navega; abre a sidebar).

Os ícones de cada sub-item: a config de `children` hoje não tem ícone. Vamos adicionar
um campo opcional `icon` aos children **apenas** para os itens que aparecem na barra
(os 4 curados por seção). Sidebar ignora esse campo (continua com bolinha).

## Conjuntos por seção (curados, máx 4)

**Usuário — padrão** (quando a rota não está numa seção com filhos, ex.: `/`, `/cafe`,
`/ximboca`, `/perfil`): `Início · Cantina · Loja · Perfil`

**Usuário — seções:**
- Cantina (`/catalogo/*`): `Oficiais · Graduados`
- Loja (`/loja*`): `Catálogo · Minhas Compras`

**Admin — padrão** (`/admin`): conjunto da seção Cantina.

**Admin — seções:**
- Cantina: `Dashboard · Pedidos · Produtos · Clientes`
- Loja: `Dashboard · Pedidos · Produtos`
- Café: `Dashboard · Mensalidades · Assinantes · Despesas`
- Ximboca: `Dashboard · Eventos · Estoque`
- Financeiro: `Comprovantes · Cobranças · Caixa · Auditoria`
- Pessoas: `Militares · Aniversariantes · Admins`

(Relatórios, Lucratividade, Insumos, Documentação, Configurações continuam só na sidebar.)

## Componente `BottomNav`

`app/src/components/BottomNav.tsx`:
- Props: `onAbrirMenu: () => void` (chama o `setSidebarOpen(true)` do `AppLayout`).
- Lê `useLocation()`, `useAuth()` (admin), `useUserAuth()` (user) para escolher o nav e
  computar os itens.
- Renderiza fixo: `fixed bottom-0 inset-x-0 z-40 lg:hidden`, fundo branco, borda
  superior, `grid` com N+1 colunas (itens + Menu).
- Cada item: `<Link>` com ícone + label curta; **ativo** (`isActive`) com cor `azul`,
  inativo `texto-fraco`.
- Botão Menu: ícone ☰, `onClick={onAbrirMenu}`.
- Não renderiza se não houver itens (ex.: rota fora do app — `/obrigado`, `/login`).
  Regra: só renderiza quando `isUser || isAdmin || (visitante em rota do app)`.

## Mudanças no `AppLayout`
- Renderiza `<BottomNav onAbrirMenu={() => setSidebarOpen(true)} />`.
- `<main>` ganha `pb-20 lg:pb-0` (espaço para a barra; some no desktop).
- Header: o botão hambúrguer mobile passa a `hidden` (já é `lg:hidden`; vira `hidden`
  total, pois o Menu da barra inferior assume). Logo mobile continua.

## Ícones necessários (`Icon.tsx`)
Garantir nomes usados na barra: `home/info`, `cart`, `coffee`, `fire`, `user`,
`cutlery`, `cash`, `users`, `menu` (☰), `clipboard/note`, `box` (estoque). Adicionar os
que faltarem (ex.: `menu`, `box`). Reusar os já existentes quando possível.

## Plano de testes / verificação
(Sem framework de testes — verificação por build + inspeção visual.)
1. `pnpm build:app` sem erros de tipo.
2. Mobile (viewport estreita): barra aparece; desktop (`lg`): some, sidebar normal.
3. Em `/admin/pedidos` a barra mostra `Dashboard · Pedidos · Produtos · Clientes` com
   "Pedidos" ativo.
4. Em `/catalogo/graduados` mostra `Oficiais · Graduados` com Graduados ativo.
5. Botão **Menu** abre a sidebar; escolher outra seção reconfigura a barra.
6. Conteúdo não fica escondido atrás da barra (padding-bottom).
7. Rotas sem app (`/login`, `/obrigado`) não mostram a barra.

## Fora de escopo
- Passada de design dedicada (cores/tipografia/cards) — combinada como etapa separada
  depois deste navbar.
- Animações de transição entre seções (pode ser um polimento futuro).
