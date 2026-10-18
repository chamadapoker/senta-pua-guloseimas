import { useState, type ReactNode } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { PageHeader } from '../../components/ui/PageHeader';
import { Icon, type IconName } from '../../components/ui/Icon';

type Topico = 'geral' | 'loja' | 'cafe' | 'ximboca' | 'usuarios' | 'financeiro' | 'seguranca' | 'automacoes';

interface Bloco { titulo: string; texto: ReactNode; alerta?: boolean }
interface Secao { id: Topico; label: string; icon: IconName; titulo: string; intro?: ReactNode; blocos: Bloco[]; colunas?: boolean }

const SECOES: Secao[] = [
  {
    id: 'geral', label: 'Visão geral', icon: 'info', titulo: 'O sistema Senta Pua', colunas: true,
    intro: <>Feito para a gestão do <strong>1/10 GpAv</strong>: cantina, loja, caixinha do café e ximbocas em uma única plataforma. Versão atual do app: <strong>v{__APP_VERSION__}</strong> (aparece também no rodapé do menu, ao lado do seu nome).</>,
    blocos: [
      { titulo: 'Um só acesso', texto: 'Com um único login o militar compra na cantina, paga a loja, acompanha o café e participa da ximboca. Todo o saldo dele fica em um extrato só, o que facilita a cobrança pelo RP.' },
      { titulo: 'Menu lateral', texto: <>No computador, o menu azul-noite fica recolhido (só ícones) e abre sozinho ao passar o mouse. Para deixá-lo sempre aberto, use o botão de alfinete no topo do menu (<strong>Manter o menu aberto</strong>). A escolha fica guardada neste navegador.</> },
      { titulo: 'No celular', texto: <>Uma barra flutuante embaixo mostra os atalhos da área em que você está (cantina, loja, café, ximboca, financeiro ou pessoas). O botão <strong>Menu</strong> abre o menu completo. O número vermelho em Comprovantes é a fila de aprovação.</> },
      { titulo: 'Painel do admin', texto: <>O topo mostra o que <strong>precisa de atenção</strong> (comprovantes, pedidos pendentes, devedores). Logo abaixo, a <strong>Visão geral</strong> tem seletor de 7, 30 ou 90 dias, comparação com o período anterior, vendas por dia, idade da dívida, horário de pico, formas de pagamento e mais vendidos. Todas as datas seguem o horário de Brasília.</> },
      { titulo: 'Gráficos com tabela', texto: <>Os painéis da cantina, da loja, do café (por sala) e da ximboca têm gráficos. Em cada gráfico, o botão <strong>Tabela</strong> mostra os mesmos números em lista; <strong>Gráfico</strong> volta à visualização.</> },
      { titulo: 'Nova versão disponível', texto: <>Quando sai uma atualização, aparece o aviso <strong>Nova versão disponível</strong>; toque em <strong>Atualizar agora</strong>. Se uma tela falhar porque o sistema foi atualizado enquanto estava aberta, o app recarrega sozinho. Se aparecer a tela de erro, use <strong>Recarregar</strong> e, se continuar, <strong>Limpar e recarregar</strong>.</> },
    ],
  },
  {
    id: 'loja', label: 'Loja', icon: 'cart', titulo: 'Loja',
    blocos: [
      { titulo: 'Categorias', texto: <>Em Loja, Produtos, use o botão <strong>Categorias</strong> para criar, renomear, reordenar e excluir categorias. Excluir uma categoria não apaga produtos: eles ficam sem categoria. A lista de produtos tem filtro por categoria, e a vitrine da loja mostra os produtos agrupados na ordem cadastrada (os sem categoria aparecem em "Outros").</> },
      { titulo: 'Variações de produto', texto: <>Camisetas e afins usam <strong>variações</strong> (tamanho, cor), cada uma com estoque próprio. Cadastre também o <strong>preço de custo</strong> para o produto aparecer na Lucratividade.</> },
      { titulo: 'Parcelamento', texto: <>O máximo de parcelas no PIX (1x, 2x ou 3x) fica em Configurações, aba Loja. Quem compra escolhe em quantas vezes pagar, e cada parcela recebe o próprio comprovante, que chega na fila como "Loja (parcela)".</> },
      { titulo: 'Entrega e envio', texto: <>Cada pedido é <strong>retirada</strong> ou <strong>envio</strong>. No envio, o frete definido em Configurações é somado ao total. Em Loja, Pedidos, use <strong>Marcar pago</strong> e, depois de despachar, <strong>Marcar enviado</strong>.</> },
    ],
  },
  {
    id: 'cafe', label: 'Caixinha do café', icon: 'coffee', titulo: 'Caixinha do café',
    blocos: [
      { titulo: 'Duas salas', texto: <>O café tem a sala dos <strong>oficiais</strong> e a dos <strong>graduados</strong>, cada uma com seus assinantes, PIX, valores, despesas e insumos. O seletor de sala fica no topo de todas as telas do café; a sala escolhida vai na URL e continua ao trocar de tela.</> },
      { titulo: 'A sala segue a categoria', texto: <>Militar com conta no app entra na sala da sua categoria. Se o admin trocar a categoria em Usuários, a assinatura muda de sala junto. <strong>Praça não participa</strong>: não pode ser cadastrada, e quem vira praça tem a assinatura desativada.</> },
      { titulo: 'Planos mensal e anual', texto: <>No mensal, uma cobrança por mês. No anual, a anuidade vale <strong>12 meses a partir da adesão</strong>; a lista de assinantes mostra "Válido até" e, quando vence, o sistema lança a próxima anuidade sozinho. Ao cadastrar, a primeira cobrança já é criada.</> },
      { titulo: 'Valor padrão', texto: <>Em Configurações, aba Valores, defina o valor padrão de cada sala e plano. Ao cadastrar um assinante com o campo de valor vazio, vale o padrão. O valor que visitantes pagam fica na mesma aba.</> },
      { titulo: 'Mensalidades e despesas', texto: <>O dia 1 gera as mensalidades sozinho; o botão <strong>Gerar mensalidades</strong> serve para lançar um mês manualmente (só plano mensal). As despesas são lançadas na sala selecionada e entram no saldo dela (entrou, saiu, saldo atual e previsto). Insumos abaixo do mínimo aparecem em alerta.</> },
      { titulo: 'Como o militar paga', texto: <>Na tela Café, o militar vê o total em aberto, copia o PIX da sala dele e envia o comprovante pelo app. Visitantes escolhem a sala e pagam o valor de visitante.</> },
    ],
  },
  {
    id: 'ximboca', label: 'Ximboca', icon: 'fire', titulo: 'Ximbocas',
    blocos: [
      { titulo: 'Valores por consumo', texto: <>Ao criar o evento, defina o valor <strong>padrão</strong> e, se quiser, valores com <strong>cerveja</strong> ou <strong>refri</strong>. Se preencher, o participante escolhe a opção; se não, vale o padrão.</> },
      { titulo: 'PIX do responsável', texto: <>Cada evento pode ter PIX próprio. Escolha o tipo da chave: abaixo do campo aparece <strong>"Vai no QR como …"</strong>, que é exatamente o que vai no código PIX (telefone como +55DDDNÚMERO, CPF só dígitos, e-mail em minúsculas).</> },
      { titulo: 'Reaproveitar estoque', texto: <>Sobrou bebida ou carvão? Cadastre em Ximboca, Estoque. No evento, <strong>Do estoque</strong> tira a quantidade do estoque e registra como despesa de R$ 0, porque o custo já foi pago na compra.</> },
      { titulo: 'Balanço do evento', texto: <>O topo do evento mostra pagos, arrecadado, gasto e <strong>saldo</strong>. O painel da Ximboca tem o gráfico de arrecadado e gasto dos 6 eventos mais recentes.</> },
      { titulo: 'Organização e divulgação', texto: <>Na aba Organização ficam as tarefas e as cautelas (material emprestado, que não entra no estoque). Na aba Divulgação ficam a página pública do evento, o QR code, os tipos de ingresso e o check-in, feito pelos militares marcados como recepcionista em Usuários.</> },
    ],
  },
  {
    id: 'usuarios', label: 'Usuários e aniversários', icon: 'users', titulo: 'Usuários e aniversários',
    blocos: [
      { titulo: 'SARAM como identidade', texto: 'O SARAM liga o login do militar ao extrato. Diferente do trigrama, ele não muda, então o histórico de dívidas e pagamentos se mantém.' },
      { titulo: 'Complete seu cadastro', texto: <>Quem está sem SARAM, foto, data de aniversário ou WhatsApp vê o aviso <strong>Complete seu cadastro</strong> no app. O militar pode completar na hora ou tocar em <strong>Lembrar depois</strong> (o aviso some até o fim do dia).</> },
      { titulo: 'Categoria, fiado e recepcionista', texto: <>No card de cada usuário: trocar a <strong>categoria</strong> (o café acompanha), ligar ou desligar o <strong>fiado</strong>, marcar como <strong>recepcionista</strong> (check-in da ximboca), redefinir senha, desativar a conta e ver o extrato.</> },
      { titulo: 'Contas de visitante', texto: <>Visitantes recebem 30 dias de acesso a partir do cadastro e não têm fiado, a menos que o admin libere. No bloco "Acesso de visitante" dá para mudar a data em <strong>Expira em</strong> ou <strong>Pausar acesso</strong>.</> },
      { titulo: 'Aniversariantes', texto: <>Na página <strong>Aniversariantes</strong> o RP personaliza a homenagem (título, texto e imagem) que cada militar vê no dia do aniversário.</> },
      { titulo: 'Excluir a própria conta', alerta: true, texto: 'O militar pode excluir a conta em Meu perfil. O sistema pede a senha e recusa a exclusão enquanto houver qualquer valor em aberto na cantina, loja, café ou ximboca.' },
    ],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: 'cash', titulo: 'Fluxo financeiro',
    blocos: [
      { titulo: 'Contas dos militares', texto: <>Em Cantina, Contas dos militares, escolha o período: <strong>Este mês</strong>, <strong>Mês passado</strong>, <strong>Últimos 30 dias</strong>, <strong>Tudo</strong> ou datas em De e Até. Comprado, pago e saldo mostram só esse período. O período fica na URL e acompanha ao abrir o extrato.</> },
      { titulo: 'Extrato e PDF de cobrança', texto: <>O extrato do militar tem abas de cantina, loja, café e ximboca, já filtradas pelo período. <strong>Gerar PDF e cobrar no WhatsApp</strong> monta o PDF só com os lançamentos do período escolhido.</> },
      { titulo: 'Comprovantes', texto: <>Cada comprovante é um cartão com a cor da origem na borda (cantina, loja, café, ximboca), miniatura do arquivo e tempo de espera, que fica vermelho depois de 24 horas. <strong>Aprovar</strong> marca o pagamento como pago na área certa; <strong>Rejeitar</strong> pede o motivo, que o militar recebe.</> },
      { titulo: 'Cobranças e caixa', texto: <>Cobranças junta todos os devedores das quatro áreas, com filtro de atraso e mensagem editável para o WhatsApp. Caixa consolidado mostra entrou, saiu, saldo, a receber e previsto, com atalhos Hoje, Este mês e Tudo.</> },
      { titulo: 'Chave PIX no QR', texto: <>A chave vai no QR no formato oficial: telefone como +55DDDNÚMERO, CPF só dígitos, e-mail em minúsculas. Em Configurações, escreva o telefone já com +55. Se o banco disser <strong>"chave não encontrada"</strong> com a chave certa, ela não está cadastrada no banco do titular.</> },
    ],
  },
  {
    id: 'seguranca', label: 'Segurança e LGPD', icon: 'eye', titulo: 'Segurança e LGPD',
    blocos: [
      { titulo: 'Níveis de acesso', texto: <><strong>Admin:</strong> todo o painel. <strong>Super admin:</strong> também cria, edita e exclui administradores e exclui contas de usuário. <strong>Só o café dos graduados:</strong> acesso restrito, definido em Administradores, campo <strong>Acesso</strong>.</> },
      { titulo: 'Só o café dos graduados', texto: <>Esse admin vê o café dos graduados completo (painel, assinantes, mensalidades, despesas, insumos), os comprovantes do café dos graduados, o PIX, os valores e o nome da sala dos graduados, e troca a própria senha. O bloqueio é feito no servidor: qualquer outra tela ou ação é recusada, mesmo digitando o endereço.</> },
      { titulo: 'Acesso conferido a cada ação', texto: 'Toda ação do painel confere o administrador no banco. Desativar um admin corta o acesso na hora, sem esperar o login expirar. O login de um militar nunca vale como admin.' },
      { titulo: 'Auditoria', texto: <>Ficam registrados, com antes e depois: aprovação e rejeição de comprovantes, pagamentos marcados, exclusões, mudanças de PIX e configurações, senhas redefinidas, troca de categoria, fiado, administradores e as rotinas automáticas.</> },
      { titulo: 'Tentativas de login', texto: 'Depois de 5 senhas erradas em 15 minutos, o login do admin fica bloqueado por 15 minutos. As tentativas antigas são apagadas todo dia.' },
      { titulo: 'Exclusão definitiva (LGPD)', alerta: true, texto: 'Se um militar pedir a exclusão dos dados, ele mesmo pode excluir a conta em Meu perfil (sem dívida em aberto), ou o super admin usa Excluir conta em Usuários. A exclusão apaga conta, fotos, pedidos e pagamentos e não tem volta.' },
    ],
  },
  {
    id: 'automacoes', label: 'Automações', icon: 'clock', titulo: 'Automações do sistema', colunas: true,
    intro: <>As rotinas rodam todo dia às <strong>00:00 de Brasília</strong>. Cada uma roda isolada: se uma falhar, as outras seguem, e a falha fica na Auditoria como <strong>cron_falhou</strong>.</>,
    blocos: [
      { titulo: 'Mensalidades do café (dia 1)', texto: <>No dia 1 o sistema lança a mensalidade de todos os assinantes mensais ativos e avisa no <strong>sino de notificações</strong>. Se o dia 1 falhar, os dias 2 a 5 recuperam, sem duplicar.</> },
      { titulo: 'Renovação da anuidade', texto: 'Nos mesmos dias, quando a anuidade de um assinante anual venceu, o sistema lança a próxima, de 12 meses, começando no mês seguinte ao fim da anterior.' },
      { titulo: 'Fechamento do RP (dia 1)', texto: <>No dia 1 o sistema registra na Auditoria o resumo dos devedores do mês (quantidade, valor total e maiores devedores), como <strong>fechamento_mensal_rp</strong>.</> },
      { titulo: 'Aniversariantes do dia', texto: 'Todo dia o sistema envia o parabéns a quem faz aniversário. Se a rotina rodar duas vezes no mesmo dia, ninguém recebe repetido.' },
      { titulo: 'Lembrete do café (dia 10)', texto: 'No dia 10, quem ainda tem mensalidade ou anuidade do café em aberto recebe um aviso no app com o total.' },
      { titulo: 'Notificações na hora', texto: 'O militar recebe aviso quando um comprovante é aprovado ou rejeitado, quando um pagamento é confirmado e quando faz uma compra no fiado.' },
      { titulo: 'Validade de visitantes', alerta: true, texto: 'A validade da conta de visitante é conferida a cada acesso. Vencida ou pausada, o visitante vai para a tela de acesso expirado e não compra até o admin renovar.' },
    ],
  },
];

export function Documentacao() {
  const [ativo, setAtivo] = useState<Topico>('geral');
  const secao = SECOES.find(s => s.id === ativo)!;

  return (
    <AppLayout>
      <PageHeader title="Documentação" subtitle={<>Guia prático do sistema para o admin, o RP e o responsável do café. Versão v{__APP_VERSION__}.</>} />

      <div className="flex flex-col md:flex-row gap-5 md:gap-8">
        {/* Tópicos: chips no celular, lista lateral a partir do md */}
        <nav aria-label="Tópicos de ajuda" className="w-full md:w-64 flex-shrink-0">
          <div className="flex flex-wrap gap-2 md:hidden">
            {SECOES.map(s => (
              <button
                key={s.id}
                type="button"
                aria-current={ativo === s.id ? 'page' : undefined}
                onClick={() => setAtivo(s.id)}
                className={`min-h-[40px] px-3 rounded-xl border text-sm font-medium inline-flex items-center gap-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
                  ativo === s.id ? 'bg-azul text-white border-azul' : 'bg-white text-texto border-borda hover:bg-fundo-elevado'
                }`}
              >
                <Icon name={s.icon} size={16} /> {s.label}
              </button>
            ))}
          </div>
          <div className="hidden md:block bg-white rounded-2xl border border-borda overflow-hidden sticky top-24 shadow-sm">
            {SECOES.map(s => (
              <button
                key={s.id}
                type="button"
                aria-current={ativo === s.id ? 'page' : undefined}
                onClick={() => setAtivo(s.id)}
                className={`w-full flex items-center gap-3 px-4 min-h-[48px] text-sm font-medium text-left transition-colors border-b border-borda last:border-0 outline-none focus-visible:bg-fundo ${
                  ativo === s.id ? 'bg-azul text-white' : 'text-texto-fraco hover:bg-fundo hover:text-texto'
                }`}
              >
                <Icon name={s.icon} size={18} />
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        <article className="flex-1 min-w-0 bg-white rounded-2xl border border-borda p-5 sm:p-8 shadow-sm">
          <h2 className="font-display text-2xl sm:text-3xl text-noite tracking-wide leading-none">{secao.titulo}</h2>
          <span className="flamula-sm block w-8 h-1 bg-escarlate mt-2" aria-hidden="true" />
          {secao.intro && <p className="text-texto leading-relaxed mt-4">{secao.intro}</p>}

          <div className={`mt-6 grid grid-cols-1 gap-3 sm:gap-4 ${secao.colunas ? 'md:grid-cols-2' : ''}`}>
            {secao.blocos.map((b, i) => (
              <section key={b.titulo} className={`p-4 sm:p-5 rounded-2xl border ${b.alerta ? 'bg-red-50/60 border-red-200' : 'bg-fundo border-borda'}`}>
                <h3 className={`font-semibold text-[15px] mb-1.5 flex items-baseline gap-2 ${b.alerta ? 'text-vermelho' : 'text-noite'}`}>
                  <span className="font-display text-lg leading-none text-escarlate">{i + 1}</span>
                  {b.titulo}
                </h3>
                <p className="text-sm text-texto-fraco leading-relaxed">{b.texto}</p>
              </section>
            ))}
          </div>
        </article>
      </div>
    </AppLayout>
  );
}
