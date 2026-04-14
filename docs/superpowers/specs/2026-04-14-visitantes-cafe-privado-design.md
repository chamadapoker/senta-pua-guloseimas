# Design: Sistema de Visitantes + Cafe Privado + Sidebar Reorder

**Data:** 2026-04-14
**Escopo:** Cadastro de visitantes com 30 dias de acesso, refatoracao da pagina de cafe (privacidade), reordenar sidebar, admin gerencia visitantes

---

## 1. Visao Geral

Adicionar fluxo de cadastro de visitantes (militares de outros esquadroes em missao/eventos) com acesso temporario de 30 dias. Remover lista publica de devedores do cafe — informacoes sensíveis ficam no admin e no perfil do militar. Pagina `/cafe` vira fluxo simples de pagamento. Admin pode pausar visitante ou ajustar data de expiracao.

---

## 2. Banco de Dados

### Migration 013_usuarios_visitante

```sql
ALTER TABLE usuarios ADD COLUMN is_visitante INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN esquadrao_origem TEXT;
ALTER TABLE usuarios ADD COLUMN expira_em TEXT;
ALTER TABLE usuarios ADD COLUMN acesso_pausado INTEGER NOT NULL DEFAULT 0;
```

- `is_visitante`: 0 = militar do esquadrao, 1 = visitante
- `esquadrao_origem`: obrigatorio se `is_visitante = 1`, null para militares do esquadrao
- `expira_em`: formato `YYYY-MM-DD`. Null para militares do esquadrao. Para visitante = data do cadastro + 30 dias.
- `acesso_pausado`: 0 = liberado, 1 = pausado pelo admin

### Configuracoes novas

Inserir em `configuracoes` (ou via admin config):
- `cafe_visitante_oficial_valor` — valor do cafe pra visitante oficial (default "20.00")
- `cafe_visitante_graduado_valor` — valor do cafe pra visitante graduado (default "20.00")

---

## 3. Fluxo de Cadastro

### Tela `/cadastro` (modificada)

Substituir o formulario atual por **tela de escolha**:

```
Titulo: "Cadastro"
Pergunta: "Voce e do 1/10 GpAv?"

[  Sim, sou do 1/10  ]  [  Sou visitante de outro esquadrao  ]
```

- **Sim** → mesmo fluxo atual de cadastro (sem mudancas)
- **Nao** → navega para `/cadastro/visitante`

### Nova tela `/cadastro/visitante`

Mesmo form do cadastro atual, mas com:
- Campo extra obrigatorio: **Esquadrao de Origem** (texto livre, uppercase, ex: "2/5 GAV")
- Cabecalho indicando "Cadastro de Visitante"
- Aviso: "Seu acesso sera liberado por 30 dias. Para extensao, fale com o admin da cantina."

Envia para endpoint novo: `POST /api/usuarios/cadastro/visitante`
- Campos: `email, senha, trigrama, saram, whatsapp, categoria, esquadrao_origem`
- Backend seta `is_visitante = 1`, `expira_em = today + 30 days`, `acesso_pausado = 0`
- Cria cliente com `visitante = 1` e `esquadrao_origem`
- Retorna JWT igual ao cadastro normal

---

## 4. Controle de Acesso do Visitante

### Endpoint `/api/usuarios/me` — retorna acesso_bloqueado

Adicionar campo computado no retorno:

```json
{
  "id": 5,
  "email": "...",
  "is_visitante": 1,
  "expira_em": "2026-05-14",
  "acesso_pausado": 0,
  "acesso_bloqueado": false,
  ...
}
```

Logica do `acesso_bloqueado`:
```typescript
const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const acesso_bloqueado = user.is_visitante === 1 && (
  user.acesso_pausado === 1 ||
  (user.expira_em && user.expira_em < hoje)
);
```

### Mesmo campo retornado em `/login`

Para frontend saber ja na resposta do login.

### Frontend — interceptor

No `App.tsx`, adicionar guard `VisitorGuard` que envolve as rotas protegidas (checkout, pedidos, catalogo/compra, loja, cafe, ximboca):
- Se `user && user.acesso_bloqueado`, redireciona para `/acesso-expirado`

### Nova pagina `/acesso-expirado`

- Icone de relogio
- Titulo "Acesso de Visitante Expirado"
- Mensagem: "Seu acesso de 30 dias chegou ao fim (ou foi pausado pelo administrador). Para renovar, fale com a Larissa."
- Botao "Falar no WhatsApp" (usa `pix_guloseimas_whatsapp` do config — mesmo numero dos comprovantes)
- Botao "Sair"

### Rotas permitidas mesmo para visitante expirado

- `/perfil` (so leitura, botao Sair)
- `/acesso-expirado`
- `/` (mostra dashboard com aviso no topo)

---

## 5. Pagina `/cafe` — refatoracao total

### O que remove
- Lista publica de devedores
- Lista de "em dia"
- Tudo relacionado a ver dados de outros militares

### O que vira

Pagina de pagamento com 3 comportamentos baseados na categoria:

**Oficial (logado ou escolheu oficial no fluxo publico):**
- Titulo: "Caixinha do Cafe — Cantina dos Oficiais"
- Valor destacado: "R$ XX,XX / mes" (lido de `cafe_visitante_oficial_valor`)
- Chave PIX (de `pix_cafe_oficial_chave`)
- Nome do recebedor (de `pix_cafe_oficial_nome`)
- Botao "Copiar PIX" (gera payload com valor)
- Botao "Enviar comprovante (WhatsApp)" — usa `pix_cafe_oficial_whatsapp`

**Graduado:**
- Mesma estrutura com valores/chave/whatsapp dos graduados

**Praca (logado):**
- Mensagem "Pracas nao participam de caixinha do cafe"
- Botao voltar para `/`

**Deslogado:**
- Tela inicial com escolha entre "Sou Oficial" / "Sou Graduado" → depois mostra o respectivo fluxo

### Nota importante

Essa pagina agora serve tanto visitante quanto militar do esquadrao. Para militares do esquadrao, eles ainda veem o valor de visitante aqui (valor simplificado). Os detalhes completos (meses pendentes, valores reais da assinatura) ficam no Perfil.

---

## 6. Meu Perfil — Secao "Meu Cafe"

Adicionar na pagina `/perfil` um card novo, aparece para Oficial e Graduado (nao para Praca):

### Card "Meu Cafe" — estrutura

- **Status do mes atual:** badge "Pago" (verde) ou "Pendente" (vermelho)
- **Valor mensal da minha assinatura:** R$ XX,XX (de `cafe_assinantes.valor`)
- **Total pendente:** soma de `cafe_pagamentos` com status = pendente
- Se total pendente > 0:
  - Botao "Pagar tudo via PIX" — gera payload com valor total, copia
  - Botao "Enviar comprovante (WhatsApp)"
- **Historico:** lista dos ultimos 6 pagamentos (referencia mensal, valor, status, data)

### Endpoint novo `GET /api/usuarios/me/cafe`

Retorna:
```json
{
  "tem_assinatura": true,
  "tipo": "oficial",
  "valor_mensal": 15.00,
  "mes_atual": "2026-04",
  "mes_atual_pago": false,
  "total_pendente": 30.00,
  "historico": [
    { "referencia": "2026-04", "valor": 15.00, "status": "pendente", "paid_at": null },
    { "referencia": "2026-03", "valor": 15.00, "status": "pago", "paid_at": "2026-03-05" }
  ]
}
```

---

## 7. Admin — Gestao de Visitantes em `/admin/usuarios`

### Mudancas na pagina existente

1. **Filtro novo:** botao "Visitantes" alem de Todos/Ativos/Desativados/Categoria
2. **Badge:** usuarios com `is_visitante = 1` ganham badge laranja **"VISITANTE"** + esquadrao_origem
3. **Card expandido para visitantes:**
   - Campo "Expira em" (date input) — admin edita e salva
   - Toggle "Pausado" — liga/desliga
   - Indicador visual: se `acesso_bloqueado = true`, borda vermelha no card

### Endpoint novo

```
PUT /api/usuarios/admin/:id/visitante
  Body: { expira_em?: string, acesso_pausado?: number }
  - Valida expira_em formato YYYY-MM-DD
  - Atualiza somente se is_visitante = 1
```

---

## 8. Admin `/admin/config` — Novos Campos

Adicionar 2 campos editaveis:
- "Valor cafe visitante (Oficiais)" — salva em `cafe_visitante_oficial_valor`
- "Valor cafe visitante (Graduados)" — salva em `cafe_visitante_graduado_valor`

Tipo number, formato decimal (R$ X,XX).

---

## 9. Sidebar — Reorder

### Menu USER_NAV

```
1. Dashboard       (/) 
2. Cantina         (/catalogo/oficiais — dropdown: Oficiais/Graduados)
3. Loja            (/loja)
4. Cafe            (/cafe)
5. Ximboca         (/ximboca)
6. Meu Perfil      (/perfil)  <- sempre ultimo
```

### Menu VISITOR_NAV

```
1. Inicio          (/)
2. Cantina         (/catalogo/oficiais — dropdown: Oficiais/Graduados)
3. Loja            (/loja)
4. Cafe            (/cafe)
```

---

## 10. Tipos Frontend

Adicionar em `app/src/types/index.ts`:

```typescript
export interface Usuario {
  id: number;
  email: string;
  trigrama: string;
  saram: string;
  whatsapp: string;
  foto_url: string | null;
  categoria: Categoria;
  sala_cafe: SalaCafe;
  is_visitante?: number;
  esquadrao_origem?: string | null;
  expira_em?: string | null;
  acesso_pausado?: number;
  acesso_bloqueado?: boolean;
  ativo?: number;
  created_at?: string;
}
```

---

## 11. Fluxos Afetados

### Cadastro
- Novo: `/cadastro` = tela escolha
- Novo: `/cadastro/visitante` = form completo com esquadrao_origem
- Existente: `/cadastro` atual vira `/cadastro/militar` (ou continua em `/cadastro` se "Sim" foi clicado — sem novo componente, o mesmo form aparece)

### Login
- Sem mudanca na UI — mesma pagina
- Resposta inclui `acesso_bloqueado`

### App.tsx
- Adiciona rota `/cadastro/visitante`
- Adiciona rota `/acesso-expirado`
- UserAuthLoader ja atualiza user — componentes filhos usam `user.acesso_bloqueado`

---

## 12. Seguranca

- Admin endpoints continuam protegidos por `authMiddleware`
- Visitante expirado/pausado: backend **nao** bloqueia login (frontend intercepta). Motivo: manter UX de mostrar pagina explicativa.
- Backend **bloqueia** acoes criticas (checkout, etc) se `acesso_bloqueado`:
  - `POST /api/pedidos`: retorna 403 se token for de visitante bloqueado
  - Mesma logica em cafe e outros endpoints de acao

### Middleware novo: `visitorActiveCheck`

Aplicado antes de endpoints de acao do usuario:
```typescript
export async function visitorActiveCheck(c, next) {
  const userId = c.get('userId');
  const u = await db.prepare('SELECT is_visitante, expira_em, acesso_pausado FROM usuarios WHERE id = ?').bind(userId).first();
  if (u && u.is_visitante === 1) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (u.acesso_pausado === 1 || (u.expira_em && u.expira_em < hoje)) {
      return c.json({ error: 'Acesso de visitante expirado ou pausado' }, 403);
    }
  }
  return next();
}
```

---

## 13. Fora do Escopo (Futuro)

- Notificacao automatica antes da expiracao do visitante
- Auto-renovacao mediante pagamento
- Pagina publica de Ximboca (rota `/ximboca` ainda nao existe — Ximboca continua admin-only por enquanto, link do sidebar leva a 404 ate ser implementado)
- Integracao real com banco para confirmar pagamento do cafe automaticamente
