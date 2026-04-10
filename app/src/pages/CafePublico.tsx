import { useEffect, useState } from 'react';
import { PublicLayout } from '../components/Layout';
import { Badge } from '../components/ui/Badge';
import { api } from '../services/api';
import { gerarPayloadPix } from '../services/pix';

interface Devedor {
  id: string;
  nome_guerra: string;
  tipo: string;
  plano: string;
  valor: number;
  meses_devendo: number;
  total_devido: number;
}

const PIX_EMAIL = 'sandraobregon12@gmail.com';

export function CafePublico() {
  const [devedores, setDevedores] = useState<Devedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiadoCodigo, setCopiadoCodigo] = useState<string | null>(null);
  const [copiadoEmail, setCopiadoEmail] = useState(false);

  useEffect(() => {
    api.get<Devedor[]>('/api/cafe/devedores').then(setDevedores).finally(() => setLoading(false));
  }, []);

  const copiarPix = async (valor: number, id: string) => {
    const payload = gerarPayloadPix(valor);
    await navigator.clipboard.writeText(payload);
    setCopiadoCodigo(id);
    setTimeout(() => setCopiadoCodigo(null), 3000);
  };

  const copiarEmail = async () => {
    await navigator.clipboard.writeText(PIX_EMAIL);
    setCopiadoEmail(true);
    setTimeout(() => setCopiadoEmail(false), 3000);
  };

  const emDia = devedores.filter(d => d.total_devido === 0);
  const devendo = devedores.filter(d => d.total_devido > 0);

  return (
    <PublicLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-2">CAIXINHA DO CAFE</h1>
      <p className="text-sm text-texto-fraco mb-6">Controle de mensalidade do cafe</p>

      {/* PIX info */}
      <div className="bg-white rounded-2xl p-5 mb-6 border border-borda shadow-sm">
        <p className="text-xs text-texto-fraco mb-3 uppercase tracking-wider text-center">Chave PIX para pagamento (e-mail)</p>
        <div className="flex items-center justify-center gap-2 bg-fundo rounded-xl py-3 px-4">
          <span className="text-sm text-azul font-medium truncate">{PIX_EMAIL}</span>
          <button onClick={copiarEmail} className="shrink-0 p-2 rounded-lg hover:bg-white transition-colors">
            {copiadoEmail ? (
              <svg className="w-4 h-4 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
          </button>
        </div>
        {copiadoEmail && <p className="text-verde text-xs mt-2 text-center">E-mail copiado!</p>}
      </div>

      {loading ? (
        <div className="text-center py-10 text-texto-fraco">Carregando...</div>
      ) : (
        <>
          {/* Devedores */}
          {devendo.length > 0 && (
            <div className="mb-6">
              <h2 className="font-display text-lg text-vermelho tracking-wider mb-3">PENDENTES</h2>
              <div className="space-y-2">
                {devendo.map((d) => (
                  <div key={d.id} className="bg-white rounded-xl p-4 border border-red-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-texto">{d.nome_guerra}</span>
                        <span className="text-xs text-texto-fraco ml-2 capitalize">{d.tipo}</span>
                      </div>
                      <Badge variant="danger">R$ {d.total_devido.toFixed(2)}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-texto-fraco">{d.meses_devendo} mes(es) pendente(s)</span>
                      <button
                        onClick={() => copiarPix(d.total_devido, d.id)}
                        className="text-xs text-azul font-medium bg-azul/10 px-3 py-1.5 rounded-lg hover:bg-azul/20 transition-colors"
                      >
                        {copiadoCodigo === d.id ? 'PIX copiado!' : 'Copiar PIX'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Em dia */}
          {emDia.length > 0 && (
            <div>
              <h2 className="font-display text-lg text-verde tracking-wider mb-3">EM DIA</h2>
              <div className="space-y-2">
                {emDia.map((d) => (
                  <div key={d.id} className="bg-white rounded-xl p-4 border border-green-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-texto">{d.nome_guerra}</span>
                        <span className="text-xs text-texto-fraco ml-2 capitalize">{d.tipo}</span>
                      </div>
                      <Badge variant="success">Em dia</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {devedores.length === 0 && (
            <div className="text-center py-10 text-texto-fraco">Nenhum assinante cadastrado</div>
          )}
        </>
      )}
    </PublicLayout>
  );
}
