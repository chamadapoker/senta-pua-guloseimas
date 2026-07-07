# Design: Ximboca — Ingresso com QR + Check-in de portaria

**Data:** 2026-07-07
**Escopo:** Adicionar ao módulo Ximboca: tipos de ingresso com preços diferentes, ingresso individual com QR por participante pago, e uma tela de check-in operada por um "porteiro" (não-admin) via link com token. Inclui capa de imagem no evento.
**Motivação:** Aniversário conjunto 79º (1/10 GPAV) + 48º (3º/10º GAV) em **06/11/2026**. Precisa vender ingressos (mín. R$50) e controlar a entrada na portaria.
**Frente:** A (de 3 — B = Loja com frete/envio; C = Inventário interno. Ver seção 9.)

---

## 1. Visão Geral

O Ximboca já faz inscrição pública, pagamento por PIX do evento, aprovação de comprovante (status `pago`) e controle de despesas/estoque. Falta o **controle de ingresso na entrada**.

Esta frente adiciona:

1. **Tipos de ingresso por evento** (ex: Militar, Convidado, Criança) com valores diferentes.
2. **Ingresso individual** — cada participante **pago** ganha um card com **QR** (o próprio `id` do participante, hex aleatório de 32 caracteres) e um número visível (`#042`).
3. **Check-in de portaria** — uma pessoa de confiança (não precisa ser admin) abre um **link com token**, escaneia o QR pela câmera e o sistema valida/dá baixa online. Fallback manual por busca de nome.
4. **Capa do evento** — imagem (a arte "Save the Date") exibida na inscrição e no ingresso.

**Fora de escopo desta frente:** foto do participante no check-in (participantes não têm foto hoje); pagamento em dinheiro na portaria (definido: **só PIX antecipado**); modo offline (definido: **local tem internet**).

**Compatibilidade:** eventos sem tipos de ingresso continuam funcionando com o `valor_por_pessoa` atual. Check-in só fica ativo quando o admin gera o token do porteiro.

---

## 2. Banco de Dados

### Migration `029_ximboca_ingressos.sql`

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

-- Evento: capa (R2) e token do link do porteiro
ALTER TABLE ximboca_eventos ADD COLUMN imagem_url    TEXT;
ALTER TABLE ximboca_eventos ADD COLUMN checkin_token TEXT;
```

**Notas de modelo:**

- `ximboca_ingresso_tipos` é tabela nova (não reaproveita `valor_cerveja`/`valor_refri`, que são categorias de **consumo de bebida** e limitam a 2 tipos). Assim cada evento define N tipos livremente.
- `valor_individual` (já existe em `ximboca_participantes`) recebe o **snapshot do valor** do tipo escolhido no momento da inscrição — se o preço do tipo mudar depois, o histórico do participante não muda.
- `numero_ingresso`: sequencial **por evento**, atribuído na inscrição = `COALESCE(MAX(numero_ingresso), 0) + 1` para aquele `evento_id`. Serve só como identificador humano ("Ingresso #042"); o QR usa o `id`.
- `checkin_at` nulo = não entrou. `checkin_por` = nome digitado pelo porteiro (auditoria de quem deu a entrada).
- `checkin_token`: segredo aleatório (hex ≥ 24 chars). Nulo = check-in desativado. Regenerar = novo valor (revoga o link antigo).
- `imagem_url`: mesma estratégia de upload da Loja (R2), reaproveitando o padrão de `loja_produto_imagens`.

---

## 3. Backend (`worker/src/routes/ximboca.ts`)

### 3.1 Admin (protegido por `authMiddleware`)

| Método | Rota | Função |
|---|---|---|
| `GET` | `/admin/eventos/:id/tipos` | Lista tipos de ingresso do evento |
| `POST` | `/admin/eventos/:id/tipos` | Cria tipo `{ nome, valor, ordem }` |
| `PUT` | `/admin/tipos/:tipoId` | Edita tipo |
| `DELETE` | `/admin/tipos/:tipoId` | Remove tipo (bloqueia se já houver participante usando) |
| `POST` | `/admin/eventos/:id/imagem` | Upload da capa → R2 → grava `imagem_url` |
| `POST` | `/admin/eventos/:id/checkin-token` | Gera/regenera `checkin_token` (retorna link) |
| `DELETE` | `/admin/eventos/:id/checkin-token` | Revoga (seta `checkin_token = NULL`) |
| `GET` | `/admin/eventos/:id/checkin-stats` | `{ total_pagos, entraram, faltam }` |

### 3.2 Participante (`checkVisitanteSeLogado` / auth de usuário, como já é)

- **Inscrição** (`POST /publico/eventos/:id/participar`) — modificada: aceita `tipo_ingresso_id`. Se o evento tem tipos, o campo é **obrigatório**; grava `valor_individual = tipo.valor` e atribui `numero_ingresso`. Eventos sem tipos mantêm o comportamento atual.
- **Meus eventos** (`GET /publico/meus-eventos`) — retorno estendido com `numero_ingresso`, `tipo_nome`, `checkin_at` e a URL da capa, para renderizar o card de ingresso.

### 3.3 Porteiro — NOVO middleware `checkinTokenMiddleware`

Valida o `:token` da URL contra `ximboca_eventos.checkin_token`. Não usa JWT de admin. Se token inválido/revogado → 403.

| Método | Rota | Função |
|---|---|---|
| `GET` | `/checkin/:token` | Dados do evento (nome, data, capa) + stats. Valida o link. |
| `GET` | `/checkin/:token/lista?q=` | Lista de **pagos** (busca por nome) — fallback manual |
| `POST` | `/checkin/:token/validar` | Body `{ participante_id, porteiro_nome? }` → valida e dá baixa |

**Resposta de `/validar`** (um estado claro):

| Estado | Condição | Ação |
|---|---|---|
| `OK` | pago, ainda não entrou, pertence a este evento | grava `checkin_at` + `checkin_por` |
| `JA_ENTROU` | pago, `checkin_at` já preenchido | não grava; devolve hora da entrada |
| `NAO_PAGO` | participante existe mas status ≠ `pago` | não grava |
| `NAO_ENCONTRADO` | id não existe ou é de outro evento | não grava |

Retorna também `{ nome, tipo_nome, numero_ingresso }` para exibir na tela.
Endpoint `/validar` entra no **rate-limit** existente (`rate_limit_attempts`) por token+IP.

---

## 4. Frontend

### 4.1 Admin — `app/src/pages/admin/ximboca/XimbocaEvento.tsx`

Adicionar ao detalhe do evento:

- **Capa:** upload de imagem (reusa o componente/pattern de upload da Loja).
- **Tipos de ingresso:** lista editável (nome + valor + ordem), adicionar/remover.
- **Link do porteiro:** botão "Ativar check-in" → gera token e mostra o link `.../checkin/<token>` com **copiar** e **revogar/regenerar**. Deixar claro: "quem tiver este link pode dar entrada — não compartilhe além do porteiro".
- **Painel de entrada:** "X de Y entraram" (usa `checkin-stats`).

### 4.2 Participante — `app/src/pages/XimbocaPublica.tsx` (aba "Meus eventos")

Quando o participante está **`pago`**, mostra o **card de Ingresso**:

- Capa do evento no topo.
- **QR** (`QRCodeCanvas`, lib já instalada) com valor = `id` do participante.
- **Número visível** "Ingresso #042", nome, tipo, evento e data.
- Instrução: "Mostre este QR na entrada". Botão baixar/printar.
- Enquanto **não** está pago: mostra "Ingresso liberado após a confirmação do pagamento".

### 4.3 Porteiro — NOVA página `/checkin/:token` → `CheckinPorteiro.tsx`

Rota **pública** (fora do `AdminGuard`/`VisitorGuard`), gated pelo token:

- Cabeçalho: nome/data/capa do evento + contador "X de Y entraram".
- (Opcional na 1ª vez) campo "Seu nome" do porteiro → vai em `checkin_por`.
- **Scanner de câmera** (lib nova `html5-qrcode`): ao ler o QR, chama `/validar` e mostra em **tela cheia**:
  - 🟢 `OK` → "ENTROU — {nome} · {tipo}"
  - 🟡 `JA_ENTROU` → "JÁ ENTROU às HH:MM — {nome}"
  - 🔴 `NAO_PAGO` → "PAGAMENTO PENDENTE — {nome}"
  - 🔴 `NAO_ENCONTRADO` → "INGRESSO INVÁLIDO"
- **Fallback manual:** busca por nome (`/checkin/:token/lista`) → tocar no nome → "Confirmar entrada".
- Câmera exige HTTPS (produção já é) + permissão do usuário.

### 4.4 Roteamento — `app/src/App.tsx`

- Nova rota pública `/checkin/:token` (lazy) sem guard.
- `qrUrl` genérico atual do QR de divulgação continua existindo (cartaz → `/ximboca`); o novo QR de ingresso é **por participante**.

---

## 5. Dependências novas

- **`html5-qrcode`** (leitura de QR pela câmera). Geração de QR já existe (`qrcode.react`).

---

## 6. Segurança

- `checkin_token`: aleatório, revogável, habilita **apenas** o check-in daquele evento — nenhuma outra rota. Não expõe o painel admin.
- QR = `id` do participante (hex de 32 chars, não enumerável). Pior caso de um id vazado: dar entrada em alguém que já pagou.
- `/validar` sob rate-limit por token+IP.
- Entrada só é validada com status `pago` (mantém o gate do comprovante aprovado que já existe).
- Dupla entrada bloqueada por `checkin_at`.

---

## 7. Fluxo ponta-a-ponta (aniversário)

1. Admin cria o evento "79º/48º Aniversário", sobe a capa e cadastra tipos: Militar R$50, Convidado R$70, Criança R$25 (exemplo).
2. Divulga `/ximboca` (QR do cartaz).
3. Militar se inscreve, **escolhe o tipo**, paga o PIX, envia comprovante.
4. Admin aprova → status `pago` → participante vê o **Ingresso com QR** em "Meus eventos".
5. Admin ativa o check-in e passa o **link do porteiro** pra pessoa da portaria.
6. Na entrada: porteiro escaneia → 🟢 ENTROU / 🔴 pendente / 🟡 já entrou. Contador sobe.

---

## 8. Verificação

Projeto **sem testes automatizados** — a rede de segurança é o build (`pnpm build:app`) + teste manual.

- `pnpm build:app` passa.
- Migration aplicada em D1 (`wrangler d1 execute senta-pua-db --remote --file=.../029_ximboca_ingressos.sql`).
- Teste manual do fluxo da seção 7 em produção/preview: inscrição com tipo → aprovar → ver ingresso → check-in (verde), repetir (amarelo), inscrito não-pago (vermelho), id inválido (vermelho), fallback manual.

---

## 9. Contexto das outras frentes (não implementar agora)

- **Frente B — Loja com envio:** a loja já escolhe produto/tamanho/qtd; falta **endereço de entrega + frete + marcar envio × retirada** em `loja_pedidos`/checkout. Para vender os produtos do aniversário a quem mora fora.
- **Frente C — Inventário interno:** módulo novo para itens que a RP compra e **não** vende (brindes, quadros, facas, mochilas). Requisito já levantado: cada item guarda **nome, finalidade (ex: presente), quantidade comprada, valor de compra** e o **fornecedor (nome, contato/WhatsApp, endereço)** — provável tabela `fornecedores` separada para reuso. Detalhar no spec da Frente C.

Cada frente tem seu próprio spec → plano → implementação.
