import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { api } from '../services/api';
import { useUserAuth } from '../hooks/useUserAuth';
import type { Usuario } from '../types';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

interface PedidoItem {
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface PedidoResumo {
  id: string;
  total: number;
  status: string;
  metodo_pagamento: string;
  created_at: string;
  paid_at: string | null;
  itens: PedidoItem[];
}

interface CafeStatus {
  mes_atual: string;
  pago: boolean;
  valor: number | null;
  tem_assinatura: boolean;
}

interface Totais {
  cantina: { gasto: number; pago: number; pendente: number; compras: number };
  cafe: { pago: number; pendente: number };
  ximboca: { pago: number; pendente: number };
  geral: { pago: number; pendente: number };
}

interface DashboardData {
  user: Usuario;
  debito_total: number;
  ultimos_pedidos: PedidoResumo[];
  cafe_status: CafeStatus | null;
  totais?: Totais;
}

const CATEGORIA_LABEL: Record<string, string> = {
  oficial: 'Oficial',
  graduado: 'Graduado/SO',
  praca: 'Praça',
};

function formatData(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, hoje)) return 'hoje';
  if (sameDay(d, ontem)) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function Dashboard() {
  const { user } = useUserAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/api/usuarios/me/dashboard')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-6">
        {resolveImg(user.foto_url) ? (
          <img src={resolveImg(user.foto_url)!} alt={user.trigrama} className="w-14 h-14 rounded-full object-cover border-2 border-borda" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-azul/10 flex items-center justify-center font-display text-azul text-lg">
            {user.trigrama}
          </div>
        )}
        <div>
          <div className="text-lg font-display text-texto tracking-wider">Bem-vindo, {user.trigrama}</div>
          <div className="text-xs text-texto-fraco">{CATEGORIA_LABEL[user.categoria] || user.categoria}</div>
        </div>
      </div>

      {user.acesso_bloqueado && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-amber-900">
              <div className="font-medium">Seu acesso de visitante expirou ou foi pausado</div>
              <div className="text-xs mt-1">Você não pode realizar compras. <Link to="/acesso-expirado" className="underline font-medium">Renovar acesso</Link></div>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-10 text-texto-fraco">Carregando...</div>}

      {!loading && data && (
        <>
          <div className="bg-white rounded-2xl border border-borda p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-texto-fraco">Caixinha do Café</div>
              {data.cafe_status?.tem_assinatura && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  data.cafe_status.pago
                    ? 'bg-green-100 text-verde-escuro'
                    : 'bg-red-50 text-vermelho'
                }`}>
                  {data.cafe_status.pago ? 'Pago' : 'Pendente'}
                </span>
              )}
            </div>

            {!user.sala_cafe && (
              <p className="text-sm text-texto-fraco">Você não participa de caixinha do café.</p>
            )}

            {user.sala_cafe && data.cafe_status && !data.cafe_status.tem_assinatura && (
              <p className="text-sm text-texto-fraco">Você ainda não assinou a caixinha. Procure o administrador da sua cantina.</p>
            )}

            {user.sala_cafe && data.cafe_status?.tem_assinatura && (
              <div>
                <div className="text-2xl font-display text-azul tracking-wider">
                  R$ {(data.cafe_status.valor || 0).toFixed(2)}
                </div>
                <div className="text-xs text-texto-fraco mt-1">
                  Referência: {data.cafe_status.mes_atual}
                </div>
                {!data.cafe_status.pago && (
                  <Link to="/cafe" className="inline-block mt-3 text-sm text-azul font-medium hover:underline">
                    Ver detalhes →
                  </Link>
                )}
              </div>
            )}
          </div>

          {data.totais && (
            <div className="bg-white rounded-2xl border border-borda p-4 mb-4 shadow-sm">
              <div className="text-sm font-medium text-texto-fraco mb-3">Resumo Financeiro</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="text-[10px] text-verde-escuro uppercase tracking-wider">Total Pago</div>
                  <div className="font-display text-xl text-verde-escuro tracking-wider">
                    R$ {data.totais.geral.pago.toFixed(2)}
                  </div>
                </div>
                <div className={`rounded-lg p-3 ${data.totais.geral.pendente > 0 ? 'bg-red-50' : 'bg-fundo'}`}>
                  <div className={`text-[10px] uppercase tracking-wider ${data.totais.geral.pendente > 0 ? 'text-vermelho' : 'text-texto-fraco'}`}>Total Pendente</div>
                  <div className={`font-display text-xl tracking-wider ${data.totais.geral.pendente > 0 ? 'text-vermelho' : 'text-texto-fraco'}`}>
                    R$ {data.totais.geral.pendente.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="list-zebra rounded-lg overflow-hidden border border-borda text-xs">
                <div className="grid grid-cols-3 px-3 py-2 font-medium text-texto-fraco">
                  <span>Origem</span>
                  <span className="text-right">Pago</span>
                  <span className="text-right">Pendente</span>
                </div>
                <div className="grid grid-cols-3 px-3 py-2">
                  <span>Cantina ({data.totais.cantina.compras})</span>
                  <span className="text-right text-verde-escuro">R$ {data.totais.cantina.pago.toFixed(2)}</span>
                  <span className="text-right text-vermelho">R$ {data.totais.cantina.pendente.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-3 px-3 py-2">
                  <span>Café</span>
                  <span className="text-right text-verde-escuro">R$ {data.totais.cafe.pago.toFixed(2)}</span>
                  <span className="text-right text-vermelho">R$ {data.totais.cafe.pendente.toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-3 px-3 py-2">
                  <span>Ximboca</span>
                  <span className="text-right text-verde-escuro">R$ {data.totais.ximboca.pago.toFixed(2)}</span>
                  <span className="text-right text-vermelho">R$ {data.totais.ximboca.pendente.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-[10px] text-texto-fraco mt-2">
                Total gasto na cantina: <span className="font-medium">R$ {data.totais.cantina.gasto.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-borda p-4 mb-4 shadow-sm">
            <div className="text-sm font-medium text-texto-fraco mb-3">Últimos Pedidos</div>
            {data.ultimos_pedidos.length === 0 ? (
              <p className="text-sm text-texto-fraco text-center py-3">Nenhum pedido ainda</p>
            ) : (
              <div className="space-y-3">
                {data.ultimos_pedidos.map(p => (
                  <div key={p.id} className="rounded-lg bg-fundo p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-texto-fraco">
                        {formatData(p.created_at)}
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        p.status === 'pago' ? 'bg-green-100 text-verde-escuro' :
                        p.status === 'fiado' ? 'bg-red-50 text-vermelho' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {p.status.toUpperCase()}
                      </span>
                    </div>
                    {p.itens && p.itens.length > 0 ? (
                      <div className="space-y-1">
                        {p.itens.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="flex-1 truncate">
                              <span className="text-azul font-medium">{item.quantidade}×</span> {item.nome_produto}
                            </span>
                            <span className="text-texto-fraco ml-2">
                              R$ {item.subtotal.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-texto-fraco">Sem detalhes</div>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-borda">
                      <span className="text-xs text-texto-fraco">Total</span>
                      <span className="font-display text-base text-azul tracking-wider">
                        R$ {p.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </>
      )}
    </AppLayout>
  );
}
