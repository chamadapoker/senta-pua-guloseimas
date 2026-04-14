import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import { gerarPayloadPix } from '../services/pix';
import { useUserAuth } from '../hooks/useUserAuth';

type Sala = 'oficial' | 'graduado' | null;

export function CafePublico() {
  const [searchParams] = useSearchParams();
  const { user } = useUserAuth();

  const userSala: Sala = user?.sala_cafe === 'oficiais' ? 'oficial'
    : user?.sala_cafe === 'graduados' ? 'graduado'
    : null;

  const salaParam = searchParams.get('sala');
  const salaInicial: Sala = userSala
    || (salaParam === 'oficial' || salaParam === 'graduado' ? salaParam : null);

  const [sala, setSala] = useState<Sala>(salaInicial);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [copiadoChave, setCopiadoChave] = useState(false);
  const [copiadoCodigo, setCopiadoCodigo] = useState(false);

  useEffect(() => {
    api.get<Record<string, string>>('/api/config').then(setConfig).catch(() => {});
  }, []);

  // Praca logado sem sala
  if (user && !user.sala_cafe) {
    return (
      <AppLayout>
        <div className="max-w-sm mx-auto py-16 text-center animate-fade-in">
          <h1 className="font-display text-2xl text-azul tracking-wider mb-3">SEM CAIXINHA</h1>
          <p className="text-texto-fraco text-sm mb-8">Praças não participam de caixinha do café.</p>
          <Link to="/" className="text-azul font-medium hover:underline">Voltar</Link>
        </div>
      </AppLayout>
    );
  }

  if (!sala) {
    return (
      <AppLayout>
        <div className="py-6 animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl text-azul tracking-wider mb-2">CAIXINHA DO CAFÉ</h1>
            <p className="text-sm text-texto-fraco">Escolha sua cantina</p>
          </div>
          <div className="space-y-4 max-w-sm mx-auto">
            <button onClick={() => setSala('oficial')}
              className="w-full bg-white rounded-2xl p-5 border border-borda hover:border-azul shadow-sm transition-all text-left">
              <h2 className="font-display text-lg text-azul tracking-wide uppercase">Cantina dos Oficiais</h2>
            </button>
            <button onClick={() => setSala('graduado')}
              className="w-full bg-white rounded-2xl p-5 border border-borda hover:border-vermelho shadow-sm transition-all text-left">
              <h2 className="font-display text-lg text-vermelho tracking-wide uppercase">Cantina dos Graduados</h2>
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const chave = config[sala === 'oficial' ? 'pix_cafe_oficial_chave' : 'pix_cafe_graduado_chave'] || '';
  const nome = config[sala === 'oficial' ? 'pix_cafe_oficial_nome' : 'pix_cafe_graduado_nome'] || '';
  const whatsapp = config[sala === 'oficial' ? 'pix_cafe_oficial_whatsapp' : 'pix_cafe_graduado_whatsapp'] || '';
  const valorStr = config[sala === 'oficial' ? 'cafe_visitante_oficial_valor' : 'cafe_visitante_graduado_valor'] || '20.00';
  const valor = parseFloat(valorStr) || 20;
  const nomeCantina = sala === 'oficial' ? 'Cantina dos Oficiais' : 'Cantina dos Graduados';

  const copiarPix = async () => {
    if (!chave) return;
    const payload = gerarPayloadPix(valor, { chave, nome });
    await navigator.clipboard.writeText(payload);
    setCopiadoCodigo(true);
    setTimeout(() => setCopiadoCodigo(false), 3000);
  };

  const copiarChave = async () => {
    if (!chave) return;
    await navigator.clipboard.writeText(chave);
    setCopiadoChave(true);
    setTimeout(() => setCopiadoChave(false), 3000);
  };

  const enviarComprovante = () => {
    if (!whatsapp) return;
    const msg = `Comprovante Caixinha do Café\n${nomeCantina}\nValor: R$ ${valor.toFixed(2)}\n\n_Anexe o comprovante abaixo_`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          {!userSala && (
            <button onClick={() => setSala(null)} className="text-texto-fraco hover:text-texto">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <h1 className="font-display text-xl text-azul tracking-wider uppercase">Caixinha do Café</h1>
        </div>
        <p className="text-sm text-texto-fraco mb-6">{nomeCantina}</p>

        <div className="bg-azul rounded-2xl p-6 mb-4 text-center text-white shadow-sm">
          <div className="text-xs opacity-70 uppercase tracking-widest">Valor mensal</div>
          <div className="font-display text-4xl tracking-wider mt-1">R$ {valor.toFixed(2)}</div>
        </div>

        <div className="bg-white rounded-2xl p-5 mb-4 border border-borda shadow-sm">
          <p className="text-xs text-texto-fraco mb-1 uppercase tracking-wider text-center">Chave PIX</p>
          <p className="text-[10px] text-texto-fraco mb-3 text-center">{nome}</p>
          <div className="flex items-center justify-center gap-2 bg-fundo rounded-xl py-3 px-4">
            <span className="text-sm text-azul font-medium truncate">{chave}</span>
            <button onClick={copiarChave} className="shrink-0 p-2 rounded-lg hover:bg-white transition-colors">
              {copiadoChave ? (
                <svg className="w-4 h-4 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-4 h-4 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              )}
            </button>
          </div>
          {copiadoChave && <p className="text-verde text-xs mt-2 text-center">Chave copiada!</p>}
        </div>

        <div className="space-y-3">
          <Button variant="primary" size="lg" className="w-full" onClick={copiarPix}>
            {copiadoCodigo ? 'PIX copiado!' : 'Copiar código PIX'}
          </Button>
          <Button variant="success" size="lg" className="w-full" onClick={enviarComprovante}>
            Enviar comprovante (WhatsApp)
          </Button>
        </div>

        <p className="text-center text-xs text-texto-fraco mt-6">
          Após pagar, envie o comprovante pelo botão acima.
        </p>
      </div>
    </AppLayout>
  );
}
