import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
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
  pagamento_ids?: string[];
}

type Sala = null | 'oficial' | 'graduado';

export function CafePublico() {
  const [searchParams] = useSearchParams();
  const salaParam = searchParams.get('sala');
  const [sala, setSala] = useState<Sala>(salaParam === 'oficial' || salaParam === 'graduado' ? salaParam : null);
  const [devedores, setDevedores] = useState<Devedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiadoCodigo, setCopiadoCodigo] = useState<string | null>(null);
  const [copiadoChave, setCopiadoChave] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [nomes, setNomes] = useState({ nome_cafe_oficiais: 'Sala dos Oficiais', nome_cafe_graduados: 'Sala do Lange' });
  const [pixPorSala, setPixPorSala] = useState({
    oficial: { chave: '', nome: '', whatsapp: '' },
    graduado: { chave: '', nome: '', whatsapp: '' },
  });

  const carregar = () => {
    api.get<Devedor[]>('/api/cafe/devedores').then(setDevedores).finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
    api.get<Record<string, string>>('/api/config').then((c) => {
      setNomes((n) => ({ ...n, ...c }));
      setPixPorSala({
        oficial: { chave: c.pix_cafe_oficial_chave || '', nome: c.pix_cafe_oficial_nome || '', whatsapp: c.pix_cafe_oficial_whatsapp || '' },
        graduado: { chave: c.pix_cafe_graduado_chave || '', nome: c.pix_cafe_graduado_nome || '', whatsapp: c.pix_cafe_graduado_whatsapp || '' },
      });
    }).catch(() => {});
  }, []);

  const pixInfo = sala ? pixPorSala[sala] : null;

  const copiarPix = async (valor: number, id: string) => {
    if (!pixInfo) return;
    const payload = gerarPayloadPix(valor, { chave: pixInfo.chave, nome: pixInfo.nome });
    await navigator.clipboard.writeText(payload);
    setCopiadoCodigo(id);
    setTimeout(() => setCopiadoCodigo(null), 3000);
  };

  const copiarChave = async () => {
    if (!pixInfo) return;
    await navigator.clipboard.writeText(pixInfo.chave);
    setCopiadoChave(true);
    setTimeout(() => setCopiadoChave(false), 3000);
  };

  const jaPaguei = async (d: Devedor) => {
    setConfirmando(d.id);
    if (d.pagamento_ids?.length) {
      for (const pid of d.pagamento_ids) {
        try {
          await api.put(`/api/cafe/pagamentos/${pid}/confirmar`, {});
        } catch { /* admin confirma depois */ }
      }
    }
    setConfirmando(null);
    setConfirmado(d.id);
  };

  const enviarComprovante = (d: Devedor) => {
    if (!pixInfo) return;
    const msg = `Comprovante Caixinha do Cafe\nMilitar: ${d.nome_guerra}\nValor: R$ ${d.total_devido.toFixed(2)}\n\n_Anexe o comprovante do banco abaixo_`;
    window.open(`https://wa.me/${pixInfo.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filtrados = devedores.filter(d => d.tipo === sala);
  const emDia = filtrados.filter(d => d.total_devido === 0);
  const devendo = filtrados.filter(d => d.total_devido > 0);

  if (!sala) {
    return (
      <PublicLayout>
        <div className="py-6 animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl text-azul tracking-wider mb-2">CAIXINHA DO CAFE</h1>
            <p className="text-sm text-texto-fraco">Escolha sua sala</p>
          </div>

          <div className="space-y-4 max-w-sm mx-auto">
            <button
              onClick={() => setSala('oficial')}
              className="group w-full bg-white rounded-2xl p-5 border border-borda hover:border-azul shadow-sm transition-all duration-300 text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <img src="/sabre.png" alt="" className="w-10 h-10 object-contain" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg text-azul tracking-wide uppercase">{nomes.nome_cafe_oficiais}</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-azul group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </button>

            <button
              onClick={() => setSala('graduado')}
              className="group w-full bg-white rounded-2xl p-5 border border-borda hover:border-vermelho shadow-sm transition-all duration-300 text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-azul/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <img src="/sabre.png" alt="" className="w-10 h-10 object-contain" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg text-vermelho tracking-wide uppercase">{nomes.nome_cafe_graduados}</h2>
                </div>
                <span className="text-texto-fraco group-hover:text-vermelho group-hover:translate-x-1 transition-all">&rarr;</span>
              </div>
            </button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setSala(null)} className="text-texto-fraco hover:text-texto transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="font-display text-2xl text-azul tracking-wider uppercase">
          {sala === 'oficial' ? nomes.nome_cafe_oficiais : nomes.nome_cafe_graduados}
        </h1>
      </div>
      <p className="text-sm text-texto-fraco mb-6">Caixinha do Cafe</p>

      {/* PIX info */}
      <div className="bg-white rounded-2xl p-5 mb-6 border border-borda shadow-sm">
        <p className="text-xs text-texto-fraco mb-1 uppercase tracking-wider text-center">Chave PIX para pagamento (e-mail)</p>
        <p className="text-[10px] text-texto-fraco mb-3 text-center">{pixInfo?.nome}</p>
        <div className="flex items-center justify-center gap-2 bg-fundo rounded-xl py-3 px-4">
          <span className="text-sm text-azul font-medium truncate">{pixInfo?.chave}</span>
          <button onClick={copiarChave} className="shrink-0 p-2 rounded-lg hover:bg-white transition-colors">
            {copiadoChave ? (
              <svg className="w-4 h-4 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
          </button>
        </div>
        {copiadoChave && <p className="text-verde text-xs mt-2 text-center">E-mail copiado!</p>}
      </div>

      {loading ? (
        <div className="text-center py-10 text-texto-fraco">Carregando...</div>
      ) : (
        <>
          {/* Devedores */}
          {devendo.length > 0 && (
            <div className="mb-6">
              <h2 className="font-display text-lg text-vermelho tracking-wider mb-3">PENDENTES</h2>
              <div className="space-y-3">
                {devendo.map((d) => (
                  <div key={d.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${d.plano === 'anual' ? 'border-amber-400 ring-1 ring-amber-300' : 'border-red-200'}`}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium text-texto">{d.nome_guerra}</span>
                          {d.plano === 'anual' ? (
                            <span className="ml-2 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold">VIP ANUAL</span>
                          ) : (
                            <span className="text-xs text-texto-fraco ml-2 capitalize">{d.tipo}</span>
                          )}
                        </div>
                        <Badge variant="danger">R$ {d.total_devido.toFixed(2)}</Badge>
                      </div>
                      <p className="text-xs text-texto-fraco mb-3">{d.meses_devendo} mes(es) pendente(s)</p>

                      {confirmado === d.id ? (
                        <div className="space-y-3 animate-fade-in">
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                            <svg className="w-6 h-6 text-verde mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            <p className="text-sm font-medium text-green-800">Pagamento registrado!</p>
                          </div>

                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs text-amber-800 font-medium">Envie o comprovante oficial do banco para validar o pagamento.</p>
                          </div>

                          <Button variant="success" size="lg" className="w-full" onClick={() => enviarComprovante(d)}>
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              Enviar comprovante no WhatsApp
                            </span>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => copiarPix(d.total_devido, d.id)}
                            className="flex-1 text-xs text-azul font-medium bg-azul/10 px-3 py-2 rounded-lg hover:bg-azul/20 transition-colors text-center"
                          >
                            {copiadoCodigo === d.id ? 'PIX copiado!' : 'Copiar PIX'}
                          </button>
                          <button
                            onClick={() => jaPaguei(d)}
                            disabled={confirmando === d.id}
                            className="flex-1 text-xs text-white font-medium bg-verde px-3 py-2 rounded-lg hover:bg-verde/90 transition-colors text-center disabled:opacity-50"
                          >
                            {confirmando === d.id ? 'Confirmando...' : 'Ja Paguei'}
                          </button>
                        </div>
                      )}
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
                  <div key={d.id} className={`bg-white rounded-xl p-4 border shadow-sm ${d.plano === 'anual' ? 'border-amber-400 ring-1 ring-amber-300' : 'border-green-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-texto">{d.nome_guerra}</span>
                        {d.plano === 'anual' && (
                          <span className="ml-2 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold">VIP ANUAL</span>
                        )}
                      </div>
                      <Badge variant="success">{d.plano === 'anual' ? `Pago ate Dez/${new Date().getFullYear()}` : 'Em dia'}</Badge>
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
