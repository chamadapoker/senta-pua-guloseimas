# Senta Pua — Sistema de Gestão 1/10 GAV

Sistema integrado de gestão para Cantina, Loja, Caixinha do Café e Ximboca (eventos) do 1º/10º Grupo de Aviação.

**Produção:** https://app-senta-pua.pages.dev
**API:** https://senta-pua-worker.chamadapoker.workers.dev

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind + React Router |
| Backend | Cloudflare Workers + Hono |
| Banco | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 (fotos, comprovantes) |
| Auth | JWT (HS256) + PBKDF2 para senhas |
| PWA | Service Worker com auto-update |
| Deploy | GitHub Actions → Cloudflare (Pages + Workers) |

## Estrutura do repo

```
senta-pua/
├── app/                   # Frontend React (deployado no Cloudflare Pages)
│   ├── src/
│   │   ├── components/    # UI compartilhada (Icon, Button, Badge, BackButton, EnviarComprovante, ...)
│   │   ├── hooks/         # useAuth, useUserAuth, useCart, useComprovantesStatus
│   │   ├── pages/         # Rotas do usuário e admin
│   │   │   └── admin/     # Páginas exclusivas do admin
│   │   ├── services/      # api, pdf, pix, whatsapp
│   │   └── types/         # Tipos TypeScript compartilhados
│   └── public/sw.js       # Service Worker
├── worker/                # Backend Cloudflare Worker
│   ├── src/
│   │   ├── routes/        # Endpoints Hono
│   │   ├── middleware/    # authMiddleware, userAuthMiddleware, visitorActiveCheck
│   │   ├── lib/           # jwt, password, audit, rateLimit, fiado, visitante, categoria
│   │   └── db/migrations/ # Migrations SQL numeradas (001-024)
│   └── wrangler.toml      # Config Cloudflare (bindings D1, R2, cron)
└── .github/workflows/     # Deploy automático (app + worker)
```

## Desenvolvimento local

```bash
pnpm install

pnpm dev:app          # http://localhost:5173
pnpm dev:worker       # http://localhost:8787
pnpm build:app
pnpm deploy:worker    # deploy manual do worker
```

### Variáveis de ambiente

**Frontend** (`app/.env.local`):
```
VITE_WORKER_URL=http://localhost:8787
```

**Worker** (via `wrangler secret put`):
- `JWT_SECRET` — segredo para assinar tokens
- `ADMIN_EMAIL` / `ADMIN_SENHA` — super admin inicial (criado automaticamente no 1º login)
- `FRONTEND_URL` — URL do frontend para CORS

## Deploy automático

| Path modificado | Workflow | Efeito |
|---|---|---|
| `app/**` | `deploy-app.yml` | Build + deploy Cloudflare Pages |
| `worker/**` | `deploy-worker.yml` | Deploy Cloudflare Workers |

**Secrets necessários no GitHub:**
- `CLOUDFLARE_API_TOKEN` (permissões: Workers Edit, Pages Edit, D1 Edit, R2 Edit)
- `VITE_WORKER_URL` (URL pública do worker)

## Migrations D1

Arquivos em `worker/src/db/migrations/NNN_descricao.sql`. Aplicar em produção:

```bash
cd worker
wrangler d1 execute senta-pua-db --remote --file=src/db/migrations/024_rate_limit.sql
```

**Tabelas principais** (25 no total):
- `usuarios`, `admins`, `clientes`
- `produtos`, `pedidos`, `itens_pedido`
- `loja_produtos`, `loja_variacoes`, `loja_produto_imagens`, `loja_pedidos`, `loja_itens_pedido`, `loja_parcelas`
- `cafe_assinantes`, `cafe_pagamentos`, `cafe_insumos`, `cafe_despesas`
- `ximboca_eventos`, `ximboca_participantes`, `ximboca_despesas`, `ximboca_estoque`
- `comprovantes`, `audit_log`, `rate_limit_attempts`, `configuracoes`

## Módulos

### Cantina (`/catalogo/:categoria`)
Pedidos rápidos de guloseimas via PIX, dinheiro ou fiado. Com estoque, bloqueio de inadimplentes e controle por trigrama.

### Loja (`/loja`, `/loja/minhas`)
Produtos maiores (uniformes, brindes) com variações (tamanho/cor), múltiplas imagens e parcelamento no PIX.

### Café (`/cafe`, `/perfil → Meu Café`)
Mensalidade (plano mensal ou anual) com cobrança automática via cron (dia 1 de cada mês, anual em janeiro). Controle de entradas/saídas e saldo real.

### Ximboca (`/ximboca`)
Eventos pontuais (churrasco, festa) com inscrição pública, categoria de consumo (cerveja/refri), PIX do responsável por evento, QR code baixável e controle de despesas conectado a um estoque próprio.

## Painel Admin (`/admin/*`)

| Rota | Função |
|---|---|
| `/admin` | Dashboard Cantina |
| `/admin/pedidos` | Gestão de pedidos (filtros, paginação, busca) |
| `/admin/produtos` | CRUD de produtos + preço de custo |
| `/admin/clientes`, `/admin/clientes/:id` | Militares e extrato unificado |
| `/admin/relatorios` | Relatório de vendas |
| `/admin/lucratividade` | Margem/lucro por produto (cantina + loja) |
| `/admin/usuarios` | Gestão de contas de usuário |
| `/admin/loja/*` | Loja: produtos, pedidos, dashboard |
| `/admin/cafe/*` | Café: assinantes, mensalidades, insumos, despesas, dashboard |
| `/admin/ximboca/*` | Ximboca: eventos, estoque, dashboard |
| `/admin/comprovantes` | Fila de aprovação de comprovantes (todos os módulos) |
| `/admin/cobrancas` | Devedores consolidados + WhatsApp em lote |
| `/admin/caixa` | Caixa consolidado do negócio (entrou/saiu/saldo/previsto) |
| `/admin/auditoria` | Log de ações administrativas |
| `/admin/admins` | Multi-admin (super_admin gerencia) |
| `/admin/config` | Configurações PIX e nomes em abas |

## Fluxo de pagamento

1. **Usuário** faz pedido e escolhe método: PIX, Dinheiro ou Fiado
2. **Usuário** paga fora do app (PIX no banco, cash no balcão)
3. **Usuário** volta no app e clica **"Anexar Comprovante"** no item pendente → upload foto/PDF
4. Status muda para **"Aguardando aprovação"** (badge amarelo)
5. **Admin** vê badge vermelho na sidebar, abre `/admin/comprovantes`
6. **Admin** aprova (automático marca como PAGO) ou rejeita com motivo
7. Ação fica registrada em `audit_log`

## Segurança

- Rotas de "confirmar pagamento" exigem auth + ownership (só o dono do pedido)
- Rate limit no login: 5 tentativas/15min admin, 8/15min user
- Super admin protege rotas críticas (criar/excluir admin)
- Senhas com PBKDF2 + salt único
- CORS restrito à origem do frontend
- Audit log com IP e dados antes/depois

## PWA

- Instalável em Android (Chrome) e iOS (Safari)
- Abre em modo standalone (sem barra de endereço)
- Service Worker com estratégia:
  - `/api/*` → network only
  - HTML → network first (sempre atualizado)
  - Assets com hash → cache first (rápido offline)
- **Auto-update**: toast "Nova versão disponível" aparece automaticamente; checa a cada 30 min e ao voltar pra aba

## Cron automático

- **Dia 1 de cada mês, 00:00 BRT** (03:00 UTC)
- Gera mensalidades para todos assinantes mensais
- Em janeiro, também gera cobrança anual
- Registra execução em `audit_log`

Definido em `worker/wrangler.toml`:
```toml
[triggers]
crons = ["0 3 1 * *"]
```

## Documentação adicional

- **Guia do administrador**: [`docs/ADMIN.md`](docs/ADMIN.md) — uso prático do painel
- **Planos de feature** (históricos): `docs/superpowers/plans/`
- **Specs de design**: `docs/superpowers/specs/`

## Troubleshooting

**"Nada atualiza em produção"** — verifique:
1. Deploy do worker passou em `.github/actions` (filtro correto é `senta-pua-worker`, não `worker`)
2. Deploy do app passou (workflow `deploy-app.yml`)
3. Service Worker está servindo cache — peça ao usuário Ctrl+Shift+R ou clique no toast "Atualizar agora"

**"Comprovante não aparece para o admin"** — verifica se o usuário fez upload; pode estar em `aguardando`. Página `/admin/comprovantes` com filtro status=aguardando.

**"Cron não rodou"** — veja `audit_log` pela ação `gerar_cobrancas_auto`. Se não tiver, confira se o worker está deployado com `wrangler.toml` contendo `[triggers]`.

---

Construído com Claude Code.
