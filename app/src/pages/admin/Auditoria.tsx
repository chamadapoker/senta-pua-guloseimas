import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
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

const ACAO_ICONE: Record<string, string> = {
  aprovar_comprovante: '✅',
  rejeitar_comprovante: '❌',
  criar_admin: '👤',
  excluir_admin: '🗑️',
  gerar_cobrancas_auto: '⏰',
};

export function Auditoria() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    api.get<Log[]>('/api/auditoria?limit=200').then(setLogs);
  }, []);

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <h1 className="font-display text-2xl text-azul tracking-wider mb-4">AUDITORIA</h1>
      <p className="text-xs text-texto-fraco mb-4">Últimas 200 ações administrativas registradas</p>

      <div className="bg-white rounded-xl border border-borda overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-10 text-texto-fraco">Nenhum log ainda</div>
        ) : (
          <div className="list-zebra divide-y divide-borda">
            {logs.map(log => (
              <div key={log.id} className="px-3 py-2">
                <button
                  onClick={() => setAberto(aberto === log.id ? null : log.id)}
                  className="w-full text-left flex items-center gap-2 text-sm"
                >
                  <span className="text-lg">{ACAO_ICONE[log.acao] || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-texto truncate">
                      <span className="text-azul">{log.admin_email}</span>
                      <span className="text-texto-fraco"> · {log.acao.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-[10px] text-texto-fraco">
                      {log.entidade}{log.entidade_id ? ` #${log.entidade_id.slice(0, 8)}` : ''} · {new Date(log.created_at + 'Z').toLocaleString('pt-BR')}
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
    </AppLayout>
  );
}
