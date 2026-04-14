import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import { useUserAuth } from '../hooks/useUserAuth';

interface EventoPublico {
  id: string;
  nome: string;
  data: string;
  descricao: string;
  status: string;
  valor_por_pessoa: number;
  valor_cerveja: number | null;
  valor_refri: number | null;
  total_participantes: number;
  meu_participante_id: string | null;
  minha_categoria: string | null;
  meu_status: string | null;
}

interface MeuEvento {
  id: string;
  nome: string;
  data: string;
  status: string;
  participante_id: string;
  categoria_consumo: string;
  valor_individual: number | null;
  valor_por_pessoa: number;
  meu_status: string;
  paid_at: string | null;
}

function formatData(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function categoriaLabel(cat: string): string {
  if (cat === 'cerveja') return 'Cerveja';
  if (cat === 'refri') return 'Refrigerante';
  return 'Padrão';
}

export function XimbocaPublica() {
  const { user } = useUserAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useState<'abertas' | 'meus'>('abertas');
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [meusEventos, setMeusEventos] = useState<MeuEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [participarModal, setParticiparModal] = useState<EventoPublico | null>(null);
  const [categoriaEscolhida, setCategoriaEscolhida] = useState<'padrao' | 'cerveja' | 'refri'>('padrao');
  const [acaoLoading, setAcaoLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { returnTo: '/ximboca' } });
      return;
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  const carregar = async () => {
    setLoading(true);
    try {
      if (aba === 'abertas') {
        const data = await api.get<EventoPublico[]>('/api/ximboca/publico/eventos');
        setEventos(data);
      } else {
        const data = await api.get<MeuEvento[]>('/api/ximboca/publico/meus-eventos');
        setMeusEventos(data);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  const abrirParticipar = (ev: EventoPublico) => {
    setParticiparModal(ev);
    setCategoriaEscolhida('padrao');
    setErro(''); setMsg('');
  };

  const confirmarParticipar = async () => {
    if (!participarModal) return;
    setAcaoLoading(true);
    setErro(''); setMsg('');
    try {
      await api.post(`/api/ximboca/publico/eventos/${participarModal.id}/participar`, {
        categoria_consumo: categoriaEscolhida,
      });
      setMsg('Inscrição confirmada! Você já está participando.');
      setParticiparModal(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao confirmar');
    } finally {
      setAcaoLoading(false);
    }
  };

  const cancelarParticipacao = async (eventoId: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar sua participação?')) return;
    setErro(''); setMsg('');
    setAcaoLoading(true);
    try {
      await api.delete(`/api/ximboca/publico/eventos/${eventoId}/participar`);
      setMsg('Participação cancelada');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao cancelar');
    } finally {
      setAcaoLoading(false);
    }
  };

  const valorCategoria = (ev: EventoPublico, cat: 'padrao' | 'cerveja' | 'refri'): number => {
    if (cat === 'cerveja' && ev.valor_cerveja !== null) return ev.valor_cerveja;
    if (cat === 'refri' && ev.valor_refri !== null) return ev.valor_refri;
    return ev.valor_por_pessoa;
  };

  if (!user) return null;

  return (
    <AppLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">XIMBOCA</h1>

      {/* Abas */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-borda shadow-sm mb-5">
        <button
          onClick={() => setAba('abertas')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'abertas' ? 'bg-azul text-white shadow-sm' : 'text-texto-fraco'
          }`}
        >
          Abertas
        </button>
        <button
          onClick={() => setAba('meus')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'meus' ? 'bg-azul text-white shadow-sm' : 'text-texto-fraco'
          }`}
        >
          Minhas Ximbocas
        </button>
      </div>

      {msg && <p className="text-verde text-sm bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
      {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{erro}</p>}

      {loading ? (
        <div className="text-center py-10 text-texto-fraco">Carregando...</div>
      ) : aba === 'abertas' ? (
        eventos.length === 0 ? (
          <div className="bg-white rounded-xl border border-borda p-10 text-center text-texto-fraco">
            Nenhuma ximboca aberta no momento.
          </div>
        ) : (
          <div className="space-y-3">
            {eventos.map(ev => (
              <div key={ev.id} className="bg-white rounded-xl border border-borda p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-lg text-azul tracking-wider">{ev.nome}</div>
                    <div className="text-xs text-texto-fraco">
                      {formatData(ev.data)} · {ev.total_participantes} participante(s)
                    </div>
                  </div>
                  {ev.meu_participante_id && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      ev.meu_status === 'pago' ? 'bg-green-100 text-verde-escuro' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {ev.meu_status === 'pago' ? 'PAGO' : 'INSCRITO'}
                    </span>
                  )}
                </div>

                {ev.descricao && <p className="text-sm text-texto-fraco mb-3">{ev.descricao}</p>}

                <div className="bg-fundo rounded-lg p-3 mb-3 text-xs">
                  <div className="text-texto-fraco mb-1">Valores:</div>
                  <div className="space-y-0.5">
                    {ev.valor_cerveja !== null && (
                      <div className="flex justify-between"><span>🍺 Cerveja</span><span className="font-medium">R$ {ev.valor_cerveja.toFixed(2)}</span></div>
                    )}
                    {ev.valor_refri !== null && (
                      <div className="flex justify-between"><span>🥤 Refrigerante</span><span className="font-medium">R$ {ev.valor_refri.toFixed(2)}</span></div>
                    )}
                    {(ev.valor_cerveja === null && ev.valor_refri === null) || ev.valor_por_pessoa > 0 ? (
                      <div className="flex justify-between"><span>Padrão</span><span className="font-medium">R$ {ev.valor_por_pessoa.toFixed(2)}</span></div>
                    ) : null}
                  </div>
                </div>

                {ev.meu_participante_id ? (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                      <div className="text-[10px] text-verde-escuro uppercase tracking-wider font-medium">Você vai pagar</div>
                      <div className="flex items-baseline justify-between">
                        <span className="font-display text-2xl text-verde-escuro tracking-wider">
                          R$ {valorCategoria(ev, (ev.minha_categoria as 'padrao' | 'cerveja' | 'refri') || 'padrao').toFixed(2)}
                        </span>
                        <span className="text-xs text-verde-escuro font-medium">{categoriaLabel(ev.minha_categoria || 'padrao')}</span>
                      </div>
                    </div>
                    {ev.meu_status !== 'pago' && (
                      <button
                        onClick={() => cancelarParticipacao(ev.id)}
                        disabled={acaoLoading}
                        className="w-full text-xs text-vermelho hover:underline py-1"
                      >
                        Cancelar participação
                      </button>
                    )}
                  </>
                ) : (
                  <Button size="sm" className="w-full" onClick={() => abrirParticipar(ev)} disabled={acaoLoading}>
                    Participar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        meusEventos.length === 0 ? (
          <div className="bg-white rounded-xl border border-borda p-10 text-center text-texto-fraco">
            Você ainda não participou de nenhuma ximboca.
          </div>
        ) : (
          <div className="space-y-3">
            {meusEventos.map(ev => {
              const valorFinal = ev.valor_individual ?? ev.valor_por_pessoa;
              return (
                <div key={ev.id} className="bg-white rounded-xl border border-borda p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-display text-lg text-azul tracking-wider">{ev.nome}</div>
                      <div className="text-xs text-texto-fraco">
                        {formatData(ev.data)} · {ev.status === 'aberto' ? 'Aberto' : 'Fechado'}
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      ev.meu_status === 'pago' ? 'bg-green-100 text-verde-escuro' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {ev.meu_status === 'pago' ? 'PAGO' : 'PENDENTE'}
                    </span>
                  </div>

                  <div className={`rounded-lg p-3 mt-2 ${ev.meu_status === 'pago' ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className={`text-[10px] uppercase tracking-wider font-medium ${ev.meu_status === 'pago' ? 'text-verde-escuro' : 'text-amber-700'}`}>
                          {ev.meu_status === 'pago' ? 'Você pagou' : 'Você vai pagar'}
                        </div>
                        <div className="text-[10px] text-texto-fraco">{categoriaLabel(ev.categoria_consumo)}</div>
                      </div>
                      <span className={`font-display text-2xl tracking-wider ${ev.meu_status === 'pago' ? 'text-verde-escuro' : 'text-amber-700'}`}>
                        R$ {valorFinal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal Participar */}
      {participarModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setParticiparModal(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-azul tracking-wider mb-1">{participarModal.nome}</h3>
            <p className="text-xs text-texto-fraco mb-4">{formatData(participarModal.data)}</p>

            <div className="text-sm font-medium mb-2">Sua categoria:</div>
            <div className="space-y-2 mb-4">
              {participarModal.valor_cerveja !== null && (
                <button
                  type="button"
                  onClick={() => setCategoriaEscolhida('cerveja')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    categoriaEscolhida === 'cerveja' ? 'bg-azul text-white border-azul' : 'bg-white border-borda hover:border-azul/50'
                  }`}
                >
                  <span className="flex items-center gap-2">🍺 Cerveja</span>
                  <span className="font-bold">R$ {participarModal.valor_cerveja.toFixed(2)}</span>
                </button>
              )}
              {participarModal.valor_refri !== null && (
                <button
                  type="button"
                  onClick={() => setCategoriaEscolhida('refri')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    categoriaEscolhida === 'refri' ? 'bg-azul text-white border-azul' : 'bg-white border-borda hover:border-azul/50'
                  }`}
                >
                  <span className="flex items-center gap-2">🥤 Refrigerante</span>
                  <span className="font-bold">R$ {participarModal.valor_refri.toFixed(2)}</span>
                </button>
              )}
              {(participarModal.valor_cerveja === null && participarModal.valor_refri === null) && (
                <button
                  type="button"
                  onClick={() => setCategoriaEscolhida('padrao')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                    categoriaEscolhida === 'padrao' ? 'bg-azul text-white border-azul' : 'bg-white border-borda hover:border-azul/50'
                  }`}
                >
                  <span>Participar</span>
                  <span className="font-bold">R$ {participarModal.valor_por_pessoa.toFixed(2)}</span>
                </button>
              )}
            </div>

            {erro && <p className="text-vermelho text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{erro}</p>}

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setParticiparModal(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={confirmarParticipar} disabled={acaoLoading}>
                {acaoLoading ? 'Confirmando...' : `Confirmar (R$ ${valorCategoria(participarModal, categoriaEscolhida).toFixed(2)})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
