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
    intro: <>Feito para automatizar a gestão do <strong>1/10 GpAv</strong>, unindo cantina, loja, café e eventos em uma única plataforma.</>,
    blocos: [
      { titulo: 'Um só acesso', texto: 'Com um único login o militar compra na cantina, paga a loja e participa da ximboca.' },
      { titulo: 'Financeiro integrado', texto: 'O saldo do militar fica em um extrato único, o que facilita a cobrança mensal pelo RP.' },
    ],
  },
  {
    id: 'loja', label: 'Loja', icon: 'cart', titulo: 'Loja',
    blocos: [
      { titulo: 'Variações de produto', texto: <>Ao cadastrar camisetas ou manicacas, use as <strong>variações</strong> (tamanho, cor). Cada variação tem estoque próprio, o que evita vender um tamanho G que não existe.</> },
      { titulo: 'Parcelamento', texto: 'Itens caros podem ser parcelados. O admin define o número de parcelas e o sistema lança os débitos futuros no extrato do militar.' },
      { titulo: 'Controle de entrega', texto: <>Cada pedido tem dois status: <strong>pagamento</strong> (confirmado ou pendente) e <strong>entrega</strong> (entregue ou aguardando). Use os pedidos da loja para ver quem já pagou e ainda não buscou o material.</> },
    ],
  },
  {
    id: 'cafe', label: 'Caixinha do café', icon: 'coffee', titulo: 'Caixinha do café',
    blocos: [
      { titulo: 'Assinaturas mensais', texto: <>Os assinantes são divididos em <strong>oficiais</strong> e <strong>graduados</strong>. No dia 1º de cada mês o sistema lança a mensalidade de todos os ativos.</> },
      { titulo: 'Insumos', texto: <>Cadastre o estoque de café, açúcar e copos. Ao registrar uma <strong>despesa</strong> de compra, o sistema pergunta se quer somar os itens ao estoque.</> },
      { titulo: 'Painel público', texto: 'O QR Code da caixinha leva a uma página pública com os "Amigos do café" do mês, o que incentiva a participação e dá transparência.' },
    ],
  },
  {
    id: 'ximboca', label: 'Ximboca', icon: 'fire', titulo: 'Ximbocas',
    blocos: [
      { titulo: 'Categorias de consumo', texto: <>Ao criar um evento, defina valores diferentes para quem consome <strong>cerveja</strong>, <strong>refrigerante</strong> ou só o <strong>padrão</strong>. Assim o rateio fica justo.</> },
      { titulo: 'Reaproveitar estoque', texto: <>Sobrou bebida do último evento? Cadastre no <strong>estoque da ximboca</strong>. No próximo evento, use "Consumir estoque" para usar esses itens sem lançar nova despesa.</> },
      { titulo: 'Balanço automático', texto: <>O sistema calcula o total pago pelos militares menos as despesas (carne, carvão etc.) e mostra o <strong>saldo final</strong>. O RP vê na hora se o evento se pagou.</> },
    ],
  },
  {
    id: 'usuarios', label: 'Usuários e aniversários', icon: 'users', titulo: 'Usuários e aniversários',
    blocos: [
      { titulo: 'SARAM como identidade', texto: 'O SARAM é o identificador fixo que liga o login do militar ao extrato. Diferente do trigrama, ele nunca muda, então o histórico de dívidas e créditos se mantém mesmo após promoção ou troca de nome de guerra.' },
      { titulo: 'Aniversariantes', texto: <>O sistema acompanha as datas de nascimento. Na página <strong>Aniversariantes</strong> o RP configura fotos e mensagens especiais. Novos usuários informam a data já no cadastro.</> },
      { titulo: 'Contas de visitante', texto: <>Para militares temporários ou de outros esquadrões, crie uma conta de <strong>visitante</strong> com data de validade. O acesso é bloqueado automaticamente depois dessa data.</> },
    ],
  },
  {
    id: 'financeiro', label: 'Financeiro', icon: 'cash', titulo: 'Fluxo financeiro',
    blocos: [
      { titulo: 'Ciclo do comprovante', texto: 'O militar paga via PIX e envia o comprovante na hora. Se esquecer, um alerta fica no painel dele até o envio. O admin só aprova depois de ver o arquivo.' },
      { titulo: 'Histórico pelo SARAM', texto: 'Todas as buscas de extrato priorizam o SARAM. Se o militar mudar de trigrama (ex.: de TEN para CAP), dívidas e saldos continuam ligados à conta dele.' },
      { titulo: 'Caixa consolidado', texto: 'O painel "Caixa consolidado" junta o faturamento de todos os módulos para o RP saber quanto deve haver em dinheiro e em cada conta.' },
    ],
  },
  {
    id: 'seguranca', label: 'Segurança e LGPD', icon: 'eye', titulo: 'Segurança e LGPD',
    blocos: [
      { titulo: 'Níveis de permissão', texto: <><strong>Admin:</strong> operação do dia a dia. <strong>Super-admin:</strong> também exclui registros permanentes, gerencia outros admins e faz auditorias.</> },
      { titulo: 'Exclusão definitiva (LGPD)', alerta: true, texto: 'Se um militar pedir a exclusão dos dados, use a exclusão definitiva. Ela apaga login, fotos, histórico e dívidas sem volta, garantindo o direito ao esquecimento.' },
    ],
  },
  {
    id: 'automacoes', label: 'Automações', icon: 'clock', titulo: 'Automações do sistema', colunas: true,
    blocos: [
      { titulo: 'Mensalidade do café (dia 1º)', texto: <>À meia-noite do dia 1º o servidor gera as cobranças de todos os assinantes ativos. O militar recebe um aviso no <strong>sino de notificações</strong>.</> },
      { titulo: 'Aniversariantes do dia', texto: 'Todo dia o sistema verifica quem faz aniversário e envia uma mensagem automática. O RP pode personalizar a mensagem de cada pessoa.' },
      { titulo: 'Notificações', texto: 'Quando um admin aprova ou recusa um comprovante, ou quando um militar faz uma compra no fiado, o sistema envia um aviso na hora.' },
      { titulo: 'Bloqueio de visitantes', alerta: true, texto: 'O sistema acompanha a validade das contas de visitante. Ao vencer, o login é bloqueado automaticamente.' },
    ],
  },
];

export function Documentacao() {
  const [ativo, setAtivo] = useState<Topico>('geral');
  const secao = SECOES.find(s => s.id === ativo)!;

  return (
    <AppLayout>
      <PageHeader title="Documentação" subtitle="Guia prático do sistema para o admin e o RP." />

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
