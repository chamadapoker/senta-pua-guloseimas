import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Icon } from '../../components/ui/Icon';
import { api } from '../../services/api';

interface Log {
  id: string;
  admin_email: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  dados_antes: string | null;
  dados_depois: string | null;
  ip_address: string | null;
  created_at: string;
}

interface Resp {
  items: Log[];
  total: number;
  limit: number;
  offset: number;
}

const ACAO_ICONE: Record<string, 'check' | 'x' | 'user' | 'trash' | 'alarm' | 'note'> = {
  aprovar_comprovante: 'check',
  rejeitar_comprovante: 'x',
  criar_admin: 'user',
  excluir_admin: 'trash',
  gerar_cobrancas_auto: 'alarm',
};

const PAGE = 50;

export function Auditoria() {
  const [data, setData] = useState<Resp | null>(null);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = () => {
    const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (q.trim()) qs.set('q', q.trim());
    api.get<Resp>(`/api/auditoria?${qs}`).then(setData);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [offset]);

  const buscar = (e: React.FormEvent) => { e.preventDefault(); setOffset(0); setTimeout(carregar, 0); };

  const totalPages = data ? Math.ceil(data.total / PAGE) : 0;
  const currentPage = Math.floor(offset / PAGE) + 1;

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <h1 className="font-display text-2xl text-azul tracking-wider mb-4">AUDITORIA</h1>

      <form onSubmit={buscar} className="flex gap-2 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por email, ação ou ID..."
          className="flex-1 bg-white border border-borda rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" className="px-4 py-2 rounded-lg bg-azul text-white text-sm font-medium">Buscar</button>
        {q && <button type="button" onClick={() => { setQ(''); setOffset(0); setTimeout(carregar, 0); }} className="px-3 py-2 rounded-lg bg-fundo border border-borda text-sm">Limpar</button>}
      </form>

      {data && (
        <div className="text-xs text-texto-fraco mb-3">
          {data.total} registros · Página {currentPage} de {totalPages || 1}
        </div>
      )}

      <div className="bg-white rounded-xl border border-borda overflow-hidden">
        {!data ? (
          <div className="text-center py-10 text-texto-fraco">Carregando...</div>
        ) : data.items.length === 0 ? (
          <div className="text-center py-10 text-texto-fraco">Nenhum log encontrado</div>
        ) : (
          <div className="list-zebra divide-y divide-borda">
            {data.items.map(log => (
              <div key={log.id} className="px-3 py-2">
                <button
                  onClick={() => setAberto(aberto === log.id ? null : log.id)}
                  className="w-full text-left flex items-center gap-2 text-sm"
                >
                  <Icon name={ACAO_ICONE[log.acao] || 'note'} size={18} className="text-texto-fraco" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-texto truncate">
                      <span className="text-azul">{log.admin_email}</span>
                      <span className="text-texto-fraco"> · {log.acao.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-[10px] text-texto-fraco">
                      {log.entidade}{log.entidade_id ? ` #${log.entidade_id.slice(0, 8)}` : ''} · {new Date(log.created_at + 'Z').toLocaleString('pt-BR')}
                      {log.ip_address && <span className="ml-2">IP: {log.ip_address}</span>}
                    </div>
                  </div>
                  <span className="text-texto-fraco">{aberto === log.id ? '▲' : '▼'}</span>
                </button>
                {aberto === log.id && (log.dados_antes || log.dados_depois) && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                    {log.dados_antes && (
                      <div className="bg-red-50 rounded p-2">
                        <div className="font-bold text-vermelho mb-1">Antes</div>
                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(JSON.parse(log.dados_antes), null, 2)}</pre>
                      </div>
                    )}
                    {log.dados_depois && (
                      <div className="bg-green-50 rounded p-2">
                        <div className="font-bold text-verde-escuro mb-1">Depois</div>
                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(JSON.parse(log.dados_depois), null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
            className="px-3 py-1.5 rounded-lg bg-white border border-borda text-sm disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-texto-fraco">{currentPage} / {totalPages}</span>
          <button
            disabled={offset + PAGE >= data.total}
            onClick={() => setOffset(offset + PAGE)}
            className="px-3 py-1.5 rounded-lg bg-white border border-borda text-sm disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}
    </AppLayout>
  );
}
