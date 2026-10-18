import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { AppLayout } from '../components/AppLayout';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { EnviarComprovante } from '../components/ui/EnviarComprovante';
import { Icon } from '../components/ui/Icon';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { formatarDataBanco } from '../services/datas';
import { api } from '../services/api';
import { Loading } from '../components/ui/Loading';
import { gerarPayloadPix } from '../services/pix';
import { useUserAuth } from '../hooks/useUserAuth';
import { useConfirm } from '../hooks/useConfirm';
import { useCopiar } from '../hooks/useCopiar';
import { SuccessBurst } from '../components/ui/SuccessBurst';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  return url ? (url.startsWith('/api') ? `${WORKER_URL}${url}` : url) : null;
}

interface IngressoTipo { id: string; nome: string; valor: number; ordem: number; }

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
  imagem_url: string | null;
  tipos: IngressoTipo[];
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
  pix_chave: string | null;
  pix_tipo: string | null;
  pix_nome: string | null;
  pix_whatsapp: string | null;
  numero_ingresso: number | null;
  tipo_nome: string | null;
  checkin_at: string | null;
  imagem_url: string | null;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Data do evento ("YYYY-MM-DD") no fuso de Brasília
function formatData(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return formatarDataBanco(iso, opts);
}

function categoriaLabel(cat: string): string {
  if (cat === 'cerveja') return 'Cerveja';
  if (cat === 'refri') return 'Refrigerante';
  return 'Padrão';
}

export function XimbocaPublica() {
  const { user } = useUserAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { copiar, modalCopiaManual } = useCopiar();
  const [aba, setAba] = useState<'abertas' | 'meus'>('abertas');
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [meusEventos, setMeusEventos] = useState<MeuEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [participarModal, setParticiparModal] = useState<EventoPublico | null>(null);
  const [categoriaEscolhida, setCategoriaEscolhida] = useState<'padrao' | 'cerveja' | 'refri'>('padrao');
  const [tipoEscolhido, setTipoEscolhido] = useState<string | null>(null);
  const [acaoLoading, setAcaoLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [festaKey, setFestaKey] = useState(0);
  const [erroCarga, setErroCarga] = useState(false);
  // Callback estável para o Modal (ele refaz o foco quando onClose muda)
  const fecharParticipar = useCallback(() => setParticiparModal(null), []);

  const copiarPixEvento = async (ev: MeuEvento) => {
    if (!ev.pix_chave || !ev.pix_nome) {
      setErro('Este evento ainda não tem PIX configurado. Fale com o responsável.');
      return;
    }
    const valor = ev.valor_individual ?? ev.valor_por_pessoa;
    const payload = gerarPayloadPix(valor, { chave: ev.pix_chave, nome: ev.pix_nome, tipo: ev.pix_tipo });
    if (!(await copiar(payload))) return;
    setCopiadoId(ev.id);
    setTimeout(() => setCopiadoId(null), 3000);
  };

  const enviarComprovanteEvento = (ev: MeuEvento) => {
    if (!ev.pix_whatsapp) {
      setErro('Este evento não tem WhatsApp do responsável. Fale com o admin.');
      return;
    }
    const valor = ev.valor_individual ?? ev.valor_por_pessoa;
    const texto = `Comprovante Ximboca\n${ev.nome}\nValor: R$ ${valor.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
    window.open(`https://wa.me/55${ev.pix_whatsapp}?text=${encodeURIComponent(texto)}`, '_blank');
  };

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
    setErroCarga(false);
    try {
      if (aba === 'abertas') {
        const data = await api.get<EventoPublico[]>('/api/ximboca/publico/eventos');
        setEventos(data);
      } else {
        const data = await api.get<MeuEvento[]>('/api/ximboca/publico/meus-eventos');
        setMeusEventos(data);
      }
    } catch (e) {
      setErroCarga(true);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  const abrirParticipar = (ev: EventoPublico) => {
    setParticiparModal(ev);
    setCategoriaEscolhida('padrao');
    setTipoEscolhido(null);
    setErro(''); setMsg('');
  };

  const confirmarParticipar = async () => {
    if (!participarModal) return;
    if (participarModal.tipos?.length && !tipoEscolhido) { setErro('Escolha o tipo de ingresso'); return; }
    setAcaoLoading(true); setErro(''); setMsg('');
    try {
      await api.post(`/api/ximboca/publico/eventos/${participarModal.id}/participar`, {
        categoria_consumo: categoriaEscolhida,
        tipo_ingresso_id: tipoEscolhido,
      });
      setMsg('Inscrição confirmada. Seu ingresso está em Minhas ximbocas.');
      setFestaKey(k => k + 1);
      setParticiparModal(null);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao confirmar');
    } finally {
      setAcaoLoading(false);
    }
  };

  const cancelarParticipacao = async (eventoId: string) => {
    if (!(await confirm({ message: 'Tem certeza que deseja cancelar sua participação?', confirmText: 'Cancelar participação' }))) return;
    setErro(''); setMsg('');
    setAcaoLoading(true);
    try {
      await api.delete(`/api/ximboca/publico/eventos/${eventoId}/participar`);
      setMsg('Participação cancelada.');
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

  const opcaoCls = (ativo: boolean) =>
    `w-full min-h-[52px] flex items-center justify-between gap-3 px-3.5 rounded-xl border-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
      ativo ? 'border-azul bg-blue-50/50' : 'border-borda bg-white hover:border-borda-forte'}`;

  return (
    <AppLayout>
      {festaKey > 0 && <SuccessBurst key={festaKey} />}
      <BackButton to="/" className="min-h-[44px] mb-1" />
      <PageHeader title="Ximboca" subtitle="Eventos do esquadrão: inscreva-se, pague e mostre o QR na entrada." />

      {/* Abas */}
      <div role="tablist" aria-label="Ximbocas" className="grid grid-cols-2 gap-1 bg-white rounded-xl p-1 border border-borda mb-5 max-w-md">
        {([
          { v: 'abertas', label: 'Abertas' },
          { v: 'meus', label: 'Minhas ximbocas' },
        ] as const).map(t => (
          <button
            key={t.v}
            role="tab"
            aria-selected={aba === t.v}
            onClick={() => setAba(t.v)}
            className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
              aba === t.v ? 'bg-noite text-white' : 'text-texto-fraco hover:text-texto'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p role="status" className="text-verde-escuro text-sm bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
      {erro && !participarModal && !erroCarga && <p role="alert" className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{erro}</p>}

      {loading ? (
        <Loading label="Carregando ximbocas..." />
      ) : erroCarga ? (
        <EmptyState
          icon={<Icon name="warning" size={24} />}
          message="Não foi possível carregar as ximbocas"
          hint="Confira sua conexão e tente de novo."
          action={<Button variant="outline" onClick={() => { setErro(''); carregar(); }}><Icon name="refresh" size={16} /> Tentar de novo</Button>}
        />
      ) : aba === 'abertas' ? (
        eventos.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="fire" size={24} />}
              message="Nenhuma ximboca aberta no momento"
              hint="Quando o próximo evento for anunciado, ele aparece aqui."
              action={<Button variant="ghost" onClick={() => setAba('meus')}>Ver minhas ximbocas</Button>}
            />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {eventos.map(ev => {
              const inscrito = !!ev.meu_participante_id;
              const pago = ev.meu_status === 'pago';
              return (
                <Card key={ev.id} className="!p-0 overflow-hidden flex flex-col">
                  {ev.imagem_url && <img src={resolveImg(ev.imagem_url)!} alt="" className="w-full object-cover max-h-56 sm:max-h-44" />}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start gap-3.5">
                      <DataBloco data={ev.data} />
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-[17px] leading-snug text-texto">{ev.nome}</h2>
                        <p className="text-sm text-texto-fraco mt-0.5">
                          {ev.total_participantes} {ev.total_participantes === 1 ? 'participante' : 'participantes'}
                        </p>
                      </div>
                      {inscrito && (
                        <Badge variant={pago ? 'success' : 'warning'}>{pago ? 'Pago' : 'Inscrito'}</Badge>
                      )}
                    </div>

                    {ev.descricao && <p className="text-sm text-texto-fraco mt-3">{ev.descricao}</p>}

                    <dl className="mt-3 rounded-xl bg-fundo-elevado border border-borda divide-y divide-borda text-sm">
                      {ev.valor_cerveja !== null && (
                        <div className="flex items-center justify-between px-3 py-2">
                          <dt className="inline-flex items-center gap-1.5"><Icon name="beer" size={16} /> Cerveja</dt>
                          <dd className="font-display text-lg leading-none tracking-wide">{brl(ev.valor_cerveja)}</dd>
                        </div>
                      )}
                      {ev.valor_refri !== null && (
                        <div className="flex items-center justify-between px-3 py-2">
                          <dt className="inline-flex items-center gap-1.5"><Icon name="soda" size={16} /> Refrigerante</dt>
                          <dd className="font-display text-lg leading-none tracking-wide">{brl(ev.valor_refri)}</dd>
                        </div>
                      )}
                      {(ev.valor_cerveja === null && ev.valor_refri === null) || ev.valor_por_pessoa > 0 ? (
                        <div className="flex items-center justify-between px-3 py-2">
                          <dt>Padrão</dt>
                          <dd className="font-display text-lg leading-none tracking-wide">{brl(ev.valor_por_pessoa)}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <div className="mt-auto pt-3">
                      {inscrito ? (
                        <>
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
                            <div>
                              <p className="text-sm text-verde-escuro font-medium">{pago ? 'Você pagou' : 'Você vai pagar'}</p>
                              <p className="text-xs text-verde-escuro">{categoriaLabel(ev.minha_categoria || 'padrao')}</p>
                            </div>
                            <span className="font-display text-2xl leading-none tracking-wide text-verde-escuro">
                              {brl(valorCategoria(ev, (ev.minha_categoria as 'padrao' | 'cerveja' | 'refri') || 'padrao'))}
                            </span>
                          </div>
                          {!pago && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <Button variant="ghost" onClick={() => setAba('meus')}>Pagar e ver QR</Button>
                              <Button variant="chip-danger" className="min-h-[44px]" onClick={() => cancelarParticipacao(ev.id)} disabled={acaoLoading}>
                                Cancelar inscrição
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <Button size="lg" className="w-full" onClick={() => abrirParticipar(ev)} disabled={acaoLoading}>
                          Participar
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        meusEventos.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="fire" size={24} />}
              message="Você ainda não participou de nenhuma ximboca"
              hint="Inscreva-se em uma ximboca aberta para receber seu ingresso."
              action={<Button onClick={() => setAba('abertas')}>Ver ximbocas abertas</Button>}
            />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {meusEventos.map(ev => {
              const valorFinal = ev.valor_individual ?? ev.valor_por_pessoa;
              const pago = ev.meu_status === 'pago';
              return (
                <Card key={ev.id} className="flex flex-col">
                  <div className="flex items-start gap-3.5">
                    <DataBloco data={ev.data} />
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-[17px] leading-snug text-texto">{ev.nome}</h2>
                      <p className="text-sm text-texto-fraco mt-0.5">{ev.status === 'aberto' ? 'Evento aberto' : 'Evento encerrado'}</p>
                    </div>
                    <Badge variant={pago ? 'success' : 'warning'}>{pago ? 'Pago' : 'Pendente'}</Badge>
                  </div>

                  <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 mt-3 border ${pago ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div>
                      <p className={`text-sm font-medium ${pago ? 'text-verde-escuro' : 'text-amber-800'}`}>{pago ? 'Você pagou' : 'Você vai pagar'}</p>
                      <p className={`text-xs ${pago ? 'text-verde-escuro' : 'text-amber-800'}`}>{categoriaLabel(ev.categoria_consumo)}</p>
                    </div>
                    <span className={`font-display text-2xl leading-none tracking-wide ${pago ? 'text-verde-escuro' : 'text-amber-800'}`}>{brl(valorFinal)}</span>
                  </div>

                  {/* Ingresso */}
                  <div className="mt-3 rounded-xl border border-borda overflow-hidden">
                    {ev.imagem_url && <img src={resolveImg(ev.imagem_url)!} alt="" className="w-full object-cover max-h-48 sm:max-h-36" />}
                    <div className="p-4 text-center">
                      <p className="text-sm text-texto-fraco">Seu ingresso</p>
                      <p className="font-display text-3xl leading-none tracking-wide text-noite mt-0.5">#{String(ev.numero_ingresso ?? 0).padStart(3, '0')}</p>
                      {ev.tipo_nome && <p className="text-sm text-texto-fraco mt-1">{ev.tipo_nome}</p>}
                      <div className="inline-block bg-white p-2 rounded-xl border border-borda mt-3">
                        <QRCodeCanvas value={ev.participante_id} size={180} level="M" includeMargin />
                      </div>
                      <p className={`text-sm mt-2 font-medium ${ev.checkin_at || pago ? 'text-verde-escuro' : 'text-amber-800'}`}>
                        {ev.checkin_at
                          ? 'Entrada já registrada'
                          : pago
                            ? 'Mostre este QR na entrada'
                            : 'Mostre este QR na entrada. A entrada só libera depois que o pagamento for aprovado.'}
                      </p>
                    </div>
                  </div>

                  {!pago && (
                    <div className="mt-3 space-y-2">
                      {ev.pix_chave ? (
                        <>
                          <Button variant="success" size="lg" className="w-full" onClick={() => copiarPixEvento(ev)}>
                            <Icon name={copiadoId === ev.id ? 'check' : 'document'} size={20} />
                            {copiadoId === ev.id ? 'Código copiado' : 'Copiar código PIX'}
                          </Button>
                          <div className="rounded-xl bg-fundo-elevado border border-borda px-3 py-2 text-sm">
                            <p className="text-texto-fraco">Chave PIX ({ev.pix_tipo || '—'})</p>
                            <p className="font-medium text-noite break-all select-all">{ev.pix_chave}</p>
                            {ev.pix_nome && <p className="text-xs text-texto-fraco mt-0.5">Recebedor: {ev.pix_nome}</p>}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <EnviarComprovante origem="ximboca" referenciaId={ev.participante_id} onEnviado={carregar} size="md" />
                            <Button variant="ghost" onClick={() => enviarComprovanteEvento(ev)} disabled={!ev.pix_whatsapp}>
                              Enviar pelo WhatsApp
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-texto-fraco bg-fundo-elevado border border-borda rounded-xl px-3 py-2.5 text-center">
                          O responsável ainda não cadastrou o PIX. Pague no local ou fale com o admin.
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Participar */}
      <Modal open={!!participarModal} onClose={fecharParticipar} title={participarModal?.nome || ''}>
        {participarModal && (
          <>
            <p className="text-sm text-texto-fraco mb-4 first-letter:uppercase">{formatData(participarModal.data, { weekday: 'long', day: '2-digit', month: 'long' })}</p>

            {participarModal.tipos?.length > 0 && (
              <div role="radiogroup" aria-label="Tipo de ingresso" className="mb-4">
                <p className="text-sm font-medium mb-2">Tipo de ingresso</p>
                <div className="space-y-2">
                  {participarModal.tipos.map(t => (
                    <button key={t.id} type="button" role="radio" aria-checked={tipoEscolhido === t.id} onClick={() => setTipoEscolhido(t.id)} className={opcaoCls(tipoEscolhido === t.id)}>
                      <span className="font-medium">{t.nome}</span>
                      <span className="font-display text-xl leading-none tracking-wide">{brl(t.valor)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!participarModal.tipos?.length && (
              <div role="radiogroup" aria-label="Categoria" className="mb-4">
                <p className="text-sm font-medium mb-2">Sua categoria</p>
                <div className="space-y-2">
                  {participarModal.valor_cerveja !== null && (
                    <button type="button" role="radio" aria-checked={categoriaEscolhida === 'cerveja'} onClick={() => setCategoriaEscolhida('cerveja')} className={opcaoCls(categoriaEscolhida === 'cerveja')}>
                      <span className="flex items-center gap-2 font-medium"><Icon name="beer" size={18} /> Cerveja</span>
                      <span className="font-display text-xl leading-none tracking-wide">{brl(participarModal.valor_cerveja)}</span>
                    </button>
                  )}
                  {participarModal.valor_refri !== null && (
                    <button type="button" role="radio" aria-checked={categoriaEscolhida === 'refri'} onClick={() => setCategoriaEscolhida('refri')} className={opcaoCls(categoriaEscolhida === 'refri')}>
                      <span className="flex items-center gap-2 font-medium"><Icon name="soda" size={18} /> Refrigerante</span>
                      <span className="font-display text-xl leading-none tracking-wide">{brl(participarModal.valor_refri)}</span>
                    </button>
                  )}
                  {(participarModal.valor_cerveja === null && participarModal.valor_refri === null) && (
                    <button type="button" role="radio" aria-checked={categoriaEscolhida === 'padrao'} onClick={() => setCategoriaEscolhida('padrao')} className={opcaoCls(categoriaEscolhida === 'padrao')}>
                      <span className="font-medium">Participação</span>
                      <span className="font-display text-xl leading-none tracking-wide">{brl(participarModal.valor_por_pessoa)}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {erro && <p role="alert" className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">{erro}</p>}

            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button variant="ghost" onClick={fecharParticipar}>Voltar</Button>
              <Button onClick={confirmarParticipar} disabled={acaoLoading}>
                {acaoLoading ? 'Confirmando...' : (participarModal.tipos?.length
                  ? `Confirmar${tipoEscolhido ? ` · ${brl(participarModal.tipos.find(t => t.id === tipoEscolhido)?.valor ?? 0)}` : ''}`
                  : `Confirmar · ${brl(valorCategoria(participarModal, categoriaEscolhida))}`)}
              </Button>
            </div>
          </>
        )}
      </Modal>
      {modalCopiaManual}
    </AppLayout>
  );
}

// Data em destaque no cartão do evento: dia grande + mês
function DataBloco({ data }: { data: string }) {
  const dia = formatarDataBanco(data, { day: '2-digit' });
  const mes = formatarDataBanco(data, { month: 'short' }).replace('.', '');
  return (
    <div className="w-14 shrink-0 rounded-xl bg-noite text-white text-center py-1.5" aria-label={formatarDataBanco(data, { day: '2-digit', month: 'long', year: 'numeric' })}>
      <div className="font-display text-3xl leading-none" aria-hidden="true">{dia}</div>
      <div className="text-xs font-semibold capitalize text-noite-texto mt-0.5" aria-hidden="true">{mes}</div>
    </div>
  );
}
