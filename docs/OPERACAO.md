# Guia de Operação — Admin

Como usar o painel no dia a dia.

## 1. Primeiro acesso

Ao fazer o primeiro login com as credenciais `ADMIN_EMAIL` / `ADMIN_SENHA` configuradas no worker, o sistema cria automaticamente um `super_admin` no banco. Essa conta pode:
- Criar outros admins
- Editar e remover admins existentes
- Resetar senhas
- Ver e aprovar comprovantes

Admins comuns têm acesso a tudo, exceto gerenciamento de outros admins.

**Adicionar novos admins:** `/admin/admins` → botão "+ Novo Admin".

## 2. Rotina diária

### Manhã
1. **`/admin/comprovantes`** — aprovar comprovantes pendentes que chegaram durante a noite. O badge vermelho na sidebar mostra o contador.
2. **`/admin/pedidos?status=pendente`** — revisar pedidos da cantina abertos.

### Tarde / Final do dia
1. **`/admin/caixa`** — conferir entrou / saiu / saldo do dia (atalho "Hoje").
2. **`/admin/cobrancas`** — se passou do prazo, filtrar "7+ dias" e clicar em "Cobrar todos" para enviar WhatsApp em lote.

## 3. Fluxo de comprovante

Quando o usuário anexa comprovante, ele entra na fila `/admin/comprovantes` com status `aguardando`:

1. Clique no card do comprovante → abre o preview da foto/PDF
2. **Aprovar**: o pedido vira `pago` automaticamente no sistema correspondente (cantina / loja / café / ximboca)
3. **Rejeitar**: informe o motivo (ex: "Comprovante ilegível") — o usuário vê e pode reenviar

Tudo fica gravado em `/admin/auditoria`.

## 4. Gestão da Caixinha do Café

### Adicionar assinante
`/admin/cafe/assinantes` → **+ Novo Assinante**
- `tipo`: oficial ou graduado
- `plano`: mensal (R$ X/mês) ou anual (R$ Y/ano)
- `valor`: valor da mensalidade ou anuidade

### Lançar despesa
`/admin/cafe/despesas` → **+ Nova Despesa**
- Categoria: café (pó), açúcar, leite, filtro, copos, limpeza, equipamento ou geral
- Valor sai do caixa da sala correspondente
- Opcional: número da NF

### Saldo real
Cartões no topo da página de despesas mostram:
- **Entrou** — total recebido dos assinantes (pago)
- **Saiu** — total gasto em despesas
- **Saldo atual** — entrou − saiu
- **Previsto** — saldo + pendências ainda não pagas

### Cobrança automática
O cron roda **dia 1 de cada mês, 00h BRT** e gera automaticamente:
- Mensalidade para todos assinantes do plano mensal
- Em janeiro, cobrança anual para os assinantes do plano anual

Não precisa clicar em nada. Se quiser verificar, veja `/admin/auditoria` → ação `gerar_cobrancas_auto`.

## 5. Gestão da Loja

### Cadastrar produto
`/admin/loja/produtos` → **+ Novo**
- Preço de venda
- **Preço de custo** (opcional mas recomendado — entra no relatório de lucro)
- Variações (ex: tamanho P/M/G, cor azul/preto)
- Até 3 imagens por produto

### Parcelamento
Em `/admin/config → Loja`, define quantas parcelas no PIX são permitidas (até 3x).

### Ver pedidos com parcelas
`/admin/loja/pedidos` mostra cada pedido com suas parcelas individuais, cada uma pode ser aprovada separadamente (via comprovante do cliente).

## 6. Ximboca (eventos)

### Criar evento
`/admin/ximboca/eventos` → **+ Novo Evento**
- Nome, data, valor por pessoa
- Valores alternativos para cerveja e refri (se houver)
- **PIX do responsável** — pode ser diferente por evento (CPF, e-mail, telefone ou chave aleatória)

### QR Code para os participantes
Abre a página do evento e clica **"QR Code"** — baixa PNG ou imprime.
O QR aponta para a página `/ximboca` onde os militares se inscrevem.

### Consumir do estoque
Tem estoque próprio em `/admin/ximboca/estoque` (ex: 50 unidades de picanha, 30 cervejas).
Na página do evento, clique **"Do Estoque"** para debitar e registrar como despesa R$ 0 (custo já foi pago ao comprar o estoque).

## 7. Cobranças

Página `/admin/cobrancas` consolida **todos** os devedores em uma única lista (cantina + loja + café + ximboca).

- **Filtro por atraso**: 7+, 15+, 30+, 60+ dias
- **Breakdown**: vê quanto cada militar deve em cada sistema
- **Mensagem editável**: use `{NOME}`, `{TOTAL}`, `{DETALHE}`, `{DIAS}` no template
- **WhatsApp individual**: clica e abre o chat com mensagem pronta
- **Cobrar todos**: abre todas as abas de WhatsApp em sequência (400ms entre cada para driblar pop-up blocker)

## 8. Relatórios

### Lucratividade (`/admin/lucratividade`)
Filtra por período, mostra por produto:
- Quantidade vendida
- Receita (apenas pedidos pagos)
- Lucro = receita − custo (só funciona se `preco_custo` estiver cadastrado)
- Margem %

Cores:
- 🟢 Verde — margem ≥ 30%
- 🟡 Amarelo — margem 0–30%
- 🔴 Vermelho — margem negativa (prejuízo)

### Caixa Consolidado (`/admin/caixa`)
Visão única de todo o negócio. Ideal para prestação de contas mensal.
- Atalhos: Hoje, Este mês, Tudo
- 5 cards de totais: Entrou / Saiu / Saldo / Pendente / Previsto
- Tabela de entradas por módulo
- Tabela de saídas

### Auditoria (`/admin/auditoria`)
Log de ações sensíveis: aprovação/rejeição de comprovantes, criação/exclusão de admins, execução do cron.
Paginado, com busca por e-mail do admin, ação ou ID da entidade.

## 9. Segurança & Recuperação

### Conta bloqueada por rate limit
Se um admin tentou senha errada 5x em 15 min, fica bloqueado. Espere 15 min ou peça a um super_admin para resetar a senha em `/admin/admins`.

### Super_admin esqueceu a senha
Acesse o Cloudflare dashboard → D1 → senta-pua-db e execute:
```sql
UPDATE admins SET senha_hash = 'HASH_NOVO' WHERE email = 'email@aqui';
```
Onde `HASH_NOVO` é gerado pela função `hashPassword` (formato `saltHex:hashHex`).
Alternativa mais simples: rode `wrangler secret put ADMIN_SENHA` com nova senha e delete o registro atual em `admins` — na próxima login o bootstrap cria novo super_admin.

### Ver histórico do que foi alterado
`/admin/auditoria` mostra dados **antes e depois** de cada ação importante.

## 10. PWA e Updates

Sempre que um novo deploy é feito, usuários que têm o app instalado vêem um toast azul **"Nova versão disponível"** com botão "Atualizar agora". O app recarrega e serve a nova versão.

Se alguém quiser forçar: **Ctrl+Shift+R** no navegador limpa o cache do service worker.

---

Dúvidas técnicas, consulta o [`README.md`](../README.md).
