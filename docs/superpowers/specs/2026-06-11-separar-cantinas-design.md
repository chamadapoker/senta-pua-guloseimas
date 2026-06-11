# Design: Separação das Cantinas (Oficiais × Graduados)

**Data:** 2026-06-11
**Status:** Aprovado para implementação

## Contexto e problema

Dois usuários (entre eles o DGS, praça) relataram não conseguir comprar na cantina.
A investigação em produção mostrou que **não é bloqueio de usuário** — é falta de
produtos compráveis na cantina dos Graduados:

1. **A "esgotado automático" é de mão única.** Em `worker/src/routes/pedidos.ts`,
   toda venda roda `UPDATE produtos SET disponivel = 0 WHERE estoque <= 0`. Isso
   **desliga** o produto quando o estoque zera, mas **nada religa** quando o admin
   repõe estoque. Resultado: 4 produtos ficaram com estoque cheio porém invisíveis
   (`disponivel = 0`): Energético Monster (geral, est. 10), Energético Baly (geral,
   est. 10), Coca-Cola Zero (oficiais, est. 10), Red Bull (oficiais, est. 10).

2. **A cantina dos Graduados depende só dos produtos `geral`.** Não existe nenhum
   produto cadastrado na categoria `graduados`. O catálogo de graduados mostra
   `graduados` + `geral`. Como os 2 únicos `geral` (Monster, Baly) estão presos em
   ESGOTADO, a cantina dos Graduados fica 100% esgotada → graduados e praças (que
   compram junto com graduados) não conseguem adicionar nada ao carrinho.

O `clientes.ativo` do DGS é `1` (não bloqueado); ele inclusive comprou KitKat
(categoria `oficiais`) em 08/06 pela Cantina dos Oficiais. O relato bate com ele
tentando a Cantina dos Graduados. O "após o pagamento do mês" é coincidência de
quando perceberam — não há ligação no código entre pagar e travar a compra.

## Decisões (alinhadas com o usuário)

- **Separação de gestão/estoque, não de acesso.** Todos continuam vendo as duas
  cantinas no menu. Cada cantina passa a ter produtos e estoque próprios.
- **Fim do "geral" compartilhado.** Cada produto pertence a exatamente uma cantina
  (`oficiais` ou `graduados`). Para vender o mesmo item nas duas, cadastra-se duas
  vezes, uma em cada cantina, cada uma com seu estoque.
- **Duas cantinas apenas:** Oficiais e Graduados. Praças compram na dos Graduados.
- **Produtos `geral` existentes (Monster, Baly) → Oficiais.**
- **Cantina dos Graduados nasce vazia;** o admin abastece pelo painel.
- **Loja é uma só** — fora de escopo, não será alterada.

## Mudanças

### 1. Migration `worker/src/db/migrations/025_separar_cantinas.sql`

```sql
-- Move produtos "geral" para a cantina dos Oficiais (decisão de negócio)
UPDATE produtos SET categoria = 'oficiais' WHERE categoria = 'geral';

-- Correção pontual: religa produtos reabastecidos mas presos em ESGOTADO
UPDATE produtos SET disponivel = 1
  WHERE disponivel = 0 AND estoque IS NOT NULL AND estoque > 0;
```

Observações:
- **Não** recriamos a tabela `produtos` (evita risco em produção com a FK de
  `itens_pedido.produto_id`). O `CHECK (categoria IN ('oficiais','graduados','geral'))`
  permanece aceitando `geral` por segurança, mas nada novo será criado como `geral`
  (o default da API muda e a UI remove a opção). Travar o `CHECK` no banco pode ser
  feito depois, se desejado.

### 2. Catálogo — filtro estrito (`worker/src/routes/produtos.ts`)

O endpoint público `GET /api/produtos` passa a filtrar **apenas** pela categoria
pedida, sem incluir `geral`:

```ts
const cat = c.req.query('categoria');
let sql = 'SELECT * FROM produtos';
const params: string[] = [];
if (cat) { sql += ' WHERE categoria = ?'; params.push(cat); }
sql += ' ORDER BY ordem ASC';
```

(Hoje: `... AND (categoria = ? OR categoria = 'geral')`.)

O default de categoria no `POST /api/produtos` muda de `'geral'` para `'oficiais'`.

### 3. Correção do bug de reabastecimento

Tornar a disponibilidade acompanhar o estoque ao **repor**, sem perder o controle
manual.

- **Backend** (`worker/src/routes/produtos.ts`, handler `PUT /:id`): quando o corpo
  inclui `estoque`:
  - `estoque > 0` **e** `disponivel` não veio no corpo → setar `disponivel = 1`.
  - `estoque = 0` → setar `disponivel = 0`.
  - `estoque = null` (vazio = ilimitado) → **não** mexe em `disponivel`.
  - Se `disponivel` veio explícito no corpo, ele prevalece (admin no controle).
- **Admin (UI)** (`app/src/pages/admin/Produtos.tsx`): ao digitar `estoque > 0` no
  formulário, ligar automaticamente o toggle "Disponível" (admin pode desligar de
  novo antes de salvar). Ao digitar `estoque = 0`, desligar.
- O desligar-ao-zerar na venda (`pedidos.ts`) permanece como está — está correto.

### 4. Admin — Produtos (`app/src/pages/admin/Produtos.tsx`)

- Seletor "Sala": remover a opção **"Geral (ambas)"**. Apenas **Sala dos Oficiais**
  e **Sala dos Graduados**. Estado `categoria` inicia em `'oficiais'`.
- Tipo do estado: `'oficiais' | 'graduados'`.
- Selo da categoria no card: remover o ramo "📋 Geral".
- Aplicar o auto-ligar do toggle ao alterar estoque (item 3).

### 5. Tipos (`app/src/types/index.ts`)

`Produto.categoria` passa de `'oficiais' | 'graduados' | 'geral'` para
`'oficiais' | 'graduados'`.

### 6. Sem mudança

- **Menu/Sidebar:** continua mostrando "Cantina dos Oficiais" e "Cantina dos
  Graduados" para todos (separação é de estoque, não de acesso).
- **Loja:** intocada (loja única).

## Plano de testes / verificação

1. `GET /api/produtos?categoria=oficiais` retorna oficiais (incl. Monster e Baly) e
   **nenhum** produto que não seja oficial.
2. `GET /api/produtos?categoria=graduados` retorna apenas produtos graduados
   (inicialmente vazio).
3. Criar produto no admin força escolher Oficiais ou Graduados (sem "Geral").
4. Editar um produto com `estoque` 0 → 10 faz ele voltar a aparecer (disponível).
5. Pós-migration em produção: confirmar que os 4 produtos presos voltaram a
   `disponivel = 1` e que nenhum produto ficou com categoria `geral`.

## Fora de escopo

- Separação de acesso por categoria (não pedida).
- Cantina de praças (praças compram na dos Graduados).
- Correção do mesmo padrão de "esgotado de mão única" na Loja (loja é uma só; pode
  ser tratado em trabalho futuro).
- Travar o `CHECK` do banco removendo `'geral'` (opcional, futuro).
