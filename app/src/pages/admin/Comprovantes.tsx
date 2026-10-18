import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Icon, type IconName } from '../../components/ui/Icon';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useAcessoAdmin, HOME_CAFE_GRADUADO } from '../../hooks/useAuth';
import { useAcao } from '../../hooks/useAcao';
import { Loading } from '../../components/ui/Loading';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { inputClass } from '../../components/ui/Field';
import { formatarDataHoraBanco as dataHora, parseDataBanco } from '../../services/datas';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

interface Comprovante {
  id: string;
  origem: 'cantina' | 'loja' | 'loja_parcela' | 'cafe' | 'ximboca';
  referencia_id: string;
  trigrama: string;
  valor: number | null;
  imagem_url: string;
  observacao: string;
  status: 'aguardando' | 'aprovado' | 'rejeitado';
  motivo_rejeicao: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Resp {
  items: Comprovante[];
  total: number;
  limit: number;
  offset: number;
}

const ORIGEM_LABEL: Record<string, string> = {
  cantina: 'Cantina',
  loja: 'Loja',
  loja_parcela: 'Loja (parcela)',
  cafe: 'Café',
  ximboca: 'Ximboca',
};

const PAGE = 50;

const ABAS = [
  { id: 'aguardando' as const, label: 'Aguardando' },
  { id: 'aprovado' as const, label: 'Aprovados' },
  { id: 'rejeitado' as const, label: 'Rejeitados' },
];

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Cor da borda lateral = de onde vem o pagamento. Dentro de uma aba todos têm o mesmo status,
// então a origem é o que de fato ajuda a ler a fila de relance.
const ORIGEM_ESTILO: Record<Comprovante['origem'], { cor: string; fundo: string; icone: IconName }> = {
  cantina:      { cor: '#1d3fa0', fundo: '#e8edfb', icone: 'cutlery' },
  loja:         { cor: '#0e7490', fundo: '#e3f4f8', icone: 'bag' },
  loja_parcela: { cor: '#0e7490', fundo: '#e3f4f8', icone: 'bag' },
  cafe:         { cor: '#8a4b14', fundo: '#f6ece2', icone: 'coffee' },
  ximboca:      { cor: '#c2410c', fundo: '#fcebe2', icone: 'fire' },
};

// "há 20 min", "há 3 h", "há 2 dias" — e se passou de 24 h aguardando, merece destaque
function tempoEspera(createdAt: string): { texto: string; atrasado: boolean } {
  const min = Math.max(0, Math.round((Date.now() - parseDataBanco(createdAt).getTime()) / 60000));
  if (min < 60) return { texto: min <= 1 ? 'agora há pouco' : `há ${min} min`, atrasado: false };
  const h = Math.round(min / 60);
  if (h < 24) return { texto: `há ${h} h`, atrasado: false };
  const d = Math.round(h / 24);
  return { texto: `há ${d} ${d === 1 ? 'dia' : 'dias'}`, atrasado: true };
}

const ehPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

export function Comprovantes() {
  const [aba, setAba] = useState<'aguardando' | 'aprovado' | 'rejeitado'>('aguardando');
  const [origem, setOrigem] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [preview, setPreview] = useState<Comprovante | null>(null);
  const [rejeitando, setRejeitando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const confirmar = useConfirm();
  const { showToast } = useToast();
  const { busy, executar } = useAcao();
  // Busca aplicada (o input só vale ao clicar "Buscar") + contador para forçar recarga
  const [qAplicada, setQAplicada] = useState('');
  const [recarregar, setRecarregar] = useState(0);
  // Responsável só pelo café dos graduados: o backend já filtra; aqui só some o filtro de origem
  const { acessoRestritoCafe } = useAcessoAdmin();

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro('');
    const qs = new URLSearchParams({ status: aba, limit: String(PAGE), offset: String(offset) });
    if (origem && !acessoRestritoCafe) qs.set('origem', origem);
    if (qAplicada.trim()) qs.set('q', qAplicada.trim());
    api.get<Resp>(`/api/comprovantes?${qs}`)
      .then(r => { if (ativo) setData(r); })
      .catch((e: any) => {
        if (!ativo) return;
        const msg = e?.message || 'Erro ao carregar comprovantes';
        setErro(msg);
        showToast(msg, 'error');
      })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [aba, offset, origem, qAplicada, recarregar, showToast, acessoRestritoCafe]);

  const carregar = () => setRecarregar(n => n + 1);

  const trocarAba = (novo: typeof aba) => { setAba(novo); setOffset(0); };
  const buscar = (e: React.FormEvent) => { e.preventDefault(); setQAplicada(q); setOffset(0); carregar(); };

  const resolverImg = (url: string) => url.startsWith('/api') ? `${WORKER_URL}${url}` : url;

  const abrir = (c: Comprovante, modoRejeitar = false) => { setPreview(c); setMotivo(''); setRejeitando(modoRejeitar); };
  const fechar = useCallback(() => { setPreview(null); setRejeitando(false); }, []);

  const aprovar = async (c: Comprovante) => {
    if (!(await confirmar({ title: 'Aprovar comprovante', message: `Aprovar comprovante de ${c.trigrama}? Isso marca o pagamento como PAGO.`, confirmText: 'Aprovar', danger: false }))) return;
    const ok = await executar(`comp:${c.id}`, () => api.put(`/api/comprovantes/${c.id}/aprovar`, {}), { sucesso: 'Comprovante aprovado' });
    if (ok === undefined) return;
    setPreview(null);
    carregar();
  };

  const rejeitar = async (c: Comprovante) => {
    if (!motivo.trim()) { showToast('Informe o motivo da rejeição', 'error'); return; }
    const ok = await executar(`comp:${c.id}`, () => api.put(`/api/comprovantes/${c.id}/rejeitar`, { motivo }), { sucesso: 'Comprovante rejeitado' });
    if (ok === undefined) return;
    setPreview(null);
    setMotivo('');
    setRejeitando(false);
    carregar();
  };

  const totalPages = data ? Math.ceil(data.total / PAGE) : 0;
  const currentPage = Math.floor(offset / PAGE) + 1;

  const statusBadge = (s: Comprovante['status']) =>
    s === 'aprovado' ? <Badge variant="success">Aprovado</Badge>
      : s === 'rejeitado' ? <Badge variant="danger">Rejeitado</Badge>
      : <Badge variant="warning">Aguardando</Badge>;

  return (
    <AppLayout>
      <BackButton to={acessoRestritoCafe ? HOME_CAFE_GRADUADO : '/admin'} className="mb-3" />
      <PageHeader
        title="Comprovantes de pagamento"
        subtitle={acessoRestritoCafe
          ? 'Comprovantes do café dos graduados. Confira e aprove para dar baixa.'
          : 'Confira os comprovantes enviados pelos militares e aprove para dar baixa.'}
      />

      <div role="tablist" aria-label="Situação" className="grid grid-cols-3 gap-1 bg-white rounded-2xl p-1 border border-borda shadow-sm mb-3">
        {ABAS.map(s => (
          <button
            key={s.id}
            role="tab"
            aria-selected={aba === s.id}
            onClick={() => trocarAba(s.id)}
            className={`min-h-[40px] rounded-xl text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
              aba === s.id ? 'bg-azul text-white' : 'text-texto-fraco hover:text-texto'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={buscar} className={`grid grid-cols-1 gap-2 mb-4 ${acessoRestritoCafe ? 'sm:grid-cols-[1fr_auto]' : 'sm:grid-cols-[1fr_auto_auto]'}`}>
        <label htmlFor="comp-q" className="sr-only">Buscar por trigrama</label>
        <input
          id="comp-q"
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por trigrama"
          className={`${inputClass} min-h-[44px]`}
        />
        {acessoRestritoCafe ? (
          <Button type="submit" size="md">Buscar</Button>
        ) : (
        <div className="grid grid-cols-[1fr_auto] sm:contents gap-2">
          <label htmlFor="comp-origem" className="sr-only">Origem</label>
          <select id="comp-origem" value={origem} onChange={e => { setOrigem(e.target.value); setOffset(0); }} className={`${inputClass} min-h-[44px] sm:w-auto`}>
            <option value="">Todas as origens</option>
            <option value="cantina">Cantina</option>
            <option value="loja">Loja</option>
            <option value="loja_parcela">Loja (parcela)</option>
            <option value="cafe">Café</option>
            <option value="ximboca">Ximboca</option>
          </select>
          <Button type="submit" size="md">Buscar</Button>
        </div>
        )}
      </form>

      {data && !erro && (
        <div className="text-sm text-texto-fraco mb-3">
          {data.total} comprovante(s){totalPages > 1 && ` · página ${currentPage} de ${totalPages}`}
        </div>
      )}

      {loading ? (
        <Loading label="Carregando comprovantes..." />
      ) : erro ? (
        <Card className="text-center py-8">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar os comprovantes.</p>
          <p className="text-sm text-texto-fraco mt-1">{erro}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={carregar}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="paper-clip" size={26} />}
            message={aba === 'aguardando' ? 'Nenhum comprovante aguardando' : aba === 'aprovado' ? 'Nenhum comprovante aprovado' : 'Nenhum comprovante rejeitado'}
            hint={qAplicada || (origem && !acessoRestritoCafe) ? (acessoRestritoCafe ? 'Tente limpar a busca.' : 'Tente limpar a busca ou trocar a origem.') : aba === 'aguardando' ? 'Quando um militar enviar um comprovante, ele aparece aqui.' : undefined}
          />
        </Card>
      ) : (
        <>
        {/* Legenda das cores da borda (só faz sentido com várias origens) */}
        {!acessoRestritoCafe && <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs text-texto-fraco" aria-label="Cores por origem">
          {(['cantina', 'loja', 'cafe', 'ximboca'] as const).map(o => (
            <span key={o} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ORIGEM_ESTILO[o].cor }} aria-hidden="true" />
              {ORIGEM_LABEL[o]}
            </span>
          ))}
        </div>}

        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.items.map(c => {
            const est = ORIGEM_ESTILO[c.origem] ?? ORIGEM_ESTILO.cantina;
            const espera = tempoEspera(c.created_at);
            const ocupado = busy(`comp:${c.id}`);
            return (
              <li
                key={c.id}
                className="group relative bg-white rounded-2xl border border-borda shadow-sm hover:shadow-md hover:border-borda-forte transition-[box-shadow,border-color] overflow-hidden flex flex-col"
              >
                {/* Borda lateral na cor da origem, terminando em ponta de flâmula */}
                <span
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: est.cor, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 8px), 0 100%)' }}
                  aria-hidden="true"
                />

                <div className="pl-5 pr-4 pt-4 pb-3 flex-1 flex flex-col">
                  {/* Topo: origem + tempo / status */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full text-xs font-semibold"
                      style={{ color: est.cor, backgroundColor: est.fundo }}
                    >
                      <Icon name={est.icone} size={14} />
                      {ORIGEM_LABEL[c.origem] ?? c.origem}
                    </span>
                    {c.status === 'aguardando' ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${espera.atrasado ? 'text-escarlate' : 'text-texto-fraco'}`}
                        title={`Enviado em ${dataHora(c.created_at)}`}
                      >
                        <Icon name="clock" size={14} />
                        {espera.texto}
                      </span>
                    ) : statusBadge(c.status)}
                  </div>

                  {/* Corpo: miniatura do comprovante + quem e quanto */}
                  <div className="flex items-center gap-3.5 mt-3.5">
                    <button
                      onClick={() => abrir(c)}
                      className="relative shrink-0 w-[72px] h-[88px] rounded-xl overflow-hidden bg-fundo border border-borda outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
                      aria-label={`Ver comprovante de ${c.trigrama}`}
                    >
                      {ehPdf(c.imagem_url) ? (
                        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-texto-fraco">
                          <Icon name="document" size={24} />
                          <span className="text-[11px] font-semibold">PDF</span>
                        </span>
                      ) : (
                        <img
                          src={resolverImg(c.imagem_url)}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      <span className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-noite/70 to-transparent flex items-end justify-center pb-0.5" aria-hidden="true">
                        <Icon name="eye" size={13} className="text-white" />
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="font-display text-[1.6rem] leading-none tracking-wide text-noite truncate">{c.trigrama}</div>
                      <div className="mt-1.5">
                        {c.valor ? (
                          <span className="font-display text-[2rem] leading-none tracking-wide text-dourado">{brl(c.valor)}</span>
                        ) : (
                          <span className="text-sm text-texto-fraco">Valor não informado</span>
                        )}
                      </div>
                      <div className="text-xs text-texto-fraco mt-1.5 truncate">{dataHora(c.created_at)}</div>
                    </div>
                  </div>

                  {c.observacao && (
                    <p className="mt-3 text-sm text-texto bg-fundo-elevado rounded-xl rounded-tl-sm px-3 py-2 break-words">
                      {c.observacao}
                    </p>
                  )}
                  {c.status === 'rejeitado' && c.motivo_rejeicao && (
                    <p className="mt-3 text-sm text-escarlate bg-red-50 rounded-xl px-3 py-2 break-words">
                      <span className="font-semibold">Motivo:</span> {c.motivo_rejeicao}
                    </p>
                  )}

                  <div className="mt-3 text-[11px] text-texto-fraco truncate" title={c.referencia_id}>
                    Ref. <span className="font-mono">{c.referencia_id}</span>
                  </div>
                </div>

                {/* Rodapé: ações (aguardando) ou quem revisou */}
                {c.status === 'aguardando' ? (
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-2 px-4 pb-4 pl-5">
                    <Button size="sm" variant="ghost" onClick={() => abrir(c)} aria-label="Ver comprovante" title="Ver comprovante">
                      <Icon name="eye" size={16} />
                    </Button>
                    <Button size="sm" variant="chip-danger" onClick={() => abrir(c, true)} disabled={ocupado}>
                      <Icon name="x" size={16} /> Rejeitar
                    </Button>
                    <Button size="sm" variant="success" onClick={() => aprovar(c)} disabled={ocupado}>
                      <Icon name="check" size={16} /> {ocupado ? 'Salvando...' : 'Aprovar'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 border-t border-borda px-4 pl-5 py-2.5 bg-fundo-elevado/60">
                    <span className="text-xs text-texto-fraco truncate">
                      {c.reviewed_by ? `Por ${c.reviewed_by}` : 'Revisado'}
                      {c.reviewed_at && ` · ${dataHora(c.reviewed_at)}`}
                    </span>
                    <button onClick={() => abrir(c)} className="shrink-0 text-xs font-medium text-azul hover:underline min-h-[32px]">
                      Ver
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}

      {data && totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-4" aria-label="Paginação">
          <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            <Icon name="arrow-left" size={16} /> Anterior
          </Button>
          <span className="text-sm text-texto-fraco px-2">{currentPage} de {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
            Próxima <Icon name="arrow-right" size={16} />
          </Button>
        </nav>
      )}

      <Modal
        open={!!preview}
        onClose={fechar}
        title={preview ? `${preview.trigrama} · ${ORIGEM_LABEL[preview.origem] ?? preview.origem}` : ''}
        size="lg"
      >
        {preview && (
          <>
            <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
              <div>
                <div className="font-display text-3xl leading-none tracking-wide text-dourado">
                  {preview.valor ? brl(preview.valor) : 'Valor não informado'}
                </div>
                <div className="text-xs text-texto-fraco mt-1">Enviado em {dataHora(preview.created_at)}</div>
              </div>
              {statusBadge(preview.status)}
            </div>
            {preview.observacao && <p className="text-sm text-texto-fraco italic mb-3 break-words">"{preview.observacao}"</p>}

            <div className="bg-fundo rounded-xl p-2 mb-4">
              {preview.imagem_url.endsWith('.pdf') ? (
                <a href={resolverImg(preview.imagem_url)} target="_blank" rel="noopener noreferrer" className="text-azul hover:underline inline-flex items-center gap-1.5 min-h-[40px] px-2">
                  <Icon name="document" size={16} /> Abrir PDF em nova aba
                </a>
              ) : (
                <img src={resolverImg(preview.imagem_url)} alt={`Comprovante de ${preview.trigrama}`} className="w-full max-h-[60vh] object-contain rounded-lg" />
              )}
            </div>

            {preview.status === 'aguardando' ? (
              rejeitando ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="comp-motivo" className="block text-sm font-medium mb-1.5">Motivo da rejeição</label>
                    <input
                      id="comp-motivo"
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      className={`${inputClass} min-h-[44px]`}
                      placeholder="Ex.: valor diferente do pedido"
                    />
                    <p className="text-xs text-texto-fraco mt-1">O militar verá este motivo.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="ghost" onClick={() => setRejeitando(false)} disabled={busy(`comp:${preview.id}`)}>Voltar</Button>
                    <Button variant="danger" onClick={() => rejeitar(preview)} disabled={busy(`comp:${preview.id}`)}>
                      {busy(`comp:${preview.id}`) ? 'Salvando...' : 'Confirmar rejeição'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="chip-danger" size="md" onClick={() => setRejeitando(true)} disabled={busy(`comp:${preview.id}`)}>
                    <Icon name="x" size={16} /> Rejeitar
                  </Button>
                  <Button variant="success" onClick={() => aprovar(preview)} disabled={busy(`comp:${preview.id}`)}>
                    <Icon name="check" size={16} /> {busy(`comp:${preview.id}`) ? 'Salvando...' : 'Aprovar e marcar pago'}
                  </Button>
                </div>
              )
            ) : (
              <div className="text-sm text-texto-fraco">
                Revisado por {preview.reviewed_by || '—'} em {preview.reviewed_at ? dataHora(preview.reviewed_at) : '—'}
                {preview.motivo_rejeicao && <div className="mt-1 text-escarlate">Motivo: {preview.motivo_rejeicao}</div>}
              </div>
            )}
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
