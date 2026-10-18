import { useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { BackButton } from '../components/ui/BackButton';
import { EnviarComprovante } from '../components/ui/EnviarComprovante';
import { api } from '../services/api';
import { Loading } from '../components/ui/Loading';
import { useUserAuth } from '../hooks/useUserAuth';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { formatarDataBanco } from '../services/datas';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const METODO: Record<string, string> = { pix: 'PIX', fiado: 'Fiado', dinheiro: 'Dinheiro' };
const STATUS: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' }> = {
  pago: { label: 'Pago', variant: 'success' },
  fiado: { label: 'Fiado', variant: 'danger' },
  pendente: { label: 'Pendente', variant: 'warning' },
};

interface Item {
  pedido_id: string;
  nome_produto: string;
  nome_variacao: string | null;
  quantidade: number;
  subtotal: number;
}

interface Parcela {
  id: string;
  numero: number;
  total_parcelas: number;
  valor: number;
  status: 'pendente' | 'pago';
}

interface Pedido {
  id: string;
  total: number;
  status: 'pendente' | 'pago' | 'fiado';
  metodo_pagamento: 'pix' | 'fiado' | 'dinheiro';
  parcelas: number;
  created_at: string;
  itens: Item[];
  parcelas_lista: Parcela[];
  entrega_tipo?: 'retirada' | 'envio';
  endereco?: string | null;
  frete?: number;
  envio_status?: 'a_enviar' | 'enviado' | null;
  rastreamento?: string | null;
}

export function LojaMinhas() {
  const { user, token } = useUserAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  const carregar = () => {
    setLoading(true);
    setErro(false);
    api.get<Pedido[]>('/api/loja/meus-pedidos')
      .then(setPedidos)
      .catch(() => setErro(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) { navigate('/login', { state: { returnTo: '/loja/minhas' } }); return; }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  const recarregar = () => api.get<Pedido[]>('/api/loja/meus-pedidos').then(setPedidos).catch(() => {});

  if (!user) return null;

  return (
    <AppLayout>
      <BackButton to="/loja" className="min-h-[44px] mb-1" />
      <PageHeader title="Minhas compras" subtitle="Pedidos da loja, entrega e parcelas." />

      {loading ? (
        <Loading label="Carregando suas compras..." />
      ) : erro ? (
        <Card size="lg" className="text-center">
          <p className="text-sm text-vermelho mb-3">Não foi possível carregar suas compras.</p>
          <Button variant="outline" size="sm" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </Card>
      ) : pedidos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="bag" size={24} />}
            message="Você ainda não comprou nada na loja"
            hint="Quando fizer um pedido, ele aparece aqui com o andamento da entrega."
            action={<Link to="/loja" className="inline-flex items-center min-h-[44px] px-5 rounded-xl bg-azul text-white font-medium hover:bg-azul-claro">Ver a loja</Link>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => {
            const st = STATUS[p.status] ?? { label: p.status, variant: 'warning' as const };
            return (
              <Card key={p.id}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm text-texto-fraco">
                    {formatarDataBanco(p.created_at)} · {METODO[p.metodo_pagamento] ?? p.metodo_pagamento}
                  </span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>

                <ul className="space-y-1">
                  {p.itens.map((it, idx) => (
                    <li key={idx} className="flex justify-between gap-3 text-sm">
                      <span className="flex-1 min-w-0">
                        <span className="text-texto-fraco tabular-nums">{it.quantidade}×</span> {it.nome_produto}
                        {it.nome_variacao && <span className="text-texto-fraco"> ({it.nome_variacao})</span>}
                      </span>
                      <span className="text-texto-fraco tabular-nums">{brl(it.subtotal)}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-borda">
                  <span className="text-sm text-texto-fraco">Total</span>
                  <span className="font-display text-xl text-noite tracking-wide">{brl(p.total)}</span>
                </div>

                {/* Entrega */}
                <div className="mt-2.5 pt-2.5 border-t border-borda text-sm">
                  {p.entrega_tipo === 'envio' ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={p.envio_status === 'enviado' ? 'success' : 'warning'}>{p.envio_status === 'enviado' ? 'Enviado' : 'A enviar'}</Badge>
                        <span className="text-texto-fraco">Frete {brl(p.frete || 0)}</span>
                      </div>
                      {p.endereco && <p className="text-texto-fraco">Para: <span className="text-texto">{p.endereco}</span></p>}
                      {p.envio_status === 'enviado' && p.rastreamento && (
                        <p className="text-texto-fraco">Rastreio: <span className="text-texto font-medium select-all">{p.rastreamento}</span></p>
                      )}
                    </div>
                  ) : (
                    <p className="text-texto-fraco">Retirada no local</p>
                  )}
                </div>

                {/* Parcelas */}
                {p.parcelas_lista.length > 1 && (
                  <div className="mt-3 rounded-xl bg-fundo-elevado border border-borda p-3">
                    <p className="text-sm font-medium mb-1">Parcelas</p>
                    <ul className="divide-y divide-borda">
                      {p.parcelas_lista.map(par => (
                        <li key={par.id} className="py-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2">
                              <span className="tabular-nums">{par.numero}/{par.total_parcelas}</span>
                              <Badge variant={par.status === 'pago' ? 'success' : 'warning'}>{par.status === 'pago' ? 'Paga' : 'Pendente'}</Badge>
                            </span>
                            <span className="font-medium tabular-nums">{brl(par.valor)}</span>
                          </div>
                          {par.status !== 'pago' && (
                            <div className="mt-2">
                              <EnviarComprovante origem="loja_parcela" referenciaId={par.id} onEnviado={recarregar} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Comprovante do pedido inteiro (sem parcelas) */}
                {p.parcelas_lista.length <= 1 && p.status !== 'pago' && (
                  <div className="mt-3">
                    <EnviarComprovante origem="loja" referenciaId={p.id} onEnviado={recarregar} size="md" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
