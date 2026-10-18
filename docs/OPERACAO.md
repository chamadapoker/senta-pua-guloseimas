# Guia de rotina do admin

Como usar o painel no dia a dia. Para a descrição de cada tela, veja [`ADMIN.md`](./ADMIN.md). A mesma informação, resumida, fica dentro do sistema em **Documentação** (menu lateral), junto com a versão atual do app.

Todas as datas e horários do sistema seguem o horário de Brasília.

---

## Antes de começar

### Primeiro acesso

No primeiro login com o e-mail e a senha definidos nos secrets do worker (`ADMIN_EMAIL` / `ADMIN_SENHA`), o sistema cria esse administrador como **super admin**. O super admin cria os demais em **Pessoas → Administradores → Novo administrador**.

No formulário de administrador:

- **Acesso**: "Acesso total" (todo o painel) ou "Só o café dos graduados".
- **Papel** (só para acesso total): "Admin (uso normal)" ou "Super admin (gerencia outros admins)". Quem tem acesso restrito ao café é sempre admin comum.
- **Senha**: mínimo de 8 caracteres. Ao editar, deixe em branco para manter a atual.

### Como o menu funciona

- **Computador**: o menu azul-noite fica recolhido (só ícones) e abre ao passar o mouse. O botão de alfinete no topo do menu ("Manter o menu aberto") deixa ele fixo; a escolha fica guardada no navegador.
- **Celular**: a barra flutuante embaixo mostra os atalhos da área em que você está. O botão **Menu** abre o menu completo.
- O número vermelho em **Comprovantes** (menu e barra do celular) é a quantidade aguardando aprovação.

---

## Manhã

1. **Painel** (`/admin`): veja o quadro **Precisa de atenção**. Ele lista comprovantes aguardando, pedidos pendentes e militares com dívida, cada um com link direto.
2. **Financeiro → Comprovantes**: aprove o que chegou durante a noite.
   - A cor na borda do cartão indica a origem: cantina, loja, café ou ximboca.
   - O tempo de espera aparece no cartão e fica vermelho depois de 24 horas. Comece por esses.
   - Toque na miniatura para ver o arquivo. **Aprovar** marca o pagamento como pago na área certa. **Rejeitar** pede o motivo, que o militar recebe no app.
3. **Cantina → Pedidos**: filtre **Pendentes** e confira os pedidos ainda abertos.

## Tarde ou fim do dia

1. **Financeiro → Caixa consolidado**: atalho **Hoje** para conferir o que entrou, saiu, o saldo e o que falta receber.
2. **Painel → Visão geral**: acompanhe vendas por dia, horário de pico e formas de pagamento. Troque entre 7, 30 e 90 dias; cada número compara com o período anterior. O botão **Tabela** em cada gráfico mostra os valores em lista.
3. **Financeiro → Cobranças**: se houver atraso, filtre por "7 dias ou mais" (ou 15, 30, 60) e cobre pelo WhatsApp, individualmente ou com **Cobrar todos**.

## Dia 1

O sistema faz sozinho, à meia-noite:

- Lança a **mensalidade do café** de todos os assinantes mensais ativos e avisa cada um no sino de notificações. Se a rotina falhar no dia 1, ela tenta de novo nos dias 2 a 5 sem duplicar.
- **Renova as anuidades vencidas**: assinante anual cuja anuidade terminou recebe a próxima, de 12 meses.
- Registra o **fechamento do RP** na Auditoria (ação `fechamento_mensal_rp`): quantidade de devedores, valor total e os maiores devedores.

O que conferir:

1. **Café → Mensalidades**: o mês novo deve estar lançado nas duas salas. Use o seletor de sala no topo. Se faltar alguém, **Gerar mensalidades** lança o mês escolhido (só plano mensal; quem já tem a cobrança é pulado).
2. **Financeiro → Auditoria**: busque `gerar_cobrancas_auto` para ver quantas cobranças foram criadas. Se aparecer `cron_falhou`, alguma rotina deu erro (o campo entidade diz qual).
3. **Cantina → Contas dos militares**: escolha **Mês passado** e gere as cobranças do mês que fechou (veja "Fim do mês").

## Dia 10

O sistema envia, sozinho, um aviso no app para quem ainda tem mensalidade ou anuidade do café em aberto, com o total. Depois desse dia, confira em **Café → Mensalidades** (filtro de pendentes) quem continua devendo e cobre pessoalmente ou pelo WhatsApp.

## Fim do mês

1. **Cantina → Contas dos militares**:
   - Escolha o período: **Este mês**, **Mês passado**, **Últimos 30 dias**, **Tudo** ou datas em **De** e **Até**.
   - Os cartões mostram militares, quantos têm dívida e o total em aberto no período. Filtre **Com dívida** e ordene por **Maior saldo devedor**.
   - Abra o militar: o extrato já vem filtrado pelo mesmo período, com abas de cantina, loja, café e ximboca.
   - **Gerar PDF e cobrar no WhatsApp** gera o PDF só com os lançamentos do período e abre a conversa com a mensagem pronta. Anexe o PDF e envie.
2. **Café → Despesas** (cada sala): lance as compras do mês e confira entrou, saiu, saldo atual e saldo previsto.
3. **Financeiro → Caixa consolidado**: atalho **Este mês** para a prestação de contas.
4. **Cantina → Lucratividade**: receita, custo e margem por produto (só pedidos pagos e só produtos com preço de custo).

---

## Situações comuns

### Militar pagou fora do app

Abra o extrato dele (Contas dos militares) e use **Marcar como pago** no lançamento. Para o café, também dá para marcar em **Café → Mensalidades**.

### Militar trocou de categoria

Em **Pessoas → Usuários do app**, troque a categoria no card. A assinatura do café muda de sala junto. Se ele virou praça, a assinatura é desativada, porque praça não participa do café.

### Novo assinante do café

**Café → Assinantes → Novo assinante**. Digite o trigrama: se o militar tiver conta, a sala vem da categoria dele. Escolha o plano e deixe o valor vazio para usar o padrão da sala (Configurações → Valores). A primeira cobrança já é criada: no mensal, o mês atual; no anual, 12 meses a partir de agora. Na lista, o anual mostra "Válido até".

### Evento de ximboca

1. **Ximboca → Eventos → Novo evento**: nome, data, valor padrão e, se houver, valores com cerveja ou refri.
2. PIX do responsável: escolha o tipo da chave e confira a linha **"Vai no QR como …"**.
3. No evento, aba **Divulgação**: página pública e QR code para mandar no grupo; tipos de ingresso; check-in pelos recepcionistas.
4. Use **Do estoque** para gastar o que sobrou de eventos anteriores (entra como despesa de R$ 0).

### Pagamento PIX dá "chave não encontrada"

- Confira o formato: telefone como `+55DDDNÚMERO`, CPF só dígitos, e-mail em minúsculas. Em **Configurações → PIX**, escreva o telefone já com `+55`.
- Se a chave está certa e o erro continua, a chave não está cadastrada no banco do titular. O titular precisa cadastrá-la no banco dele.
- O nome do recebedor vai dentro do código: sem acento e com no máximo 25 letras.

### Militar não consegue comprar

- Compra na cantina exige login.
- Fiado sem login é recusado. Visitante não tem fiado, a menos que você ligue o **Fiado** no card dele.
- Conta desativada, militar bloqueado em Contas dos militares, ou visitante vencido ou pausado não compram.

### Militar quer excluir a conta

Ele exclui em **Meu perfil**, com a senha. O sistema recusa enquanto houver valor em aberto em qualquer área. Se ele não conseguir, o super admin pode usar **Excluir conta** em Usuários do app (apaga tudo, sem volta).

### Admin bloqueado no login

Depois de 5 senhas erradas em 15 minutos, o login fica bloqueado por 15 minutos. Espere, ou peça ao super admin para definir uma nova senha em **Administradores → Editar**.

### Tirar o acesso de um admin

**Administradores → Desativar**. O acesso é cortado na hora, porque o sistema confere o admin a cada ação.

### Apareceu "Nova versão disponível"

Toque em **Atualizar agora**. Se uma tela falhar logo depois de uma atualização, o app recarrega sozinho. Se aparecer a tela de erro, use **Recarregar** e, se continuar, **Limpar e recarregar**.

---

## Responsável pelo café dos graduados

Quem tem acesso "Só o café dos graduados" entra direto no painel do café dessa sala. O menu tem:

- **Café**: Painel, Assinantes, Mensalidades, Despesas e Insumos, sempre da sala dos graduados.
- **Comprovantes**: só os do café dos graduados.
- **Configurações do café**: nome da sala, chave PIX, valores padrão (mensal e anual) e **Trocar minha senha**.

A rotina é a mesma do café acima: no dia 1, conferir as mensalidades; aprovar os comprovantes; lançar as despesas; no fim do mês, conferir o saldo. Qualquer outra tela ou ação é recusada pelo servidor.

---

Dúvidas técnicas: [`README.md`](../README.md).
