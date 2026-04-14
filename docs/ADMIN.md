# Guia do Administrador — Senta Pua

> Documentação para quem gerencia o sistema. Se você for o próximo admin (por exemplo, substituindo a Larissa), comece por aqui.

**URL do app:** https://app-senta-pua.pages.dev
**URL do admin:** https://app-senta-pua.pages.dev/admin/login

---

## 1. Visão geral do sistema

O Senta Pua é um app interno do **1/10 GpAv** que gerencia:

| Sistema | O que faz |
|---|---|
| **Guloseimas** | Cantinas (dos Oficiais e dos Graduados). Venda de lanches/bebidas com PIX ou Fiado. |
| **Loja** | Loja de equipamentos militares, com variações (tamanho/cor) e parcelamento. |
| **Café** | Caixinha mensal do café. Assinaturas mensais ou anuais. |
| **Ximboca** | Eventos (ximbocas/churrascos) com rateio de despesas entre participantes. |
| **Usuários** | Contas de militares e visitantes. |

O sistema tem **dois tipos de login**:

- **Admin** — acesso total ao painel. Acessa por `/admin/login` usando email + senha cadastrados nas secret variables do Worker.
- **Usuário** — militar ou visitante cadastrado. Acessa por `/login` (email + senha própria).

---

## 2. Menu lateral do admin

Ao logar como admin, você verá o sidebar com as seguintes seções:

- **Guloseimas** (submenu)
- **Loja** (submenu)
- **Café** (submenu)
- **Ximboca** (submenu)
- **Usuários** (submenu) — gerenciar contas
- **Configurações** — configurações globais

Cada seção é detalhada abaixo.

---

## 3. Guloseimas

Sistema de venda nas cantinas (Oficiais e Graduados).

### Dashboard (`/admin`)
Mostra os números principais:
- Vendido no mês
- Recebido no mês
- Total pendente
- Vendas hoje
- Top devedores (cards)
- Gráfico dos últimos 7 dias

### Pedidos (`/admin/pedidos`)
Lista todos os pedidos das cantinas. Pode filtrar por status e data. Permite:
- Marcar como pago (quando recebe o comprovante fora do app)
- Excluir pedido

### Produtos (`/admin/produtos`)
Cadastro dos itens das cantinas. Campos:
- Nome, emoji, preço, imagem (upload)
- Categoria: **oficiais**, **graduados** ou **geral**
- Estoque (opcional — null = ilimitado)
- Quando estoque chega em 0, o produto é automaticamente marcado como indisponível

### Militares (`/admin/clientes`)
Lista todos os militares que já compraram (com ou sem conta de usuário). Mostra:
- Total comprado / pago / saldo devedor
- Badge **CONTA** se o militar tem conta de usuário
- Badge **VISITANTE** se é de outro esquadrão
- Botões **Bloquear / Desbloquear** (impede novas compras)
- Botão **Excluir** (apaga TUDO do militar: pedidos, cafe, loja, ximboca — use com cuidado)

Ao clicar num militar abre o **extrato completo** (`/admin/clientes/:id`):
- Total pendente em todos os sistemas
- Abas: Guloseimas, Loja, Café, Ximboca
- Botão **Gerar PDF + WhatsApp** (cria PDF unificado e abre WhatsApp pra cobrar)
- Link **"Gerenciar conta de usuário →"** que leva direto pro card da conta em `/admin/usuarios`

### Relatórios (`/admin/relatorios`)
Relatório financeiro com filtro por período. Mostra totais consolidados.

---

## 4. Loja

Venda de equipamentos militares.

### Dashboard (`/admin/loja`)
Números da loja: total vendido, pendente, etc.

### Pedidos (`/admin/loja/pedidos`)
Lista de pedidos da loja. Similar ao de Guloseimas, mas com informação de **parcelas**.

### Produtos (`/admin/loja/produtos`)
Cadastro de produtos da loja. Suporta:
- **Variações**: tamanho e cor com estoque separado por variação
- **Múltiplas imagens**
- Configuração de parcelamento em `/admin/config`

---

## 5. Café (Caixinha)

Assinaturas mensais ou anuais do café das duas salas.

> ⚠️ **Importante:** a página pública `/cafe` foi simplificada — hoje ela funciona apenas como um fluxo de pagamento com valor fixo para visitantes (ou militares do esquadrão que queiram pagar direto). A lista de quem pagou/deve NÃO fica mais pública.

### Dashboard (`/admin/cafe`)
Resumo do café: assinantes, receita do mês, pendentes.

### Mensalidades (`/admin/cafe/mensalidades`)
Controla quem pagou o mês atual. Ações:
- **Gerar mensalidades do mês** — cria os registros de pagamento pendente para todos os assinantes ativos
- **Marcar como pago** (quando recebe o comprovante)
- Filtro por tipo (Oficiais/Graduados) e status

### Estoque Insumos (`/admin/cafe/insumos`)
Controle de insumos do café (filtros, açúcar, etc). Com estoque mínimo.

### Assinantes (`/admin/cafe/assinantes`)
Lista de quem assina a caixinha. Ações:
- **Cadastrar novo assinante** — escolhe tipo (oficial/graduado), plano (mensal/anual) e valor
- **Editar** valor, plano
- **Desativar** (pra quem saiu)

> **Como funciona o valor:**
> - O valor cadastrado no `cafe_assinantes` é o que o militar paga por mês na sala dele.
> - O valor que **visitantes** pagam é separado, editável em `/admin/config` → "Valores Café (Visitante)".

---

## 6. Ximboca

Eventos (ximbocas) com rateio de despesas.

### Dashboard (`/admin/ximboca`)
Visão geral: total arrecadado, eventos abertos, gastos.

### Eventos (`/admin/ximboca/eventos`)
Lista de eventos (churrascos, confraternizações, etc). Permite:
- Criar novo evento (nome, data, valor por pessoa)
- Gerenciar evento → abre página dedicada:
  - Adicionar participantes (com valor individual se for diferente)
  - Registrar pagamentos
  - Registrar despesas (comida, bebida, etc)
  - Ver rateio final

### Estoque (`/admin/ximboca/estoque`)
Inventário de equipamentos/utensílios pra ximbocas (panelas, mesas, etc).

---

## 7. Usuários (`/admin/usuarios`)

**Novo na versão atual.** Gerencia contas de login.

### Filtros no sidebar (submenu)
- **Todos** — todos os usuários cadastrados
- **Ativos** — contas ativas
- **Desativados** — contas desativadas (bloqueadas para login)
- **Visitantes** — apenas militares de outros esquadrões
- **Expirados** — visitantes com acesso pausado ou data vencida

### Filtros na página
- Busca por trigrama ou email
- Filtro de categoria (Oficiais / Graduados / Praças)

### Card de cada usuário mostra
- Foto + trigrama + categoria + cantina do café
- Email
- Badges: **VISITANTE**, **DESATIVADA**

### Ações disponíveis

#### Todos os usuários:
- **Trocar categoria** (Oficial / Graduado/SO / Praça) — recalcula automaticamente qual café ele paga
- **Resetar senha** (modal pede nova senha mínima de 6 caracteres)
- **Desativar conta** (bloqueia login) / **Reativar**
- **Toggle Fiado** (liberar/bloquear fiado pra este usuário)
- **Ver extrato financeiro** → leva pra `/admin/clientes/:id` com todos os pedidos

#### Apenas para VISITANTES (aparece bloco laranja):
- **Expira em:** data de expiração do acesso (editável)
- **Pausado:** checkbox pra bloquear acesso imediatamente
- Badge mostra: `Xd restantes`, `Expira hoje`, `Expirou há Xd`, ou `Pausado`

### Sobre o Fiado
- **Militares do esquadrão:** fiado liberado por padrão
- **Visitantes:** fiado BLOQUEADO por padrão (precisam pagar à vista no PIX)
- Admin pode liberar fiado pra um visitante específico clicando no toggle

### Sobre o acesso do visitante
- Tem **30 dias** de acesso contando da data do cadastro
- Quando expira, o usuário ainda loga mas é redirecionado pra tela **"Acesso Expirado"** com botão de falar no WhatsApp com o admin
- Admin pode **renovar** apenas alterando a data "Expira em" pra uma futura
- Pode **pausar** imediatamente marcando o toggle (útil durante missões em que o militar não pode usar o sistema, por exemplo)

---

## 8. Configurações (`/admin/config`)

Todas as configurações globais do sistema. Seções:

### Nomes dos Catálogos
- **Catálogo 1 (Oficiais)** e **Catálogo 2 (Graduados)** — nomes que aparecem no app. Default: "Cantina dos Oficiais" / "Cantina dos Graduados".

### Caixinha do Café - Salas
- Nomes das salas do café.

### PIX - Guloseimas / Loja
Uma ÚNICA chave PIX usada pra Guloseimas, Loja e também pra receber contato de visitantes expirados.
- **Chave PIX (e-mail)**
- **Nome do recebedor** (máx 25 caracteres, SEM acento — padrão do PIX)
- **Cidade** (8 caracteres)
- **WhatsApp** do responsável (também é pra onde os visitantes com acesso expirado vão pra pedir renovação)

### PIX - Café Oficiais
Chave PIX separada pra recebimento da caixinha do café dos oficiais:
- Chave / Nome / WhatsApp

### PIX - Café Graduados
Chave PIX separada pra caixinha dos graduados:
- Chave / Nome / WhatsApp

### Valores Café (Visitante) ← NOVO
Quanto visitantes pagam pra usar o café. Dois campos:
- **Oficiais** — R$ X,XX
- **Graduados** — R$ X,XX

Esses valores NÃO afetam militares do esquadrão (eles pagam o que está cadastrado em `cafe_assinantes`).

### Loja - Parcelamento
Número máximo de parcelas permitidas na loja (1x, 2x ou 3x).

---

## 9. Cenários comuns

### 🪖 Novo militar do esquadrão chegou
1. Ele mesmo se cadastra em `/cadastro` → **Sim, sou do 1/10 GpAv**
2. Preenche categoria (Oficial/Graduado/Praça) + email + senha + trigrama + SARAM + WhatsApp
3. Pronto. Já aparece em `/admin/usuarios` e pode comprar.

### ✈️ Visitante chegou pra missão/evento
1. Ele mesmo se cadastra em `/cadastro` → **Sou visitante de outro esquadrão**
2. Preenche categoria + esquadrão de origem + demais dados
3. Recebe **30 dias** de acesso automaticamente
4. Em `/admin/usuarios` → filtro **Visitantes** você vê quem chegou
5. Se precisar pausar ou estender, use o bloco laranja no card dele

### 💸 Militar esqueceu a senha
1. `/admin/usuarios` → busca pelo trigrama ou email
2. Clica **Resetar senha**
3. Digita nova senha (mínimo 6 caracteres)
4. Avisa o militar qual é a nova senha

### 🚫 Militar deu baixa
1. `/admin/usuarios` → busca
2. Clica **Desativar**
3. A conta não consegue mais logar, mas o histórico financeiro fica preservado

### 💰 Cobrar um devedor
1. `/admin/clientes` → clica no militar
2. Na tela de extrato, clica **Gerar PDF + WhatsApp**
3. Gera PDF com todos os débitos e abre WhatsApp com texto pronto
4. Anexa o PDF e envia

### 🔄 Mudar valor da caixinha do café visitante
1. `/admin/config` → seção **"Valores Café (Visitante)"**
2. Altera os dois campos (Oficiais / Graduados)
3. Clica **Salvar Tudo** no final da página

### 🎟️ Liberar fiado pra um visitante recorrente
1. `/admin/usuarios` → filtro **Visitantes**
2. Encontra o militar
3. No card dele, vai em **"Fiado:"** e ativa o toggle

---

## 10. Acessos técnicos

### Worker (backend)
- **URL:** https://senta-pua-worker.chamadapoker.workers.dev
- **Conta Cloudflare:** chamadapoker
- Deploy: `npx wrangler deploy` dentro da pasta `worker/`

### Pages (frontend)
- **URL:** https://app-senta-pua.pages.dev
- **Projeto:** app-senta-pua (mesma conta)
- Deploy manual: `npx wrangler pages deploy dist --project-name=app-senta-pua --branch=main`
- **Não tem integração Git automática** — precisa deployar manual após push no GitHub

### Banco de Dados (D1)
- **Nome:** senta-pua-db
- Migrations em `worker/src/db/migrations/` (rodar com `npx wrangler d1 execute senta-pua-db --remote --file=...`)

### Secrets do Worker (configurados no Cloudflare dashboard)
- `JWT_SECRET` — chave pra assinar JWTs
- `ADMIN_EMAIL` — email do admin (login em `/admin/login`)
- `ADMIN_SENHA` — senha do admin
- `FRONTEND_URL` — URL do frontend pra CORS

### Trocar credenciais do admin
1. Dashboard Cloudflare → Workers → senta-pua-worker → Settings → Variables
2. Atualiza `ADMIN_EMAIL` e/ou `ADMIN_SENHA` nos Secrets
3. Redeploya o worker pra aplicar

---

## 11. Problemas comuns

### "Não aparece nada na página após atualização"
- Faça **Ctrl+Shift+R** (hard reload) ou abra em aba anônima
- O service worker do PWA pode ter cache antigo

### "Usuário diz que não consegue logar"
1. Verifica se a conta está ativa em `/admin/usuarios`
2. Se for visitante, verifica data de expiração
3. Se necessário, reseta a senha

### "Visitante não consegue finalizar compra"
- Se ele tentou usar **Fiado**, é esperado — visitantes pagam à vista por padrão
- Se quer liberar, ative o toggle "Fiado" no card dele em `/admin/usuarios`
- Se é PIX e mesmo assim falhou, verifica se o acesso não expirou

### "Preciso apagar um militar duplicado"
- `/admin/clientes` → botão **Excluir** (apaga TUDO relacionado)
- ⚠️ Ação irreversível — todos os pedidos, mensalidades de café, participações em ximboca serão apagados

---

## 12. LGPD — Proteção de dados pessoais

O sistema coleta dados pessoais e está sujeito à **Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018)**. Como responsável pelo sistema (controlador), o admin deve observar:

### Dados coletados
- **Identificação:** email, trigrama (nome de guerra), SARAM
- **Contato:** WhatsApp
- **Categoria militar:** Oficial / Graduado / Praça
- **Esquadrão de origem** (apenas para visitantes)
- **Foto de perfil** (opcional, fornecida pelo próprio usuário)
- **Histórico financeiro:** pedidos, pagamentos, café

### Finalidade do tratamento (base legal: legítimo interesse + consentimento)
- Identificar o militar nas compras nas cantinas e loja
- Enviar cobranças via WhatsApp quando há débito
- Controlar mensalidades do café
- Registrar participação em ximbocas

### Direitos do titular (usuário)
Segundo a LGPD, todo usuário pode:
1. **Confirmar** que seus dados estão cadastrados → ele vê em `/perfil`
2. **Acessar** seus dados → os dados aparecem no perfil dele
3. **Corrigir** dados incompletos/errados → botão "Salvar Alterações" em `/perfil`
4. **Excluir** seus dados → botão "Excluir minha conta" em `/perfil` (exclusão completa)
5. **Revogar consentimento** a qualquer momento (equivale a excluir a conta)

### Atribuições do admin
- **Nunca compartilhe** dados de militares com terceiros sem autorização
- Cobranças via WhatsApp são permitidas (finalidade legítima da cantina)
- Ao desligar um militar, avalie se deve **desativar** (mantém histórico financeiro) ou **excluir** (apaga tudo)
- Se um militar pedir exclusão, use o botão **Excluir** em `/admin/clientes` ou ele mesmo exclui em `/perfil`
- O PIX e fotos são armazenados no Cloudflare (servidor na nuvem, criptografia HTTPS)
- **Senhas não ficam em texto puro** — são hashadas com PBKDF2 + salt

### Política de Privacidade
Acessível em `/privacidade` (link no rodapé). Texto pronto para o app. Se precisar alterar termos, edite o arquivo `app/src/pages/PoliticaPrivacidade.tsx`.

### Em caso de incidente de segurança
Se houver vazamento de dados, o controlador (chefe da cantina / admin do sistema) deve:
1. Comunicar à **ANPD** (Autoridade Nacional de Proteção de Dados) em até 72h
2. Comunicar os titulares afetados
3. Documentar o incidente e ações tomadas

---

## 13. Arquitetura (pra devs)

- **Frontend:** React 19 + TypeScript + TailwindCSS + Zustand
- **Backend:** Hono (Cloudflare Workers)
- **Banco:** Cloudflare D1 (SQLite serverless)
- **Storage:** Cloudflare R2 (imagens de produtos, fotos de perfil)
- **Auth:** JWT (HS256), tokens admin com 8h, tokens usuário com 30 dias
- **Senhas:** PBKDF2 com salt aleatório, 100k iterações

Código fonte: https://github.com/chamadapoker/senta-pua-guloseimas

Pastas:
- `app/` — frontend React (Vite)
- `worker/` — backend Hono
- `docs/` — documentação (este arquivo)
