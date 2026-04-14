# Design: Dashboard do Usuario + Categoria Militar + Cantina

**Data:** 2026-04-14
**Escopo:** Dashboard personalizado para usuario logado, categoria militar no cadastro, atribuicao automatica de caixinha do cafe, renomear Sala para Cantina, gestao admin de contas

---

## 1. Visao Geral

Adicionar categoria militar (Oficial / Graduado-SO / Praca) ao cadastro. Usar essa categoria para atribuir automaticamente a caixinha do cafe. Usuario logado ve um dashboard com seus debitos, status do cafe e pedidos recentes ao inves da home publica. Admin gerencia contas dentro da tela de Militares existente.

---

## 2. Banco de Dados

### Alteracoes em `usuarios`

```sql
ALTER TABLE usuarios ADD COLUMN categoria TEXT NOT NULL DEFAULT 'praca';
ALTER TABLE usuarios ADD COLUMN sala_cafe TEXT;
```

- `categoria`: obrigatorio no cadastro. Valores aceitos: `oficial`, `graduado`, `praca`
- `sala_cafe`: derivado automaticamente. Valores: `oficiais`, `graduados`, ou NULL (praca)

D1 nao suporta CHECK em ALTER, entao validacao fica no worker.

### Regras de Mapeamento

Sempre que categoria for setada/atualizada:
- `oficial` → `sala_cafe = 'oficiais'`
- `graduado` → `sala_cafe = 'graduados'`
- `praca` → `sala_cafe = NULL`

---

## 3. Cadastro — Categoria Militar

No formulario `UserCadastro.tsx`, adicionar seletor de 3 botoes acima do email:

```
Categoria Militar *
[  Oficial  ]  [  Graduado/SO  ]  [  Praca  ]
```

- Obrigatorio selecionar
- Visual: 3 botoes lado-a-lado, selecionado fica azul (`bg-azul text-white`), outros `bg-fundo text-texto-fraco`
- Validacao: se nao selecionado, mostra erro "Selecione sua categoria militar"

Endpoint `/api/usuarios/cadastro`:
- Aceita `categoria` como campo obrigatorio
- Valida que e um dos 3 valores
- Deriva `sala_cafe` automaticamente antes de inserir

---

## 4. Dashboard do Usuario (rota `/`)

Quando `useUserAuth().user` existe, a Home renderiza o Dashboard. Caso contrario, Home publica normal.

### Estrutura Visual

**Topo (header do dashboard):**
```
[Foto 60x60] Bem-vindo, RET
             Oficial
```

**Card 1: Caixinha do Cafe (se sala_cafe != null)**
```
☕ Caixinha do Cafe (Cantina dos Oficiais)
Mes atual: R$ 50,00
[ ✓ Pago ]  ou  [ ⚠ Pendente ] [Pagar]
```

**Card 1 alternativo: (se sala_cafe == null / Praca)**
```
☕ Caixinha do Cafe
Voce nao participa de caixinha do cafe.
```

**Card 2: Debito Total**
```
💰 Debito Total
R$ 125,30
[Pagar tudo via PIX]  (so aparece se > 0)
```

**Card 3: Ultimos Pedidos (lista)**
```
Ultimos Pedidos
├ 2 Brigadeiros + 1 Coca    R$ 12,00   Pago    hoje
├ 1 Chocolate               R$ 3,50    Fiado   ontem
└ ...
[Ver todos]
```

**Atalhos Rapidos (grid 2x2 ou 2x3):**
- Cantina dos Oficiais → `/catalogo/oficiais`
- Cantina dos Graduados → `/catalogo/graduados`
- Meu Cafe → `/cafe` (apenas se `sala_cafe != null`)
- Meu Perfil → `/perfil`

---

## 5. Endpoint Dashboard

```
GET /api/usuarios/me/dashboard
  Auth: user token
  Retorna:
  {
    user: { id, email, trigrama, categoria, sala_cafe, foto_url },
    debito_total: number,     // soma de pedidos fiado nao pagos
    ultimos_pedidos: [
      { id, total, status, metodo_pagamento, itens_resumo, created_at }
    ],
    cafe_status: {
      mes_atual: string,      // "2026-04"
      pago: boolean,
      valor: number | null
    } | null                  // null se sala_cafe == null
  }
```

### Implementacao
- Busca `cliente_id` pelo trigrama do usuario
- `debito_total`: SUM de `pedidos.total` WHERE `cliente_id = ?` AND `status = 'fiado'`
- `ultimos_pedidos`: ultimos 5 pedidos do cliente, ordenados por `created_at DESC`, com `itens_resumo` agregado
- `cafe_status`: se `sala_cafe != null`, busca em `cafe_pagamentos` pelo mes atual + `cafe_assinantes.trigrama = user.trigrama`

### Integracao com Cafe existente

Verificar como o `cafe_assinantes` liga ao militar atual. Se a tabela usar `nome_guerra` ou similar, linkar pelo trigrama. Se usar outro identificador, criar um ponto de linkagem.

Nota: esta integracao precisa ser verificada no momento da implementacao lendo o schema atual de `cafe_assinantes` e `cafe_pagamentos`. Se nao houver linkagem direta, o dashboard mostra "Voce nao assinou a caixinha do cafe ainda" com link pro admin.

---

## 6. Renomear Sala → Cantina

### Textos estaticos afetados

Procurar e substituir nos arquivos `.tsx`:
- "Sala dos Oficiais" → "Cantina dos Oficiais"
- "Sala dos Graduados" → "Cantina dos Graduados"
- Variaveis tipo `nome_sala_oficiais` continuam com o mesmo nome interno (nao renomear schema/config), so mudar valor default mostrado ao usuario

### Valores default em Home/Catalogo

Mudar os defaults de `'Sala dos Oficiais'` para `'Cantina dos Oficiais'` e idem graduados em todos os lugares que tem fallback.

### Configuracoes

Os campos `pix_guloseimas_*`, `nome_sala_*` em `configuracoes` continuam com esses nomes internos — so muda o texto default.

---

## 7. Pagina do Cafe (rota `/cafe`)

Comportamento condicional:

```
Se user logado E user.sala_cafe != null:
  -> auto-navega para /cafe?sala=<user.sala_cafe> e trata como hoje

Se user logado E user.sala_cafe == null (Praca):
  -> mostra mensagem "Voce nao participa de caixinha do cafe"
  -> botao "Voltar" para /

Se user deslogado:
  -> comportamento atual (query param sala decide qual mostrar)
```

---

## 8. Admin — Gestao de Contas Integrada

### Tela atual `/admin/clientes`

Adicionar coluna "Conta" na tabela de militares mostrando:
- Icone verde com "Cadastrado" se tem conta de usuario
- Icone cinza com "Sem conta" se nao tem

### Detalhe do militar `/admin/clientes/:id`

Na pagina de extrato do cliente, adicionar secao "Conta de Usuario" (se o militar tem conta):

```
Conta de Usuario
Email: ret@fab.mil.br
Categoria: [Oficial ▼]  (editavel - dropdown)
Status: Ativo / Desativada
[Salvar categoria]  [Resetar senha]  [Desativar conta / Reativar]
```

### Endpoints Admin novos

```
GET /api/usuarios/admin/por-trigrama/:trigrama
  - Busca dados do usuario pelo trigrama do militar
  - Retorna dados ou null se nao tem conta

PUT /api/admin/usuarios/:id/categoria
  Body: { categoria: 'oficial' | 'graduado' | 'praca' }
  - Atualiza categoria
  - Recalcula sala_cafe automaticamente
```

Reaproveita endpoints existentes:
- `PUT /api/usuarios/admin/:id/senha` (resetar)
- `PUT /api/usuarios/admin/:id/desativar`
- `PUT /api/usuarios/admin/:id/ativar`

### Listagem de clientes — endpoint

O endpoint atual que lista clientes (`/api/clientes`) precisa incluir info se o militar tem conta. Adicionar LEFT JOIN com `usuarios` por trigrama:

```sql
SELECT c.*, u.id AS usuario_id, u.categoria AS usuario_categoria,
       u.ativo AS usuario_ativo
FROM clientes c
LEFT JOIN usuarios u ON u.trigrama = c.nome_guerra COLLATE NOCASE
...
```

---

## 9. Home Publica (visual polido)

Quando nao logado, a Home atual continua (tabs Guloseimas/Loja/Cafe). Melhorias visuais:

- Cartoes maiores e com shadow mais suave
- Espacamento ajustado
- Textos: renomear para "Cantina dos Oficiais" e "Cantina dos Graduados"

Sem mudanca de comportamento — login ainda so e exigido no checkout.

---

## 10. Fluxo Completo do Usuario

1. Usuario chega em `/` deslogado → Home publica polida com tabs
2. Adiciona produtos ao carrinho → vai pro checkout
3. Checkout pede login → vai pra `/login` ou `/cadastro`
4. No cadastro: escolhe categoria militar (Oficial/Graduado/Praca)
5. Apos cadastro/login → retorna ao checkout com dados auto-preenchidos
6. Na proxima visita, `/` mostra dashboard com debitos, cafe status, pedidos
7. Pode ir pra `/cafe` e ve so sua sala (se aplicavel)
8. Admin gerencia conta dele em `/admin/clientes/:id`

---

## 11. Migracao de Usuarios Existentes

Ja existe pelo menos um usuario criado (geison? teste?). Para usuarios sem `categoria`:
- Migration seta DEFAULT 'praca' em todos existentes
- Admin pode ajustar manualmente depois pelo painel
- `sala_cafe` fica NULL (correto para praca)

---

## 12. Seguranca

Validacoes:
- Categoria so aceita os 3 valores validos (`oficial`, `graduado`, `praca`)
- Admin endpoints continuam protegidos por `authMiddleware`
- User endpoints continuam protegidos por `userAuthMiddleware`
- Dashboard so retorna dados do usuario autenticado (nunca dados de outro)

---

## 13. Fora do Escopo (Futuro)

- Caixinha do cafe para pracas (usuario vai verificar se e possivel)
- Notificacoes push quando surge debito ou mensalidade
- Historico completo de pagamentos no dashboard
- Exportacao de extrato em PDF pelo usuario
