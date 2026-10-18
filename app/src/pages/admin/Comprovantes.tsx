import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useAcao } from '../../hooks/useAcao';
import { Loading } from '../../components/ui/Loading';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { inputClass } from '../../components/ui/Field';
import { formatarDataHoraBanco as dataHora } from '../../services/datas';

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

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setErro('');
    const qs = new URLSearchParams({ status: aba, limit: String(PAGE), offset: String(offset) });
    if (origem) qs.set('origem', origem);
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
  }, [aba, offset, origem, qAplicada, recarregar, showToast]);

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
      <BackButton to="/admin" className="mb-3" />
      <PageHeader title="Comprovantes de pagamento" subtitle="Confira os comprovantes enviados pelos militares e aprove para dar baixa." />

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

      <form onSubmit={buscar} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 mb-4">
        <label htmlFor="comp-q" className="sr-only">Buscar por trigrama</label>
        <input
          id="comp-q"
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por trigrama"
          className={`${inputClass} min-h-[44px]`}
        />
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
            hint={qAplicada || origem ? 'Tente limpar a busca ou trocar a origem.' : aba === 'aguardando' ? 'Quando um militar enviar um comprovante, ele aparece aqui.' : undefined}
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.items.map(c => (
            <li key={c.id} className="bg-white rounded-2xl border border-borda shadow-sm p-4 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-texto truncate">{c.trigrama}</div>
                  <div className="text-xs text-texto-fraco">{dataHora(c.created_at)}</div>
                </div>
                {statusBadge(c.status)}
              </div>

              <div className="font-display text-3xl leading-none tracking-wide text-dourado mt-3">
                {c.valor ? brl(c.valor) : <span className="text-base font-sans text-texto-fraco tracking-normal">Valor não informado</span>}
              </div>

              <dl className="text-xs text-texto-fraco mt-3 space-y-0.5">
                <div className="flex gap-1"><dt>Origem:</dt><dd className="text-texto">{ORIGEM_LABEL[c.origem] ?? c.origem}</dd></div>
                <div className="flex gap-1 min-w-0"><dt className="shrink-0">Referência:</dt><dd className="font-mono truncate" title={c.referencia_id}>{c.referencia_id}</dd></div>
              </dl>
              {c.observacao && <p className="text-sm text-texto-fraco mt-2 italic break-words">"{c.observacao}"</p>}
              {c.status === 'rejeitado' && c.motivo_rejeicao && (
                <p className="text-sm text-escarlate mt-2 break-words">Motivo: {c.motivo_rejeicao}</p>
              )}

              <div className="mt-auto pt-3">
                <Button size="sm" variant="ghost" className="w-full mt-3" onClick={() => abrir(c)}>
                  <Icon name="eye" size={16} /> Ver comprovante
                </Button>
                {c.status === 'aguardando' && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button size="sm" variant="chip-danger" onClick={() => abrir(c, true)} disabled={busy(`comp:${c.id}`)}>
                      <Icon name="x" size={16} /> Rejeitar
                    </Button>
                    <Button size="sm" variant="success" onClick={() => aprovar(c)} disabled={busy(`comp:${c.id}`)}>
                      <Icon name="check" size={16} /> {busy(`comp:${c.id}`) ? 'Salvando...' : 'Aprovar'}
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
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
