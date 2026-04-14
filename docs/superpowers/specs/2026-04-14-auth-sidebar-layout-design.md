# Design: Autenticacao de Usuario + Sidebar + Novo Layout

**Data:** 2026-04-14
**Escopo:** Autenticacao de usuario comum, sidebar colapsavel, novo layout unificado

---

## 1. Visao Geral

Adicionar sistema de login/cadastro para usuarios comuns (militares), com sidebar colapsavel que substitui a navegacao atual por tabs. O sidebar mostra itens diferentes conforme o tipo de login (admin vs usuario vs deslogado). Paginas publicas continuam acessiveis sem login; o login so e exigido no checkout.

---

## 2. Banco de Dados

### Nova tabela: `usuarios`

```sql
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  trigrama TEXT NOT NULL UNIQUE,
  saram TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL,
  foto_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

- `email`: login do usuario, unique
- `senha_hash`: SHA-256 via Web Crypto API (Cloudflare Workers nativo)
- `trigrama`: 3 letras uppercase, linkado a `clientes.nome_guerra`
- `saram`: numero de identificacao militar, unique
- `whatsapp`: formato 5562999...
- `foto_url`: path no R2, opcional

### Relacao com `clientes`

- `usuarios.trigrama` = `clientes.nome_guerra`
- Na criacao do usuario, se nao existe cliente com esse trigrama, cria automaticamente
- Se ja existe, linka sem duplicar

---

## 3. Autenticacao

### JWT

- Admin: `{ tipo: 'admin', email }` - expira em 8h (manter como esta)
- Usuario: `{ tipo: 'usuario', id, email, trigrama }` - expira em 30 dias
- Ambos usam o mesmo `JWT_SECRET`
- Armazenados em localStorage com chaves diferentes: `token` (admin), `user_token` (usuario)

### Hash de Senha

- Usar Web Crypto API `PBKDF2` com salt aleatorio
- Format: `salt_hex:hash_hex`
- 100.000 iteracoes, SHA-256

### Endpoints

```
POST /api/usuarios/cadastro
  Body: { email, senha, trigrama, saram, whatsapp }
  - Valida campos obrigatorios
  - Trigrama: uppercase, 3 letras
  - SARAM: apenas numeros
  - Email: formato valido
  - Hash senha com PBKDF2
  - Cria usuario
  - Cria/linka cliente pelo trigrama
  - Retorna JWT

POST /api/usuarios/login
  Body: { email, senha }
  - Busca usuario por email
  - Verifica hash da senha
  - Retorna JWT (30 dias)

GET /api/usuarios/me
  Header: Authorization: Bearer {token}
  - Retorna dados do usuario (sem senha)

PUT /api/usuarios/me
  Header: Authorization: Bearer {token}
  Body: { whatsapp?, saram? }
  - Atualiza dados editaveis

POST /api/usuarios/me/foto
  Header: Authorization: Bearer {token}
  Body: FormData com campo 'foto'
  - Upload pro R2 em /usuarios/{id}/foto.{ext}
  - Atualiza foto_url no banco
  - Retorna nova URL

DELETE /api/usuarios/me/foto
  - Remove foto do R2
  - Limpa foto_url
```

### Middleware

Expandir `authMiddleware` para reconhecer ambos tipos de token:

```
- Se payload.tipo === 'admin' -> set adminEmail (fluxo existente)
- Se payload.tipo === 'usuario' -> set userId, userEmail, userTrigrama
```

Criar `userMiddleware` para rotas que exigem usuario logado (checkout).

### Endpoints Admin para Gerenciar Usuarios

```
PUT /api/admin/usuarios/:id/senha
  Body: { nova_senha }
  - Admin reseta a senha do usuario (minimo 6 caracteres)

PUT /api/admin/usuarios/:id/desativar
  - Desativa conta do usuario (militar deu baixa)
  - Marca como inativo, impede login
  - Nao deleta dados historicos (pedidos, debitos permanecem)

PUT /api/admin/usuarios/:id/ativar
  - Reativa conta caso necessario
```

---

## 4. Sidebar

### Comportamento

- **Desktop (>=1024px):** sidebar fixa na esquerda
  - Estado colapsado: 64px largura, so icones
  - Estado expandido: 256px largura, icones + texto
  - Botao de toggle no topo do sidebar
  - Estado persistido no localStorage
- **Mobile (<1024px):** sidebar escondida
  - Abre como overlay ao clicar no hamburger no header
  - Backdrop escuro com click-to-close
  - Fecha automaticamente ao navegar

### Estrutura Visual

```
+------------------------------------------+
| [=] Logo    APP RP POKER    [foto/icone] |  <- Header (mobile: hamburger + logo + avatar)
+------+-----------------------------------+
|      |                                   |
| Side |         Conteudo                  |
| bar  |         Principal                 |
|      |                                   |
| [ic] |                                   |
| [ic] |                                   |
| [ic] |                                   |
|      |                                   |
|------|                                   |
| Sair |                                   |
+------+-----------------------------------+
```

### Itens do Sidebar por Tipo de Usuario

**Deslogado (visitante):**
- Catalogo (home)
- Loja
- Cafe
- ---
- Entrar / Cadastrar

**Usuario comum logado:**
- Catalogo (home)
- Loja
- Cafe
- Meus Pedidos (futuro - nao implementar agora)
- ---
- Meu Perfil
- Sair

**Admin logado:**
- Dashboard
- Guloseimas (submenu)
  - Pedidos
  - Produtos
  - Militares
  - Relatorios
- Loja (submenu)
  - Dashboard
  - Pedidos
  - Produtos
- Cafe (submenu)
  - Dashboard
  - Mensalidades
  - Insumos
  - Assinantes
- Ximboca (submenu)
  - Dashboard
  - Eventos
  - Estoque
- ---
- Configuracoes
- Sair

### Submenus

- Clicavel para expandir/colapsar (chevron icon)
- Quando sidebar esta colapsada, submenu abre como tooltip/popover ao hover
- Item ativo destacado com bg-azul/10 + borda esquerda azul

---

## 5. Layout Unificado

### Substituir `PublicLayout` e `AdminLayout` por um unico `AppLayout`

- `AppLayout` recebe o conteudo como children
- Renderiza: Header + Sidebar + Main content
- Header: logo a esquerda, avatar/login a direita
- Sidebar: conforme descrito acima
- Main: area de conteudo com padding adequado
- Footer: dentro do main area (nao full width)

### Header

- Sempre visivel, sticky top
- Mobile: hamburger (esquerda) + logo (centro) + avatar (direita)
- Desktop: logo (esquerda) + avatar/nome (direita)
- Avatar: foto do usuario ou icone generico, clicavel -> perfil

### Responsividade

- Mobile: conteudo full width, sidebar como overlay
- Desktop: conteudo com margin-left do sidebar (64px ou 256px)
- Transicao suave ao colapsar/expandir sidebar

---

## 6. Paginas Novas

### `/login` - Login do Usuario

- Campos: email, senha
- Botao "Entrar"
- Link "Nao tem conta? Cadastre-se"
- Link "Login Admin" discreto no rodape
- Redireciona para pagina anterior ou home apos login

### `/cadastro` - Cadastro do Usuario

- Campos obrigatorios: email, senha, confirmar senha, trigrama, SARAM, whatsapp
- Campo opcional: foto (upload com preview)
- Trigrama: input com maxLength=3, toUpperCase automatico
- SARAM: input numerico
- WhatsApp: mascara 55XXXXXXXXXXX
- Validacoes inline
- Apos cadastro, loga automaticamente

### `/perfil` - Perfil do Usuario

- Exibe dados da conta
- Foto editavel (click pra trocar)
- Campos editaveis: whatsapp, SARAM
- Campos somente leitura: email, trigrama
- Botao "Sair"

---

## 7. Modificacoes no Checkout

### Fluxo Atual
1. Seleciona produtos
2. Vai pro checkout
3. Digita trigrama + whatsapp
4. Escolhe pagamento

### Novo Fluxo
1. Seleciona produtos
2. Vai pro checkout
3. **Se logado:** dados preenchidos automaticamente (trigrama, whatsapp do usuario)
4. **Se nao logado:** tela com duas opcoes:
   - "Entrar" -> redireciona pra /login com retorno ao /checkout
   - "Cadastrar" -> redireciona pra /cadastro com retorno ao /checkout
5. Escolhe pagamento (mesmo fluxo de hoje)

### Remover
- Campo de trigrama manual (substituido pelos dados da conta)
- Campo de whatsapp no checkout (ja vem da conta)
- Campo de visitante (mantido apenas para admin criar manualmente)

---

## 8. Zustand Stores

### Novo: `useUserAuth` (separado do useAuth existente)

```typescript
interface UserAuthState {
  token: string | null;
  user: {
    id: number;
    email: string;
    trigrama: string;
    saram: string;
    whatsapp: string;
    foto_url: string | null;
  } | null;
  login: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: CadastroData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  updateProfile: (dados: Partial<UserProfile>) => Promise<void>;
  updateFoto: (file: File) => Promise<void>;
}
```

### Manter: `useAuth` (admin, renomear internamente pra clareza)

- Continua funcionando como esta
- localStorage key: `token` (admin)
- Novo localStorage key: `user_token` (usuario)

---

## 9. API Service

Expandir `api.ts` para suportar dois tokens:

- Rotas `/api/admin/*` e `/api/auth/*`: usa `token` (admin)
- Rotas `/api/usuarios/*`: usa `user_token`
- Rotas publicas: sem token
- Checkout: usa `user_token`

---

## 10. Roteamento Atualizado

```
# Publicas (sem login)
/                     -> Home (catalogo)
/catalogo/:categoria  -> Catalogo
/loja                 -> Loja publica
/cafe                 -> Cafe publico
/login                -> Login usuario
/cadastro             -> Cadastro usuario
/pix/:pedidoId        -> Pagamento PIX
/obrigado             -> Confirmacao

# Usuario logado
/checkout             -> Checkout (requer login)
/perfil               -> Perfil do usuario

# Admin (requer admin)
/admin/login          -> Login admin
/admin                -> Dashboard
/admin/produtos       -> Produtos
/admin/pedidos        -> Pedidos
/admin/clientes       -> Militares
/admin/clientes/:id   -> Extrato
/admin/relatorios     -> Relatorios
/admin/config         -> Configuracoes
/admin/loja           -> Loja dashboard
/admin/loja/produtos  -> Loja produtos
/admin/loja/pedidos   -> Loja pedidos
/admin/cafe           -> Cafe dashboard
/admin/cafe/mensalidades
/admin/cafe/insumos
/admin/cafe/assinantes
/admin/ximboca        -> Ximboca dashboard
/admin/ximboca/eventos
/admin/ximboca/eventos/:id
/admin/ximboca/estoque
```

---

## 11. Seguranca

- Senha: minimo 6 caracteres, sem restricoes de complexidade (pode ser so numeros ou so letras)
- Senhas nunca trafegam em texto puro no banco (PBKDF2 hash)
- HTTPS obrigatorio (Cloudflare Pages ja fornece)
- JWT com expiracao
- Rate limiting no login/cadastro: maximo 5 tentativas por IP por minuto (usar Cloudflare Workers KV ou header CF-Connecting-IP)
- Trigrama e SARAM unicos no banco (constraint SQL)
- Upload de foto: validar tipo (jpg/png/webp), limite 2MB

---

## 12. Migracao

- Criar tabela `usuarios` via D1 migration
- Nao quebra nada existente: clientes sem usuario continuam funcionando
- Admin login continua separado e inalterado
- Dados existentes de `clientes` nao sao migrados automaticamente - cada militar se cadastra e linka ao seu trigrama

---

## 13. Fora do Escopo (Futuro)

- "Meus Pedidos" - pagina pro usuario ver historico (item no sidebar preparado mas nao implementado)
- Recuperacao de senha (sem servico de email)
- Magic link via WhatsApp
- Notificacoes push
