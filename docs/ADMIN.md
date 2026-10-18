# Guia do administrador: referência por área

Documentação para quem gerencia o Senta Pua. Para a rotina do dia a dia (manhã, tarde, dia 1, dia 10, fim do mês), veja [`OPERACAO.md`](./OPERACAO.md). Dentro do sistema, o resumo fica em **Documentação**, com a versão atual do app (a versão também aparece no rodapé do menu).

- **App:** https://app-senta-pua.pages.dev
- **Painel do admin:** https://app-senta-pua.pages.dev/admin/login

Todas as datas, períodos e gráficos seguem o horário de Brasília.

---

## 1. O que o sistema faz

| Área | O que faz |
|---|---|
| **Cantina** | Cantina dos oficiais e dos graduados. Venda com PIX, dinheiro ou fiado. Exige login. |
| **Loja** | Produtos com categorias, variações (tamanho/cor), parcelamento no PIX, retirada ou envio. |
| **Café** | Caixinha do café de duas salas (oficiais e graduados), planos mensal e anual. |
| **Ximboca** | Eventos com rateio, despesas, estoque próprio, divulgação e check-in. |
| **Financeiro** | Comprovantes, cobranças, caixa consolidado e auditoria. |
| **Pessoas** | Usuários do app, aniversariantes e administradores. |
| **Inventário** | Material que a RP compra e não vende (brindes, quadros etc.) e fornecedores. |

Há dois tipos de login:

- **Admin**: entra por `/admin/login` com e-mail e senha cadastrados em Administradores.
- **Usuário**: militar ou visitante. Entra por `/login` com e-mail e senha próprios.

---

## 2. Menu e navegação

- **Computador**: menu lateral azul-noite. Recolhido, mostra só ícones e abre ao passar o mouse. O botão de alfinete no topo ("Manter o menu aberto" / "Recolher automaticamente") fixa ou solta o menu; a escolha fica guardada no navegador.
- **Celular**: barra de navegação flutuante embaixo, com atalhos da área atual (até 4) e o botão **Menu**, que abre o menu completo.
- O contador vermelho em **Comprovantes** mostra quantos aguardam aprovação.
- O rodapé do menu mostra quem está logado, o papel e a versão do app.

Grupos do menu (acesso total): Cantina, Loja, Café, Ximboca, Financeiro, Pessoas, Inventário, Documentação e Configurações.

---

## 3. Painel (`/admin`)

- **Precisa de atenção**: comprovantes aguardando, pedidos pendentes e militares com dívida, cada um com link para a tela certa.
- **Visão geral**: seletor de **7, 30 ou 90 dias**.
  - Cartões: vendido na cantina e na loja (com a variação em relação ao período anterior), dinheiro que entrou (inclui café) e dívida em aberto (com o quanto passa de 30 dias).
  - Gráficos: vendas por dia (cantina e loja), idade da dívida (até 7, 8 a 30, 31 a 60, mais de 60 dias), horário de pico da cantina, formas de pagamento e mais vendidos.
- **Devedores**: lista com link para o extrato e cobrança pelo WhatsApp.

Os painéis da **Loja** (vendas por mês, 6 meses), do **Café** (mensalidades pagas e em aberto por mês, da sala selecionada) e da **Ximboca** (arrecadado e gasto dos 6 eventos mais recentes) também têm gráficos.

Em todo gráfico, o botão **Tabela** mostra os mesmos números em lista; **Gráfico** volta.

---

## 4. Cantina

### Pedidos (`/admin/pedidos`)

Filtros Todos, Pendentes, Fiado e Pagos. Permite marcar como pago (pagamento recebido fora do app) e excluir pedido.

### Produtos (`/admin/produtos`)

Nome, emoji ou foto, preço de venda, **preço de custo** (opcional, usado na Lucratividade), ordem no catálogo, cantina (oficiais ou graduados), disponível e estoque (vazio = sem controle). Quando o estoque chega a zero, o produto fica indisponível. Cartões mostram esgotados e estoque baixo (até 5).

### Contas dos militares (`/admin/clientes`)

- **Filtro de período**: Este mês, Mês passado, Últimos 30 dias, Tudo, ou datas em **De** e **Até**. O período fica na URL (sobrevive a recarregar e acompanha ao abrir o extrato).
- Cartões: quantidade de militares, quantos têm dívida e total em aberto no período.
- Busca por trigrama ou SARAM, ordenação por nome ou maior saldo devedor, filtros Todos, Com dívida, Em dia e Bloqueados.
- **Bloquear / Desbloquear**: impede novas compras na cantina.
- **Excluir**: apaga o militar e todos os pedidos, pagamentos e dados dele. Sem volta.

### Extrato do militar (`/admin/clientes/:id`)

- Mesmo filtro de período; abas Cantina, Loja, Café e Ximboca, com o pendente de cada uma.
- **Marcar como pago** em cada lançamento pendente.
- **Gerar PDF e cobrar no WhatsApp**: gera o PDF só com os lançamentos do período escolhido e abre o WhatsApp com a mensagem.
- **Gerenciar conta de usuário**: leva ao card do militar em Usuários do app.

### Relatórios (`/admin/relatorios`)

Vendas da cantina em um período: total vendido, recebido, pendente ou fiado, número de pedidos.

### Lucratividade (`/admin/lucratividade`)

Receita, custo, lucro e margem por produto, só de pedidos pagos. Só calcula o lucro de produtos com preço de custo. Margem: verde a partir de 30%, âmbar entre 0 e 30%, vermelho negativa.

---

## 5. Loja

### Produtos (`/admin/loja/produtos`)

- **Categorias**: botão no topo. Criar, renomear, mudar a ordem (subir/descer) e excluir. Excluir uma categoria deixa os produtos dela sem categoria; nenhum produto é apagado.
- Filtro por categoria na lista (Todas, cada categoria, Sem categoria).
- Cada produto: categoria (ou criar uma nova na hora), variações com estoque próprio, várias imagens, preço de venda e de custo.
- **Vitrine pública** (`/loja`): produtos agrupados por categoria, na ordem cadastrada, com filtro; os sem categoria aparecem em "Outros".

### Pedidos (`/admin/loja/pedidos`)

Pagamento e entrega de cada pedido. Entrega é **retirada** ou **envio** (com frete). Botões **Marcar pago** e, no envio, **Marcar enviado**. Pedidos parcelados mostram as parcelas; cada parcela é paga com o próprio comprovante (origem "Loja (parcela)").

---

## 6. Café

### Como funciona

- **Duas salas**: oficiais e graduados. Cada sala tem assinantes, PIX, valores padrão, despesas e insumos próprios. O nome de cada sala é definido em Configurações.
- **Seletor de sala** no topo de todas as telas do café (painel, assinantes, mensalidades, despesas, insumos). A sala vai na URL (`?sala=oficial` ou `?sala=graduado`) e é lembrada ao trocar de tela.
- **A sala segue a categoria**: militar com conta entra na sala da categoria dele (oficial → oficiais; graduado/SO → graduados). Trocar a categoria em Usuários move a assinatura ativa para a outra sala. Sem conta no app, o admin escolhe a sala.
- **Praça não participa**: não pode ser cadastrada como assinante; quem passa para praça tem a assinatura desativada.
- **Planos**:
  - **Mensal**: uma cobrança por mês, lançada no dia 1.
  - **Anual**: a anuidade vale **12 meses a partir da adesão** (por exemplo, "Anuidade out/2026 a set/2027"). A lista mostra "Válido até", "Venceu em" ou "Anuidade em aberto". Quando a cobertura termina, o sistema lança a próxima anuidade sozinho.
- **Valor padrão**: Configurações → Valores, por sala e plano. Ao cadastrar um assinante com o valor vazio, vale o padrão.

### Painel (`/admin/cafe`)

Assinantes, recebido no mês, a receber (mensalidades e anuidades em aberto), insumos em alerta e o gráfico de mensalidades da sala.

### Assinantes (`/admin/cafe/assinantes`)

- **Novo assinante**: trigrama (3 letras). O sistema procura a conta: se existir, mostra a sala definida pela categoria; se for praça, não deixa cadastrar. Plano e valor (vazio = padrão da sala). A primeira cobrança é criada na hora (mensal: mês atual; anual: 12 meses a partir do mês atual).
- Ações: **Ver cobranças** (histórico e cobrança manual de um mês ou de uma anuidade), **Editar**, **Desativar / Ativar** e **Excluir** (apaga o assinante e os pagamentos dele).

### Mensalidades (`/admin/cafe/mensalidades`)

Lista da sala, com filtro por status e por mês de referência e totais pendente e pago. **Marcar pago** em cada linha. **Gerar mensalidades** lança um mês escolhido para os assinantes mensais da sala (anuidades não entram; quem já tem a cobrança é pulado).

### Despesas (`/admin/cafe/despesas`)

Despesas da sala selecionada: descrição, valor, data, categoria (café, açúcar, leite, filtro, copos e descartáveis, limpeza, equipamento, geral) e nota fiscal opcional. Cartões: entrou, saiu, saldo atual e saldo previsto (somando as mensalidades pendentes). A despesa não mexe no estoque de insumos.

### Insumos (`/admin/cafe/insumos`)

Estoque de cada item da sala (nome, unidade, estoque e mínimo). Quando chega ao mínimo, o item fica em alerta.

### Tela do militar (`/cafe`)

- Militar do esquadrão vê a sala dele, o plano, "anuidade válida até" (no anual), o total a pagar, o PIX da sala e o histórico. O comprovante é enviado pelo app.
- Visitante escolhe a sala e paga o valor de visitante (Configurações → Valores).
- Praça vê o aviso de que não participa.

### Admin "Só o café dos graduados"

Veja a seção 10.

---

## 7. Ximboca

### Eventos (`/admin/ximboca/eventos`)

- **Novo evento**: nome, data, valor padrão por pessoa e, opcionalmente, valor com cerveja e com refri. Se preencher, o participante escolhe; se não, vale o padrão.
- **PIX do responsável** (opcional, por evento): tipo da chave (CPF, e-mail, telefone ou aleatória), chave, nome do recebedor (sem acento, até 25 letras). Abaixo da chave aparece **"Vai no QR como …"**, exatamente como a chave entra no código PIX.

### Página do evento (`/admin/ximboca/eventos/:id`)

- Topo: pagos, arrecadado, gasto e saldo.
- **Participantes**: adicionar, escolher o consumo, registrar pagamento.
- **Despesas**: lançar gastos; **Do estoque** tira itens do estoque da ximboca e registra despesa de R$ 0.
- **Organização**: tarefas com responsável e cautelas (material emprestado, com baixa na devolução; não entra no estoque).
- **Divulgação**: página pública do evento (aberta, sem login), **QR code** para baixar ou imprimir, tipos de ingresso e check-in na portaria.
- **Check-in**: feito por militares marcados como **recepcionista** em Usuários, pelo menu Check-in.

### Estoque (`/admin/ximboca/estoque`)

Sobras de eventos (bebidas, carvão etc.) para usar nos próximos.

---

## 8. Financeiro

### Comprovantes (`/admin/comprovantes`)

- Abas Aguardando, Aprovados e Rejeitados; busca por trigrama; filtro por origem.
- Cada cartão tem a **cor da origem na borda** (cantina, loja, café, ximboca; a legenda fica acima da lista), miniatura do arquivo, valor e **tempo de espera** ("há 3 h"), que fica vermelho depois de 24 horas.
- **Aprovar**: marca o pagamento como pago na área de origem e avisa o militar.
- **Rejeitar**: exige o motivo. O militar recebe o aviso com o motivo e pode reenviar.

### Cobranças (`/admin/cobrancas`)

Todos os devedores da cantina, loja, café e ximboca em uma lista, com quanto deve em cada área. Filtro de atraso (7, 15, 30 ou 60 dias ou mais). Mensagem editável com as variáveis `{NOME}`, `{TOTAL}`, `{DETALHE}` e `{DIAS}`. WhatsApp individual ou **Cobrar todos** (abre uma aba por devedor; o navegador pode pedir para liberar pop-ups). O cartão "Sem WhatsApp" indica quem precisa ser cobrado pessoalmente.

### Caixa consolidado (`/admin/caixa`)

Atalhos Hoje, Este mês e Tudo, ou período livre. Cartões entrou, saiu, saldo e a receber, mais o previsto (saldo mais o que falta receber). Tabelas de entradas por área e de saídas.

### Auditoria (`/admin/auditoria`)

Histórico com antes e depois das ações sensíveis, paginado, com busca por e-mail, ação ou ID. Registra, entre outras:

- comprovantes aprovados e rejeitados; pagamentos marcados (cantina, loja, parcela, café, ximboca);
- exclusões (pedidos, militares, usuários, assinantes, despesas, categorias da loja, conta excluída pelo próprio militar);
- mudanças de PIX e de configurações (`alterar_config`);
- senhas redefinidas de usuários e senha alterada de admin;
- troca de categoria e movimentação de assinante do café entre salas; liberação de fiado;
- criação, edição e exclusão de administradores;
- rotinas automáticas (`gerar_cobrancas_auto`, `fechamento_mensal_rp`, `lembrete_cafe_pendente`) e falhas (`cron_falhou`).

---

## 9. Pessoas

### Usuários do app (`/admin/usuarios`)

- Busca por trigrama ou e-mail; filtros Todos, Ativos, Desativados, Visitantes e Visitantes expirados; filtro por categoria (oficiais, graduados, praças).
- No card de cada usuário:
  - **Categoria** (oficial, graduado/SO, praça). O café acompanha: a assinatura muda de sala ou, para praça, é desativada.
  - **Fiado**: liberado ou bloqueado.
  - **Recepcionista**: habilita o check-in da ximboca.
  - **Ver extrato financeiro**.
  - Menu: **Editar dados**, **Redefinir senha** (mínimo de 6 caracteres), **Desativar / Reativar conta** e, só para super admin, **Excluir conta** (apaga conta, cliente vinculado, pedidos, café e foto).
- **Visitantes**: bloco "Acesso de visitante" com **Expira em** (editável) e **Pausar acesso**. O visitante recebe 30 dias a partir do cadastro e começa sem fiado. Vencido ou pausado, vai para a tela de acesso expirado e não compra.

### O que o militar vê

- Aviso **Complete seu cadastro** quando falta SARAM (só militar do esquadrão), foto, data de aniversário ou WhatsApp. Botões **Completar agora** e **Lembrar depois** (o aviso some até o fim do dia).
- Compra na cantina exige login. Fiado sem login é recusado, assim como fiado de quem está com o fiado bloqueado.
- **Excluir minha conta** (Meu perfil) pede a senha e é recusado enquanto houver valor em aberto em qualquer área.

### Aniversariantes (`/admin/aniversariantes`)

Personaliza a homenagem (título, mensagem e imagem) que cada militar vê no dia do aniversário. O parabéns no sino é enviado automaticamente.

### Administradores (`/admin/admins`)

Só o super admin cria, edita e exclui administradores.

- **Acesso**: "Acesso total" ou "Só o café dos graduados".
- **Papel** (acesso total): Admin (uso normal) ou Super admin (gerencia outros admins).
- Senha com mínimo de 8 caracteres; ao editar, em branco mantém a atual.
- **Desativar** corta o acesso na hora. Ninguém exclui a si mesmo.
- A lista mostra o papel, o selo "Só café dos graduados", inativos e o último acesso.

---

## 10. Admin "Só o café dos graduados"

Acesso para o responsável pela caixinha dos graduados. O super admin cria em **Administradores → Novo administrador → Acesso: Só o café dos graduados**.

O que ele vê e pode fazer:

- O café da sala dos graduados completo: painel, assinantes, mensalidades, despesas e insumos (o seletor de sala some; fica só a faixa da sala dele).
- Comprovantes: só os do café dos graduados, com aprovar e rejeitar.
- Configurações do café: nome da sala dos graduados, chave PIX, nome do recebedor e WhatsApp dessa sala, valores padrão mensal e anual.
- **Trocar minha senha** (nas configurações do café).

O bloqueio é feito **no servidor**, a cada requisição: qualquer outra tela, ação ou configuração é recusada, mesmo que ele digite o endereço. Assinantes, pagamentos, despesas e insumos da sala dos oficiais não aparecem para ele, e ele não consegue cadastrar um oficial (o militar com conta de oficial é recusado).

---

## 11. Configurações (`/admin/config`)

Abas (o botão **Salvar configurações** salva todas de uma vez):

- **Nomes**: nome de cada cantina e de cada sala do café.
- **PIX**: chave, nome do recebedor e WhatsApp para comprovantes de quatro destinos: cantina e loja (com cidade), café dos oficiais, café dos graduados e ximboca.
- **Valores**: valor padrão do café por sala e plano (mensal e anual) e valor do café para visitantes (oficiais e graduados).
- **Loja**: parcelas máximas no PIX (1x, 2x ou 3x) e frete de envio.

### Chave PIX no QR

O sistema converte a chave para o formato oficial na hora de gerar o código:

- telefone: `+55DDDNÚMERO` (em Configurações, escreva já com `+55`; no evento da ximboca, escolha o tipo "Telefone");
- CPF e CNPJ: só dígitos;
- e-mail e chave aleatória: minúsculas.

O nome do recebedor vai sem acento e com no máximo 25 letras. Se o banco responder "chave não encontrada" com a chave certa, a chave não está cadastrada no banco do titular.

---

## 12. Automações

Rodam todo dia às **00:00 de Brasília** (cron do worker às 03:00 UTC). Cada rotina roda isolada: a falha de uma não impede as outras e fica registrada na Auditoria como `cron_falhou`.

| Quando | O que faz |
|---|---|
| Dia 1 (recupera nos dias 2 a 5) | Mensalidades do café de todos os assinantes mensais ativos, com aviso no sino. Não duplica. |
| Dias 1 a 5, quando vence | Renova a anuidade de quem é anual: 12 meses a partir do mês seguinte ao fim da anterior. |
| Dia 1 | Fechamento do RP na Auditoria (`fechamento_mensal_rp`): devedores, valor total e maiores devedores. |
| Todo dia | Parabéns aos aniversariantes, sem repetir no mesmo dia. |
| Dia 10 | Aviso no app para quem tem mensalidade ou anuidade do café em aberto. |
| Todo dia | Apaga tentativas de login com mais de um dia. |

Avisos na hora: comprovante aprovado ou rejeitado, pagamento confirmado e compra no fiado.

---

## 13. Segurança

- Toda rota do painel confere o administrador no banco a cada requisição: admin desativado perde o acesso na hora.
- O login de usuário (militar ou visitante) nunca vale como admin.
- Login do admin: 5 senhas erradas em 15 minutos bloqueiam por 15 minutos.
- Senhas guardadas com hash (PBKDF2 com salt), nunca em texto puro.
- A sessão do admin vale 8 horas.

---

## 14. Atualizações do app

- Quando há versão nova, aparece **Nova versão disponível** com **Atualizar agora**. O app também procura atualização a cada 30 minutos e ao voltar para a aba.
- Se uma tela falhar porque o sistema foi atualizado enquanto estava aberta, o app recarrega sozinho uma vez.
- Se aparecer a tela de erro: **Recarregar**; se continuar, **Limpar e recarregar** (apaga o cache do app neste navegador e recarrega).

---

## 15. LGPD

O sistema trata dados pessoais e segue a Lei Geral de Proteção de Dados (Lei 13.709/2018).

**Dados coletados:** e-mail, trigrama, SARAM, WhatsApp, categoria, esquadrão de origem (visitantes), data de nascimento, foto de perfil (opcional) e histórico financeiro.

**Direitos do titular:** ver e corrigir os dados em Meu perfil e excluir a conta (com a senha, sem valores em aberto).

**Atribuições do admin:**

- Não compartilhar dados de militares com terceiros.
- Cobrança pelo WhatsApp é finalidade legítima.
- Ao desligar um militar, decidir entre **desativar** (mantém o histórico) e **excluir** (apaga tudo, sem volta).
- Pedido de exclusão: o militar exclui em Meu perfil, ou o super admin usa **Excluir conta** em Usuários do app.

**Política de privacidade:** `/privacidade` (texto em `app/src/pages/PoliticaPrivacidade.tsx`).

**Incidente de segurança:** comunicar a ANPD e os titulares afetados em até 72 horas e documentar o incidente e as ações tomadas.

---

## 16. Acessos técnicos

### Worker (backend)

- URL: https://senta-pua-worker.chamadapoker.workers.dev
- Deploy: `npx wrangler deploy` na pasta `worker/`.
- Cron: `0 3 * * *` (em `worker/wrangler.toml`).

### Pages (frontend)

- URL: https://app-senta-pua.pages.dev (projeto `app-senta-pua`).
- Build: `npm run build` na pasta `app/` (gera o `dist/` e marca a versão do service worker).
- Deploy manual: `npx wrangler pages deploy dist --project-name=app-senta-pua --branch=main`. Não há deploy automático pelo Git.
- A versão exibida no app vem do campo `version` de `app/package.json`.

### Banco (D1) e arquivos (R2)

- Banco: `senta-pua-db`. Migrations em `worker/src/db/migrations/` (`npx wrangler d1 execute senta-pua-db --remote --file=...`).
- Imagens e comprovantes: bucket R2 `senta-pua-images`.

### Secrets do worker

- `JWT_SECRET`: assina os tokens.
- `ADMIN_EMAIL` / `ADMIN_SENHA`: no login com esse e-mail, se ele ainda não existir em `admins`, o sistema cria um super admin com essa senha.
- `FRONTEND_URL`: URL do frontend para CORS.

### Super admin esqueceu a senha

Outro super admin define uma nova em Administradores → Editar. Se não houver outro, troque `ADMIN_SENHA` (`npx wrangler secret put ADMIN_SENHA`), remova o registro desse e-mail na tabela `admins` e faça login de novo: o super admin é recriado.

---

## 17. Arquitetura (para desenvolvedores)

- Frontend: React 19, TypeScript, Tailwind CSS, Zustand, Vite, PWA com service worker.
- Backend: Hono em Cloudflare Workers.
- Banco: Cloudflare D1 (SQLite). Arquivos: Cloudflare R2.
- Autenticação: JWT (HS256); o admin é conferido no banco a cada requisição.

Pastas: `app/` (frontend), `worker/` (backend), `docs/` (esta documentação).
