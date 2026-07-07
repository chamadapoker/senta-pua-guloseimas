# Design: Ximboca — Ingresso com QR + Check-in de portaria

**Data:** 2026-07-07
**Escopo:** Adicionar ao módulo Ximboca: tipos de ingresso com preços diferentes, ingresso individual com QR por participante pago, e uma tela de check-in operada por usuários com o papel **recepcionista** (militares logados; vários podem ter o papel). Inclui capa de imagem no evento.
**Motivação:** Aniversário conjunto 79º (1/10 GPAV) + 48º (3º/10º GAV) em **06/11/2026**. Precisa vender ingressos (mín. R$50) e controlar a entrada na portaria.
**Frente:** A (de 3 — B = Loja com frete/envio; C = Inventário interno. Ver seção 9.)

---

## 1. Visão Geral

O Ximboca já faz inscrição pública, pagamento por PIX do evento, aprovação de comprovante (status `pago`) e controle de despesas/estoque. Falta o **controle de ingresso na entrada**.

Esta frente adiciona:

1. **Tipos de ingresso por evento** (ex: Militar, Convidado, Criança) com valores diferentes.
2. **Ingresso individual** — cada participante **pago** ganha um card com **QR** (o próprio `id` do participante, hex aleatório de 32 caracteres) e um número visível (`#042`).
3. **Papel "recepcionista"** — um admin marca militares como recepcionistas (quantos quiser). Recepcionista logado (ou admin) acessa a tela de check-in.
4. **Check-in de portaria** — o recepcionista abre `/checkin`, escolhe o evento, escaneia o QR pela câmera e o sistema valida/dá baixa online. A auditoria grava o **trigrama de quem** deu a entrada. Fallback manual por busca de nome.
5. **Capa do evento** — imagem (a arte "Save the Date") exibida na inscrição e no ingresso.

**Fora de escopo desta frente:** foto do participante no check-in; pagamento em dinheiro na portaria (definido: **só PIX antecipado**); modo offline (definido: **local tem internet**); link anônimo de porteiro (descartado em favor do papel recepcionista).

**Compatibilidade:** eventos sem tipos de ingresso continuam funcionando com o `valor_por_pessoa` atual. Check-in fica disponível para qualquer recepcionista assim que o admin atribui o papel.

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
ALTER TABLE ximboca_participantes ADD COLUMN checkin_por      TEXT;  -- trigrama do recepcionista

-- Evento: capa (R2)
ALTER TABLE ximboca_eventos ADD COLUMN imagem_url TEXT;

-- Papel de recepcionista (porteiro) — militar logado que pode dar entrada
ALTER TABLE usuarios ADD COLUMN is_recepcionista INTEGER NOT NULL DEFAULT 0;
```

**Notas de modelo:**

- `ximboca_ingresso_tipos` é tabela nova (não reaproveita `valor_cerveja`/`valor_refri`, que são categorias de **consumo de bebida** e limitam a 2 tipos). Assim cada evento define N tipos livremente.
- `valor_individual` (já existe em `ximboca_participantes`) recebe o **snapshot do valor** do tipo escolhido no momento da inscrição.
- `numero_ingresso`: sequencial **por evento**, atribuído na inscrição = `COALESCE(MAX(numero_ingresso), 0) + 1`. Identificador humano; o QR usa o `id`.
- `checkin_at` nulo = não entrou. `checkin_por` = **trigrama** do recepcionista (vem do token do usuário logado, não é digitado).
- `is_recepcionista`: 0/1 em `usuarios`, no mesmo padrão de `permite_fiado`/`is_visitante`. Vários usuários podem ter 1.
- `imagem_url`: mesma estratégia de upload da Loja (R2).

---

## 3. Backend (`worker/src/routes/ximboca.ts` e `usuarios.ts`)

### 3.1 Admin — tipos, capa e stats (protegido por `authMiddleware`)

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/ximboca/eventos/:id/tipos` | Lista tipos de ingresso |
| `POST` | `/api/ximboca/eventos/:id/tipos` | Cria tipo `{ nome, valor, ordem }` |
| `PUT` | `/api/ximboca/tipos/:tipoId` | Edita tipo |
| `DELETE` | `/api/ximboca/tipos/:tipoId` | Remove tipo (bloqueia se em uso) |
| `POST` | `/api/ximboca/eventos/:id/imagem` | Upload da capa → R2 → grava `imagem_url` |
| `GET` | `/api/ximboca/eventos/:id/checkin-stats` | `{ total_pagos, entraram, faltam }` |

### 3.2 Admin — papel recepcionista (em `usuarios.ts`, padrão do `/admin/:id/fiado`)

| Método | Rota | Função |
|---|---|---|
| `PUT` | `/api/usuarios/admin/:id/recepcionista` | Body `{ is_recepcionista: 0\|1 }` |

Além disso: `GET /api/usuarios/admin/lista`, `GET /api/usuarios/me` e o login passam a devolver `is_recepcionista` (para o guard do frontend).

### 3.3 Participante (`userAuthMiddleware`, como já é)

- **Inscrição** — aceita `tipo_ingresso_id`. Se o evento tem tipos, o campo é **obrigatório**; grava `valor_individual = tipo.valor` e atribui `numero_ingresso`.
- **Meus eventos** — retorno estendido com `numero_ingresso`, `tipo_nome`, `checkin_at` e a URL da capa.

### 3.4 Recepcionista — check-in (NOVO middleware `recepcionistaMiddleware`)

`recepcionistaMiddleware` = `userAuthMiddleware` + consulta `is_recepcionista = 1` no `usuarios` (senão 403). Rotas registradas **antes** do `ximboca.use('*', authMiddleware)` (que é do admin).

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/ximboca/checkin/eventos` | Eventos abertos para check-in + stats |
| `GET` | `/api/ximboca/checkin/:eventoId/lista?q=` | Lista de **pagos** (busca por nome) — fallback |
| `POST` | `/api/ximboca/checkin/:eventoId/validar` | Body `{ participante_id }` → valida e dá baixa (grava trigrama em `checkin_por`) |

**Resposta de `/validar`:**

| Estado | Condição | Ação |
|---|---|---|
| `OK` | pago, não entrou, pertence ao evento | grava `checkin_at` + `checkin_por = trigrama` |
| `JA_ENTROU` | pago, `checkin_at` já preenchido | devolve hora da entrada |
| `NAO_PAGO` | participante existe mas status ≠ `pago` | não grava |
| `NAO_ENCONTRADO` | id não existe ou é de outro evento | não grava |

Retorna `{ nome, tipo_nome, numero_ingresso }` para exibir. `/validar` sob **rate-limit** por usuário+IP (só conta tentativas inválidas).

---

## 4. Frontend

### 4.1 Admin — `XimbocaEvento.tsx`
Capa (upload), tipos de ingresso (add/remover com valor), e **painel de entrada** ("X de Y entraram" via `checkin-stats`). Sem geração de link.

### 4.2 Admin — `Usuarios.tsx`
Toggle **Recepcionista** por usuário (mesmo padrão do toggle "Fiado"), chamando `PUT /api/usuarios/admin/:id/recepcionista`.

### 4.3 Participante — `XimbocaPublica.tsx`
Na inscrição, escolhe o **tipo** (se houver). Quando **pago**, mostra o **card de Ingresso**: capa, QR (= id do participante), número `#042`, nome, tipo. Enquanto não pago: "Ingresso liberado após a confirmação do pagamento".

### 4.4 Recepcionista — NOVA página `/checkin` (e `/checkin/:eventoId`)
Protegida por **RecepcionistaGuard** (usuário logado com `is_recepcionista`). `/checkin` lista os eventos abertos; ao escolher um, abre o scanner:
- Câmera lê o QR (`html5-qrcode`) → `/validar` → tela cheia 🟢/🟡/🔴.
- Fallback: busca por nome → tocar → confirmar entrada.
- Contador "X de Y entraram".
Usa o cliente `api` com o `user_token` (não expõe token na URL).

### 4.5 Roteamento — `App.tsx`
Rotas `/checkin` e `/checkin/:eventoId` sob `RecepcionistaGuard`. Um atalho "Check-in" aparece no app para quem é recepcionista.

---

## 5. Dependências novas
- **`html5-qrcode`** (leitura de QR pela câmera). Geração de QR já existe (`qrcode.react`).

---

## 6. Segurança
- Check-in exige **login de usuário com `is_recepcionista = 1`** (ou o admin atribui a si um militar com o papel). Sem link anônimo.
- Auditoria real: `checkin_por` grava o **trigrama** de quem escaneou.
- QR = `id` do participante (hex de 32 chars, não enumerável).
- `/validar` sob rate-limit por usuário+IP, contando só tentativas inválidas.
- Entrada só valida com status `pago`. Dupla entrada bloqueada por `checkin_at`.

---

## 7. Fluxo ponta-a-ponta (aniversário)
1. Admin cria o evento, sobe a capa e cadastra tipos: Militar R$50, Convidado R$70, Criança R$25 (exemplo).
2. Admin marca os militares da portaria como **recepcionistas** em `/admin/usuarios`.
3. Divulga `/ximboca`. Militar se inscreve, escolhe o tipo, paga o PIX, envia comprovante.
4. Admin aprova → status `pago` → participante vê o **Ingresso com QR**.
5. No dia, cada recepcionista faz login, abre `/checkin`, escolhe o evento e escaneia.
6. 🟢 ENTROU / 🔴 pendente / 🟡 já entrou. Contador sobe. Auditoria registra quem deu a entrada.

---

## 8. Verificação
Projeto **sem testes automatizados** — rede de segurança = build + manual.
- `pnpm build:app` passa; worker compila com `wrangler deploy --dry-run`.
- Migration aplicada em D1 remoto.
- Teste manual do fluxo da seção 7, incluindo: recepcionista sem papel → bloqueado; com papel → entra; verde/amarelo/vermelho; fallback manual.

---

## 9. Contexto das outras frentes (não implementar agora)
- **Frente B — Loja com envio:** falta endereço de entrega + frete + envio × retirada em `loja_pedidos`/checkout.
- **Frente C — Inventário interno:** módulo novo para itens que a RP compra e não vende (brindes, quadros, facas, mochilas). Cada item guarda nome, finalidade (ex: presente), quantidade comprada, valor de compra e o fornecedor (nome, contato/WhatsApp, endereço) — provável tabela `fornecedores` separada.

Cada frente tem seu próprio spec → plano → implementação.
