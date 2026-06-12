# Design: Padronização de primitivos de UI (consistência)

**Data:** 2026-06-12
**Status:** Aprovado para implementação

## Objetivo

Uniformizar a aparência do app **sem mudar a identidade visual** (mesmas cores e
fontes). Criar componentes-base canônicos e adotá-los nas telas, eliminando as
divergências atuais: cards com cantos diferentes (`rounded-xl`/`2xl`/`3xl`), paddings
variados (`p-3`..`p-6`), inputs em dois estilos, botões "soltos" sem o componente
`Button`, títulos de página repetidos à mão e estados de loading/vazio em formatos
diferentes.

## Princípio

Escolher como canônico o **valor predominante hoje**, para minimizar a mudança nas
telas que já seguem o padrão. Nada de nova paleta/tipografia.

## Tokens canônicos

- **Card:** `bg-white border border-borda rounded-2xl shadow-sm`; padding `p-4`
  (variante `lg` = `p-5`).
- **Campos** (input/select/textarea): `w-full bg-white border border-borda rounded-xl
  px-3.5 py-2.5 text-sm text-texto focus:ring-2 focus:ring-azul/20 outline-none`.
- **Título de página:** `font-display text-2xl text-azul tracking-wider`.
- **EmptyState:** `text-center py-12 text-texto-fraco` (ícone opcional + mensagem +
  ação opcional).
- **Loading:** `text-center py-10 text-texto-fraco` com o texto "Carregando...".
- **Cantos:** cards = `rounded-2xl`; campos e botões = `rounded-xl`.

## Componentes novos (`app/src/components/ui/`)

Todos pequenos, uma responsabilidade cada, com `className` opcional para extensão.

### `Card.tsx`
```tsx
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'md' | 'lg'; // md=p-4 (padrão), lg=p-5
}
```
Renderiza `div` com as classes canônicas do card + `props.className` concatenada.

### `PageHeader.tsx`
```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode; // ação à direita (ex: botão "+ Adicionar")
  className?: string;
}
```
Renderiza o `<h1>` canônico + subtítulo opcional + slot à direita (flex justify-between).

### `Field.tsx`
```tsx
interface FieldProps {
  label?: string;
  hint?: string;       // texto auxiliar abaixo
  children: React.ReactNode; // o controle (input/select/textarea)
  className?: string;
}
```
Renderiza `<label>` (estilo canônico) + o controle. Exporta também classes utilitárias
reutilizáveis: `export const inputClass = '...'` (a string canônica acima) para inputs
soltos que não usam o wrapper.

### `EmptyState.tsx`
```tsx
interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}
```

### `Loading.tsx`
```tsx
interface LoadingProps { label?: string; } // default "Carregando..."
```

## Botões

O componente `Button` (já existe em `components/ui/Button.tsx`) é a referência.
Auditar os botões "soltos" (com classes ad-hoc) nas telas adotadas e:
- Trocar por `<Button>` quando for ação primária/secundária padrão.
- Manter como estão os casos especiais (chips de filtro, toggles, ícones) — fora de
  escopo virar componente agora.

## Rollout faseado

Cada fase termina com `pnpm build:app` + commit + deploy (bump de versão).

### Fase 1 — primitivos + telas do usuário
Criar os 5 componentes e adotá-los em:
- `pages/Dashboard.tsx` (dashboard do militar)
- `pages/Catalogo.tsx`
- `pages/Checkout.tsx`
- `pages/PixPage.tsx`
- `pages/Perfil.tsx`
- `pages/LojaPublica.tsx`, `pages/LojaMinhas.tsx`
- `pages/CafePublico.tsx`
- `pages/XimbocaPublica.tsx`
- `pages/AcessoExpirado.tsx`

### Fase 2 — telas admin
Adotar nas telas `pages/admin/**` (cantina, loja, café, ximboca, financeiro, pessoas,
config), trocando cards/títulos/inputs/empty/loading pelos primitivos.

## Não-objetivos

- Não mudar cores, fontes, ou layout/estrutura das telas.
- Não criar dark mode.
- Não transformar chips de filtro/toggles em componentes (fica para outra passada).
- Não mexer no backend.

## Verificação
(Sem framework de testes — build + checagem visual.)
1. `pnpm build:app` sem erros após cada fase.
2. Telas adotadas mantêm o mesmo conteúdo/funções; só cantos/padding/campos/títulos
   ficam uniformes.
3. Cards em `rounded-2xl` consistentes; inputs no mesmo estilo; loading/empty padronizados.
4. Nada de regressão funcional (botões e formulários continuam funcionando).
