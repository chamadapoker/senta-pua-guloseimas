import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Icon } from '../../components/ui/Icon';
import { api } from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { inputClass } from '../../components/ui/Field';
import { formatarDataHoraBanco } from '../../services/datas';

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

// dados_antes/depois podem não ser JSON válido (registros antigos/truncados)
function formatarJson(txt: string): string {
  try {
    return JSON.stringify(JSON.parse(txt), null, 2);
  } catch {
    return txt;
  }
}

export function Auditoria() {
  const [data, setData] = useState<Resp | null>(null);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  // Busca aplicada (o input só vale ao clicar "Buscar") + contador para forçar recarga
  const [qAplicada, setQAplicada] = useState('');
  const [recarregar, setRecarregar] = useState(0);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (qAplicada.trim()) qs.set('q', qAplicada.trim());
    setErro('');
    api.get<Resp>(`/api/auditoria?${qs}`)
      .then(r => { if (ativo) setData(r); })
      .catch((e: any) => { if (ativo) setErro(e?.message || 'Erro ao carregar auditoria'); });
    return () => { ativo = false; };
  }, [offset, qAplicada, recarregar]);

  const buscar = (e: React.FormEvent) => { e.preventDefault(); setQAplicada(q); setOffset(0); setRecarregar(n => n + 1); };

  const totalPages = data ? Math.ceil(data.total / PAGE) : 0;
  const currentPage = Math.floor(offset / PAGE) + 1;

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <PageHeader title="Auditoria" subtitle="Histórico das ações feitas pelos administradores." />

      <form onSubmit={buscar} className="flex flex-col sm:flex-row gap-2 mb-4">
        <label htmlFor="aud-q" className="sr-only">Buscar por e-mail, ação ou ID</label>
        <input
          id="aud-q"
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por e-mail, ação ou ID"
          className={`${inputClass} sm:max-w-md min-h-[44px]`}
        />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 sm:flex-none">Buscar</Button>
          {q && <Button type="button" variant="ghost" onClick={() => { setQ(''); setQAplicada(''); setOffset(0); }}>Limpar</Button>}
        </div>
      </form>

      {data && (
        <div className="text-sm text-texto-fraco mb-3">
          {data.total} registro(s){totalPages > 1 && ` · página ${currentPage} de ${totalPages}`}
        </div>
      )}

      {erro && !data ? (
        <Card className="text-center py-8">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar a auditoria.</p>
          <p className="text-sm text-texto-fraco mt-1">{erro}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => setRecarregar(n => n + 1)}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      ) : !data ? (
        <Loading label="Carregando registros..." />
      ) : data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="book" size={26} />}
            message="Nenhum registro encontrado"
            hint={qAplicada ? 'Tente outra busca ou limpe o filtro.' : 'As ações dos administradores aparecem aqui.'}
          />
        </Card>
      ) : (
        <ul className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden divide-y divide-borda">
          {data.items.map(log => {
            const temDados = !!(log.dados_antes || log.dados_depois);
            const expandido = aberto === log.id;
            return (
              <li key={log.id}>
                <button
                  onClick={() => temDados && setAberto(expandido ? null : log.id)}
                  aria-expanded={temDados ? expandido : undefined}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 min-h-[56px] outline-none focus-visible:bg-fundo ${temDados ? 'hover:bg-fundo cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="w-9 h-9 rounded-xl bg-fundo-elevado border border-borda flex items-center justify-center text-texto-fraco shrink-0">
                    <Icon name={ACAO_ICONE[log.acao] || 'note'} size={18} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-texto first-letter:uppercase">{log.acao.replace(/_/g, ' ')}</span>
                    <span className="block text-xs text-azul truncate">{log.admin_email}</span>
                    <span className="block text-xs text-texto-fraco mt-0.5 break-words">
                      {formatarDataHoraBanco(log.created_at)} · {log.entidade}{log.entidade_id ? ` #${log.entidade_id.slice(0, 8)}` : ''}
                      {log.ip_address && <> · IP {log.ip_address}</>}
                    </span>
                  </span>
                  {temDados && (
                    <Icon name={expandido ? 'chevron-up' : 'chevron-down'} size={18} className="text-texto-fraco shrink-0 mt-2" />
                  )}
                </button>
                {expandido && temDados && (
                  <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                    {log.dados_antes && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 min-w-0">
                        <div className="font-sans font-semibold text-escarlate mb-1">Antes</div>
                        <pre className="whitespace-pre-wrap break-all">{formatarJson(log.dados_antes)}</pre>
                      </div>
                    )}
                    {log.dados_depois && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3 min-w-0">
                        <div className="font-sans font-semibold text-verde-escuro mb-1">Depois</div>
                        <pre className="whitespace-pre-wrap break-all">{formatarJson(log.dados_depois)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
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
    </AppLayout>
  );
}
