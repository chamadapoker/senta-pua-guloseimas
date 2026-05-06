import { useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Icon } from '../../components/ui/Icon';

type Topico = 'geral' | 'loja' | 'cafe' | 'ximboca' | 'usuarios' | 'financeiro' | 'seguranca' | 'automacoes';

export function Documentacao() {
  const [ativo, setAtivo] = useState<Topico>('geral');

  const menu = [
    { id: 'geral', label: 'Visão Geral', icon: 'note' },
    { id: 'loja', label: 'Lojinha Militar', icon: 'trash' }, // Usando ícones disponíveis no Icon.tsx
    { id: 'cafe', label: 'Caixinha do Café', icon: 'check' },
    { id: 'ximboca', label: 'Ximboca', icon: 'user' },
    { id: 'usuarios', label: 'Usuários & Militares', icon: 'user' },
    { id: 'financeiro', label: 'Financeiro & Caixa', icon: 'note' },
    { id: 'seguranca', label: 'Segurança & Auditoria', icon: 'x' },
    { id: 'automacoes', label: 'Automações (Crons)', icon: 'alarm' },
  ];

  return (
    <AppLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-6">DOCUMENTAÇÃO DO SISTEMA</h1>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Menu Lateral da Doc */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-borda overflow-hidden sticky top-24">
            {menu.map(item => (
              <button
                key={item.id}
                onClick={() => setAtivo(item.id as Topico)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-borda last:border-0
                  ${ativo === item.id ? 'bg-azul text-white' : 'text-texto-fraco hover:bg-fundo'}
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Conteúdo Principal */}
        <div className="flex-1 bg-white rounded-2xl border border-borda p-6 md:p-8 shadow-sm min-h-[600px]">
          {ativo === 'geral' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-display text-azul mb-4 uppercase tracking-wider">Visão Geral</h2>
              <p className="text-sm text-texto leading-relaxed mb-4">
                O Sistema <strong>Senta Pua</strong> foi desenvolvido para centralizar a gestão administrativa do 1/10 GpAv. 
                Ele integra a cantina de guloseimas, a loja de artigos militares, a caixinha do café e a organização de eventos (Ximbocas).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-fundo rounded-xl border border-borda">
                  <h3 className="font-bold text-azul text-xs uppercase mb-2">Público-Alvo</h3>
                  <p className="text-xs text-texto-fraco">Militares do esquadrão, oficiais, graduados e visitantes autorizados.</p>
                </div>
                <div className="p-4 bg-fundo rounded-xl border border-borda">
                  <h3 className="font-bold text-azul text-xs uppercase mb-2">Tecnologia</h3>
                  <p className="text-xs text-texto-fraco">Cloudflare Workers, D1 Database, R2 Storage e React (Vite).</p>
                </div>
              </div>
            </div>
          )}

          {ativo === 'loja' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-display text-azul mb-4 uppercase tracking-wider">Lojinha Militar</h2>
              <div className="space-y-4 text-sm text-texto leading-relaxed">
                <p>O módulo de loja permite a venda de produtos físicos com controle de variações complexas.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Produtos e Variações</strong>: Suporta variações como Tamanho (P, M, G) ou Cor. Cada variação tem seu próprio estoque.</li>
                  <li><strong>Fluxo de Pedido</strong>: O militar escolhe o item, a variação e o método de pagamento.</li>
                  <li><strong>Parcelamento</strong>: Permite que o administrador configure parcelas para itens de maior valor.</li>
                  <li><strong>Gestão de Pedidos</strong>: O admin pode marcar pedidos como "Entregue" ou "Pago".</li>
                </ul>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-800 text-xs">
                  <strong>Importante:</strong> Ao excluir um produto da loja, o sistema remove as variações, mas mantém o histórico de pedidos antigos para integridade financeira.
                </div>
              </div>
            </div>
          )}

          {ativo === 'cafe' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-display text-azul mb-4 uppercase tracking-wider">Caixinha do Café</h2>
              <div className="space-y-4 text-sm text-texto leading-relaxed">
                <p>Sistema de assinaturas recorrentes para manutenção do café no esquadrão.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Assinantes</strong>: Divididos entre Oficiais e Graduados. Cada grupo tem seu próprio dashboard e estatísticas.</li>
                  <li><strong>Planos</strong>: Suporta cobrança Mensal e Anual.</li>
                  <li><strong>Insumos</strong>: Controle de estoque de café, açúcar, copos, etc. O sistema gera alertas quando o estoque está baixo.</li>
                  <li><strong>Despesas</strong>: Registro de compras de insumos para cálculo de saldo real da caixinha.</li>
                </ul>
              </div>
            </div>
          )}

          {ativo === 'ximboca' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-display text-azul mb-4 uppercase tracking-wider">Ximboca</h2>
              <div className="space-y-4 text-sm text-texto leading-relaxed">
                <p>Gestão de eventos e confraternizações do esquadrão.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Eventos</strong>: Criação de eventos com data, local e valor por pessoa.</li>
                  <li><strong>Participantes</strong>: Lista de confirmados e status de pagamento individual.</li>
                  <li><strong>Estoque Dedicado</strong>: Itens (bebidas, carnes) podem ser lançados especificamente para um evento, abatendo do saldo arrecadado.</li>
                  <li><strong>Balanço</strong>: O sistema calcula automaticamente se o evento deu lucro ou prejuízo (Saldo Final).</li>
                </ul>
              </div>
            </div>
          )}

          {ativo === 'usuarios' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-display text-azul mb-4 uppercase tracking-wider">Usuários & Militares</h2>
              <div className="space-y-4 text-sm text-texto leading-relaxed">
                <p>O coração da plataforma. Gerencia quem pode acessar e comprar.</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Trigrama</strong>: Identificador único de 3 letras. É sincronizado automaticamente com a tabela de Clientes (Militares).</li>
                  <li><strong>Visitantes</strong>: Contas temporárias com data de expiração. Após a data, o acesso é bloqueado automaticamente.</li>
                  <li><strong>Exclusão Nuclear</strong>: Recurso de Super-Admin que remove um usuário e TODOS os seus rastros (pedidos, assinaturas, arquivos) para conformidade com a LGPD.</li>
                  <li><strong>Bloqueio de Fiado</strong>: O admin pode impedir que um militar compre "no fiado" individualmente.</li>
                </ul>
              </div>
            </div>
          )}

          {ativo === 'financeiro' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-display text-azul mb-4 uppercase tracking-wider">Financeiro & Caixa</h2>
              <div className="space-y-4 text-sm text-texto leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Comprovantes</strong>: Militares enviam prints de PIX. O admin deve conferir e clicar em "Aprovar" para o sistema dar baixa na dívida automaticamente.</li>
                  <li><strong>Cobranças</strong>: Painel centralizado que gera links diretos de WhatsApp para devedores, já incluindo o valor total consolidado.</li>
                  <li><strong>Caixa Consolidado</strong>: Única tela que soma o faturamento de todos os módulos (Lojinha + Café + Cantina + Ximboca).</li>
                  <li><strong>Lucratividade</strong>: Relatório que compara preço de custo vs preço de venda para mostrar o lucro real por item.</li>
                </ul>
              </div>
            </div>
          )}

          {ativo === 'seguranca' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-display text-azul mb-4 uppercase tracking-wider">Segurança & Auditoria</h2>
              <div className="space-y-4 text-sm text-texto leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Níveis de Acesso</strong>: 
                    <br/>- <em>Admin:</em> Gestão diária.
                    <br/>- <em>Super Admin:</em> Funções destrutivas e gestão de outros admins.
                  </li>
                  <li><strong>Auditoria (Logs)</strong>: Registra quem alterou o quê. Permite ver o estado do dado "Antes" e "Depois" da alteração.</li>
                  <li><strong>IP Tracking</strong>: O endereço IP de cada ação administrativa é registrado para segurança.</li>
                </ul>
              </div>
            </div>
          )}

          {ativo === 'automacoes' && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-display text-azul mb-4 uppercase tracking-wider">Automações (Crons)</h2>
              <div className="space-y-4 text-sm text-texto leading-relaxed">
                <p>O sistema realiza tarefas automáticas programadas pelo (3S TIN HÖEHR) para reduzir o trabalho manual.</p>
                <div className="space-y-6">
                  <div className="border-l-4 border-azul pl-4">
                    <h4 className="font-bold text-texto text-xs uppercase">1. Cobrança do Café (Mensal/Anual)</h4>
                    <p className="text-xs text-texto-fraco mt-1">
                      Executado no dia 01 de cada mês. Gera automaticamente os débitos de R$ 30,00 (ou valor configurado) no extrato dos assinantes ativos.
                    </p>
                  </div>
                  <div className="border-l-4 border-azul pl-4">
                    <h4 className="font-bold text-texto text-xs uppercase">2. Fechamento Mensal para o RP</h4>
                    <p className="text-xs text-texto-fraco mt-1">
                      Executado no dia 01. Consolida todas as dívidas pendentes do mês anterior e gera um log de auditoria resumido com o valor total a ser coletado.
                    </p>
                  </div>
                  <div className="border-l-4 border-vermelho pl-4">
                    <h4 className="font-bold text-texto text-xs uppercase">3. Alerta de Dívida (Dashboard)</h4>
                    <p className="text-xs text-texto-fraco mt-1">
                      Dinâmico. Caso o militar possua qualquer valor pendente, um banner vermelho pulsante aparece no portal dele com botão direto para baixar o extrato em PDF.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
