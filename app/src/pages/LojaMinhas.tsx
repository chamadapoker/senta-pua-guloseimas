import { useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { BackButton } from '../components/ui/BackButton';
import { EnviarComprovante } from '../components/ui/EnviarComprovante';
import { api } from '../services/api';
import { useUserAuth } from '../hooks/useUserAuth';
import { useNavigate } from 'react-router-dom';

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
}

export function LojaMinhas() {
  const { user, token } = useUserAuth();
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { navigate('/login', { state: { returnTo: '/loja/minhas' } }); return; }
    api.get<Pedido[]>('/api/loja/meus-pedidos').then(setPedidos).finally(() => setLoading(false));
  }, [token, navigate]);

  const recarregar = () => api.get<Pedido[]>('/api/loja/meus-pedidos').then(setPedidos);

  if (!user) return null;

  return (
    <AppLayout>
      <BackButton to="/loja" className="mb-3" />
      <h1 className="font-display text-2xl text-azul tracking-wider mb-4">MINHAS COMPRAS</h1>

      {loading ? (
        <div className="text-center py-10 text-texto-fraco">Carregando...</div>
      ) : pedidos.length === 0 ? (
        <div className="bg-white rounded-xl border border-borda p-10 text-center text-texto-fraco">
          Você ainda não comprou nada na loja.
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-borda p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-texto-fraco">
                  {new Date(p.created_at + 'Z').toLocaleDateString('pt-BR')} · {p.metodo_pagamento.toUpperCase()}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  p.status === 'pago' ? 'bg-green-100 text-verde-escuro' :
                  p.status === 'fiado' ? 'bg-red-50 text-vermelho' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {p.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-1 mb-2">
                {p.itens.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="flex-1 truncate">
                      <span className="text-azul font-medium">{it.quantidade}×</span> {it.nome_produto}
                      {it.nome_variacao && <span className="text-xs text-texto-fraco"> ({it.nome_variacao})</span>}
                    </span>
                    <span className="text-texto-fraco ml-2">R$ {it.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-borda">
                <span className="text-xs text-texto-fraco">Total</span>
                <span className="font-display text-lg text-azul tracking-wider">R$ {p.total.toFixed(2)}</span>
              </div>

              {/* Parcelas */}
              {p.parcelas_lista.length > 1 && (
                <div className="mt-3 bg-fundo rounded-lg p-2">
                  <div className="text-[10px] text-texto-fraco uppercase tracking-wider mb-1">Parcelas</div>
                  <div className="space-y-1">
                    {p.parcelas_lista.map(par => (
                      <div key={par.id} className="flex items-center justify-between text-xs">
                        <span>
                          {par.numero}/{par.total_parcelas}
                          <span className={`ml-2 text-[10px] ${par.status === 'pago' ? 'text-verde-escuro' : 'text-amber-700'}`}>
                            {par.status === 'pago' ? '✓ pago' : 'pendente'}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">R$ {par.valor.toFixed(2)}</span>
                          {par.status !== 'pago' && (
                            <EnviarComprovante origem="loja_parcela" referenciaId={par.id} onEnviado={recarregar} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comprovante do pedido inteiro (sem parcelas) */}
              {p.parcelas_lista.length <= 1 && p.status !== 'pago' && (
                <div className="mt-3">
                  <EnviarComprovante origem="loja" referenciaId={p.id} onEnviado={recarregar} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
