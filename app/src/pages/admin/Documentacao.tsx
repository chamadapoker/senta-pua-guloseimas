import { useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Icon } from '../../components/ui/Icon';

type Topico = 'geral' | 'loja' | 'cafe' | 'ximboca' | 'usuarios' | 'financeiro' | 'seguranca' | 'automacoes';

export function Documentacao() {
  const [ativo, setAtivo] = useState<Topico>('geral');

  const menu = [
    { id: 'geral', label: 'Visão Geral', icon: 'info' },
    { id: 'loja', label: 'Lojinha Militar', icon: 'cart' },
    { id: 'cafe', label: 'Caixinha do Café', icon: 'coffee' },
    { id: 'ximboca', label: 'Ximboca', icon: 'fire' },
    { id: 'usuarios', label: 'Usuários & Niver', icon: 'users' },
    { id: 'financeiro', label: 'Financeiro', icon: 'cash' },
    { id: 'seguranca', label: 'Segurança', icon: 'eye' },
    { id: 'automacoes', label: 'Automações', icon: 'clock' },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto animate-fade-in">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-azul tracking-wider uppercase">Central de Documentação</h1>
          <p className="text-texto-fraco text-sm mt-1">Guia prático para o Administrador e Responsável (RP) do sistema Senta Pua.</p>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Menu Lateral da Doc */}
          <aside className="w-full md:w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-borda overflow-hidden sticky top-24 shadow-sm">
              <div className="px-4 py-3 bg-fundo/50 border-b border-borda">
                <span className="text-[10px] font-bold text-azul uppercase tracking-widest">Tópicos de Ajuda</span>
              </div>
              {menu.map(item => (
                <button
                  key={item.id}
                  onClick={() => setAtivo(item.id as Topico)}
                  className={`w-full flex items-center gap-3 px-4 py-4 text-sm font-medium transition-all border-b border-borda last:border-0
                    ${ativo === item.id ? 'bg-azul text-white' : 'text-texto-fraco hover:bg-fundo hover:text-azul'}
                  `}
                >
                  <Icon name={item.icon as any} size={18} />
                  {item.label}
                </button>
              ))}
            </div>
          </aside>

          {/* Conteúdo Principal */}
          <div className="flex-1 space-y-6">
            
            {ativo === 'geral' && (
              <div className="space-y-6 animate-slide-up">
                <div className="bg-white rounded-2xl border border-borda p-8 shadow-sm">
                  <h2 className="text-2xl font-display text-azul mb-4 uppercase tracking-wider">O Sistema Senta Pua</h2>
                  <p className="text-texto leading-relaxed mb-6">
                    Desenvolvido para automatizar a gestão do <strong>1/10 GpAv</strong>, unificando cantina, loja, café e eventos em uma única plataforma digital resiliente.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-azul/5 rounded-2xl border border-azul/10">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">Ecossistema Único</h3>
                      <p className="text-xs text-texto-fraco">Um único login para o militar comprar guloseimas, pagar a lojinha e participar da Ximboca.</p>
                    </div>
                    <div className="p-5 bg-verde/5 rounded-2xl border border-verde/10">
                      <h3 className="font-bold text-verde-escuro text-xs uppercase mb-2">Financeiro Integrado</h3>
                      <p className="text-xs text-texto-fraco">O saldo do militar é consolidado em um extrato único, facilitando a cobrança mensal pelo RP.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ativo === 'loja' && (
              <div className="space-y-4 animate-slide-up">
                <div className="bg-white rounded-2xl border border-borda p-8 shadow-sm">
                  <h2 className="text-2xl font-display text-azul mb-6 uppercase tracking-wider">Lojinha Militar</h2>
                  
                  <div className="space-y-4">
                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">1. Variações de Produto</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Ao cadastrar itens como Camisetas ou Manicacas, use as <strong>Variações</strong> (Tamanho, Cor). Cada variação tem seu próprio estoque independente, evitando que você venda um tamanho "G" que não existe.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">2. Sistema de Parcelamento</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Itens caros podem ser parcelados. O Admin define o número de parcelas e o sistema gera os débitos futuros automaticamente no extrato do militar.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">3. Controle de Entrega</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Um pedido de loja tem dois status: <strong>Pagamento</strong> (Confirmado/Pendente) e <strong>Entrega</strong> (Entregue/Aguardando). Use o painel de pedidos da loja para filtrar quem já pagou mas ainda não buscou o material.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ativo === 'cafe' && (
              <div className="space-y-4 animate-slide-up">
                <div className="bg-white rounded-2xl border border-borda p-8 shadow-sm">
                  <h2 className="text-2xl font-display text-azul mb-6 uppercase tracking-wider">Caixinha do Café</h2>
                  
                  <div className="space-y-4">
                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">1. Assinaturas Recorrentes</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Os assinantes são divididos em <strong>Oficiais</strong> e <strong>Graduados</strong>. No dia 01 de cada mês, o sistema lança automaticamente o débito da mensalidade para todos os ativos.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">2. Gestão de Insumos</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Cadastre o estoque de café, açúcar e copos. Quando você registra uma <strong>Despesa</strong> de compra, o sistema pergunta se quer adicionar esses itens ao estoque. Assim, você nunca fica sem café.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">3. Painel Público</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        O QR Code da caixinha leva a uma página pública que mostra quem são os "Amigos do Café" do mês, incentivando a participação e transparência.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ativo === 'ximboca' && (
              <div className="space-y-4 animate-slide-up">
                <div className="bg-white rounded-2xl border border-borda p-8 shadow-sm">
                  <h2 className="text-2xl font-display text-azul mb-6 uppercase tracking-wider">Gestão de Ximbocas</h2>
                  
                  <div className="space-y-4">
                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">1. Categorias de Consumo</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Ao criar um evento, defina valores diferentes para quem consome <strong>Cerveja</strong>, <strong>Refrigerante</strong> ou apenas o <strong>Padrão</strong>. Isso garante um rateio justo para todos.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">2. Reaproveitamento de Estoque</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Sobrou bebida do último evento? Cadastre no <strong>Estoque da Ximboca</strong>. No próximo evento, use o botão "Consumir Estoque" para usar esses itens sem gerar novas despesas financeiras.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">3. Balanço Automático</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        O sistema calcula: (Total Pago pelos Militares) - (Despesas com Carne/Carvão) = <strong>Saldo Final</strong>. O RP sabe na hora se o evento se pagou ou se sobrou dinheiro para o próximo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ativo === 'usuarios' && (
              <div className="space-y-4 animate-slide-up">
                <div className="bg-white rounded-2xl border border-borda p-8 shadow-sm">
                  <h2 className="text-2xl font-display text-azul mb-6 uppercase tracking-wider">Usuários & Aniversários</h2>
                  
                  <div className="space-y-4">
                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">1. O SARAM (Âncora de Identidade)</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        O SARAM é o identificador mestre e imutável. Ele serve como a âncora que conecta o login do militar ao seu extrato financeiro. Diferente do trigrama, o SARAM nunca muda, o que garante a preservação do histórico de dívidas e créditos mesmo em caso de promoções ou mudanças de nome de guerra.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">2. Gestão de Aniversariantes</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        O sistema monitora as datas de nascimento em formato padronizado (ISO). Na página de <strong>Aniversariantes</strong>, o RP pode configurar fotos e mensagens especiais. Novos usuários informam a data já no cadastro, garantindo que ninguém fique de fora do radar de comemorações.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">3. Contas de Visitantes</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Para militares temporários ou de outros esquadrões, crie uma conta de <strong>Visitante</strong> com data de expiração. O sistema bloqueia o acesso automaticamente após essa data.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ativo === 'financeiro' && (
              <div className="space-y-4 animate-slide-up">
                <div className="bg-white rounded-2xl border border-borda p-8 shadow-sm">
                  <h2 className="text-2xl font-display text-azul mb-6 uppercase tracking-wider">Fluxo Financeiro</h2>
                  
                  <div className="space-y-4">
                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">1. O Ciclo do Comprovante</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        O militar pode pagar via PIX e enviar o comprovante na hora. Se ele esquecer, o sistema mantém um alerta no Dashboard dele até que o arquivo seja enviado. O Admin só aprova após ver o PDF/Imagem.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">2. Integridade via SARAM</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Para evitar perda de histórico financeiro, todas as buscas de extrato priorizam o SARAM. Se um militar mudar de trigrama (ex: de TEN para CAP), o sistema reconhece o SARAM e mantém todas as dívidas e saldos vinculados à nova conta automaticamente.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">3. Consolidação de Caixa</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        O painel "Caixa Consolidado" agrupa o faturamento de todos os módulos, permitindo ao RP saber quanto dinheiro físico e digital deve haver em cada conta.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ativo === 'seguranca' && (
              <div className="space-y-4 animate-slide-up">
                <div className="bg-white rounded-2xl border border-borda p-8 shadow-sm">
                  <h2 className="text-2xl font-display text-azul mb-6 uppercase tracking-wider">Segurança & LGPD</h2>
                  
                  <div className="space-y-4">
                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">1. Níveis de Permissão</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        <strong>Admin:</strong> Operação diária. <strong>Super-Admin:</strong> Pode excluir registros permanentes, gerenciar outros admins e realizar auditorias profundas.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">2. Exclusão Nuclear (LGPD)</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Se um militar solicitar a exclusão de dados, use a "Exclusão Nuclear". Ela apaga login, fotos, histórico e dívidas de forma irreversível, garantindo o "Direito ao Esquecimento".
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {ativo === 'automacoes' && (
              <div className="space-y-4 animate-slide-up">
                <div className="bg-white rounded-2xl border border-borda p-8 shadow-sm">
                  <h2 className="text-2xl font-display text-azul mb-6 uppercase tracking-wider">Automações do Sistema</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">🚀 Mensalidade do Café (Dia 01)</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        À meia-noite do dia 01, o servidor percorre todos os assinantes ativos e gera as cobranças mensais. O militar recebe um aviso imediato no <strong>Sininho</strong>.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">🎂 Radar de Aniversariantes</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Diariamente o sistema verifica quem faz aniversário e envia uma mensagem motivacional automática. O RP pode personalizar estas mensagens individualmente para dar um toque especial à homenagem.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-azul text-xs uppercase mb-2">🔔 Sininho de Feedback</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        Sempre que um Admin aprova ou rejeita um comprovante, ou quando um militar faz uma nova compra no fiado, o sistema dispara um alerta em tempo real.
                      </p>
                    </div>

                    <div className="bg-fundo p-5 rounded-2xl border border-borda">
                      <h3 className="font-bold text-vermelho text-xs uppercase mb-2">🛑 Bloqueio de Visitantes</h3>
                      <p className="text-xs text-texto-fraco leading-relaxed">
                        O sistema monitora a data de validade de todos os visitantes. Ao expirar, o login é bloqueado automaticamente, garantindo a segurança do ambiente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
