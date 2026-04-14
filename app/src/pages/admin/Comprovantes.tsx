import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../services/api';

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

export function Comprovantes() {
  const [aba, setAba] = useState<'aguardando' | 'aprovado' | 'rejeitado'>('aguardando');
  const [origem, setOrigem] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Comprovante | null>(null);
  const [motivo, setMotivo] = useState('');

  const carregar = () => {
    setLoading(true);
    const qs = new URLSearchParams({ status: aba, limit: String(PAGE), offset: String(offset) });
    if (origem) qs.set('origem', origem);
    if (q.trim()) qs.set('q', q.trim());
    api.get<Resp>(`/api/comprovantes?${qs}`).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [aba, offset, origem]);

  const trocarAba = (novo: typeof aba) => { setAba(novo); setOffset(0); };
  const buscar = (e: React.FormEvent) => { e.preventDefault(); setOffset(0); carregar(); };

  const resolverImg = (url: string) => url.startsWith('/api') ? `${WORKER_URL}${url}` : url;

  const aprovar = async (c: Comprovante) => {
    if (!confirm(`Aprovar comprovante de ${c.trigrama}? Isso marca o pagamento como PAGO.`)) return;
    await api.put(`/api/comprovantes/${c.id}/aprovar`, {});
    setPreview(null);
    carregar();
  };

  const rejeitar = async (c: Comprovante) => {
    if (!motivo.trim()) { alert('Informe o motivo da rejeição'); return; }
    await api.put(`/api/comprovantes/${c.id}/rejeitar`, { motivo });
    setPreview(null);
    setMotivo('');
    carregar();
  };

  const totalPages = data ? Math.ceil(data.total / PAGE) : 0;
  const currentPage = Math.floor(offset / PAGE) + 1;

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <h1 className="font-display text-2xl text-azul tracking-wider mb-4">COMPROVANTES</h1>

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-borda shadow-sm mb-3">
        {(['aguardando', 'aprovado', 'rejeitado'] as const).map(s => (
          <button
            key={s}
            onClick={() => trocarAba(s)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              aba === s ? 'bg-azul text-white shadow-sm' : 'text-texto-fraco'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={buscar} className="flex gap-2 mb-4 flex-wrap">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por trigrama..."
          className="flex-1 min-w-[150px] bg-white border border-borda rounded-lg px-3 py-2 text-sm"
        />
        <select value={origem} onChange={e => { setOrigem(e.target.value); setOffset(0); }} className="bg-white border border-borda rounded-lg px-3 py-2 text-sm">
          <option value="">Todas origens</option>
          <option value="cantina">Cantina</option>
          <option value="loja">Loja</option>
          <option value="loja_parcela">Loja (parcela)</option>
          <option value="cafe">Café</option>
          <option value="ximboca">Ximboca</option>
        </select>
        <button type="submit" className="px-4 py-2 rounded-lg bg-azul text-white text-sm font-medium">Buscar</button>
      </form>

      {data && (
        <div className="text-xs text-texto-fraco mb-3">
          {data.total} comprovante(s) · Página {currentPage}/{totalPages || 1}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-texto-fraco">Carregando...</div>
      ) : !data || data.items.length === 0 ? (
        <div className="bg-white rounded-xl border border-borda p-10 text-center text-texto-fraco">
          Nenhum comprovante {aba}.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.items.map(c => (
            <button
              key={c.id}
              onClick={() => { setPreview(c); setMotivo(''); }}
              className="bg-white rounded-xl border border-borda p-3 text-left hover:border-azul transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-texto">{c.trigrama}</div>
                <Badge variant={c.status === 'aprovado' ? 'success' : c.status === 'rejeitado' ? 'danger' : 'warning'}>
                  {c.status}
                </Badge>
              </div>
              <div className="text-xs text-texto-fraco mb-2">
                {ORIGEM_LABEL[c.origem]} · {new Date(c.created_at + 'Z').toLocaleString('pt-BR')}
              </div>
              {c.valor && <div className="font-display text-xl text-azul tracking-wider">R$ {c.valor.toFixed(2)}</div>}
              {c.observacao && <div className="text-xs text-texto-fraco mt-1 italic">"{c.observacao}"</div>}
            </button>
          ))}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="px-3 py-1.5 rounded-lg bg-white border border-borda text-sm disabled:opacity-40">← Anterior</button>
          <span className="text-sm text-texto-fraco">{currentPage}/{totalPages}</span>
          <button disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)} className="px-3 py-1.5 rounded-lg bg-white border border-borda text-sm disabled:opacity-40">Próxima →</button>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg text-azul">{preview.trigrama} · {ORIGEM_LABEL[preview.origem]}</h3>
              <button onClick={() => setPreview(null)} className="text-texto-fraco hover:text-vermelho text-2xl leading-none">×</button>
            </div>

            {preview.valor && <div className="font-display text-2xl text-azul mb-3">R$ {preview.valor.toFixed(2)}</div>}
            {preview.observacao && <p className="text-sm text-texto-fraco italic mb-3">"{preview.observacao}"</p>}

            <div className="bg-fundo rounded-lg p-2 mb-3">
              {preview.imagem_url.endsWith('.pdf') ? (
                <a href={resolverImg(preview.imagem_url)} target="_blank" rel="noopener noreferrer" className="text-azul hover:underline">
                  📄 Abrir PDF em nova aba
                </a>
              ) : (
                <img src={resolverImg(preview.imagem_url)} alt="Comprovante" className="w-full max-h-[60vh] object-contain rounded" />
              )}
            </div>

            {preview.status === 'aguardando' ? (
              <>
                <input
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm mb-3"
                  placeholder="Motivo (apenas se for rejeitar)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="danger" onClick={() => rejeitar(preview)}>Rejeitar</Button>
                  <Button variant="success" onClick={() => aprovar(preview)}>Aprovar e marcar PAGO</Button>
                </div>
              </>
            ) : (
              <div className="text-xs text-texto-fraco">
                Revisado por {preview.reviewed_by} em {preview.reviewed_at ? new Date(preview.reviewed_at + 'Z').toLocaleString('pt-BR') : '—'}
                {preview.motivo_rejeicao && <div className="mt-1 text-vermelho">Motivo: {preview.motivo_rejeicao}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
