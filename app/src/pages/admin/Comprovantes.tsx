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

const ORIGEM_LABEL: Record<string, string> = {
  cantina: 'Cantina',
  loja: 'Loja',
  loja_parcela: 'Loja (parcela)',
  cafe: 'Café',
  ximboca: 'Ximboca',
};

export function Comprovantes() {
  const [aba, setAba] = useState<'aguardando' | 'aprovado' | 'rejeitado'>('aguardando');
  const [lista, setLista] = useState<Comprovante[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Comprovante | null>(null);
  const [motivo, setMotivo] = useState('');

  const carregar = () => {
    setLoading(true);
    api.get<Comprovante[]>(`/api/comprovantes?status=${aba}`)
      .then(setLista)
      .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [aba]);

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

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <h1 className="font-display text-2xl text-azul tracking-wider mb-4">COMPROVANTES</h1>

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-borda shadow-sm mb-5">
        {(['aguardando', 'aprovado', 'rejeitado'] as const).map(s => (
          <button
            key={s}
            onClick={() => setAba(s)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              aba === s ? 'bg-azul text-white shadow-sm' : 'text-texto-fraco'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-texto-fraco">Carregando...</div>
      ) : lista.length === 0 ? (
        <div className="bg-white rounded-xl border border-borda p-10 text-center text-texto-fraco">
          Nenhum comprovante {aba === 'aguardando' ? 'pendente' : aba}.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lista.map(c => (
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
