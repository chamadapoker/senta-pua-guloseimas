import { useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';
import type { Categoria } from '../types';

export function UserCadastroVisitante() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [trigrama, setTrigrama] = useState('');
  const [saram, setSaram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [esquadraoOrigem, setEsquadraoOrigem] = useState('');
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { cadastrarVisitante, updateFoto, loading } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/';

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setErro('Foto deve ter no máximo 2MB'); return; }
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!categoria) { setErro('Selecione sua categoria militar'); return; }
    if (!esquadraoOrigem.trim()) { setErro('Informe seu esquadrão de origem'); return; }
    if (!aceiteLgpd) { setErro('Você precisa aceitar a Política de Privacidade'); return; }
    if (senha.length < 6) { setErro('Senha deve ter no mínimo 6 caracteres'); return; }
    if (senha !== confirmarSenha) { setErro('Senhas não conferem'); return; }

    const trigramaClean = trigrama.trim().toUpperCase();
    if (!/^[A-ZÀ-ÚÖ]{3}$/.test(trigramaClean)) { setErro('Trigrama deve ter exatamente 3 letras'); return; }
    if (!/^\d+$/.test(saram.trim())) { setErro('SARAM deve conter apenas números'); return; }
    if (!whatsapp.trim()) { setErro('WhatsApp é obrigatório'); return; }

    try {
      await cadastrarVisitante({
        email: email.trim(),
        senha,
        trigrama: trigramaClean,
        saram: saram.trim(),
        whatsapp: whatsapp.trim(),
        categoria,
        esquadrao_origem: esquadraoOrigem.trim().toUpperCase(),
        aceite_lgpd: true,
      });
      let fotoErro = '';
      if (foto) { try { await updateFoto(foto); } catch { fotoErro = ' Foto não pôde ser enviada, você pode tentar novamente no perfil.'; } }
      if (fotoErro) setErro(fotoErro);
      else navigate(returnTo, { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-6 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-2 text-center">VISITANTE</h1>
        <p className="text-center text-xs text-texto-fraco mb-6">
          Acesso de 30 dias. Para estender, fale com o admin da cantina.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center">
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded-full bg-fundo border-2 border-dashed border-borda flex items-center justify-center overflow-hidden hover:border-azul transition-colors">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <svg className="w-8 h-8 text-texto-fraco mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-[10px] text-texto-fraco">Foto</span>
                </div>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto} className="hidden" />
            <span className="text-xs text-texto-fraco mt-1">Opcional</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Categoria Militar</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'oficial', label: 'Oficial' },
                { v: 'graduado', label: 'Graduado/SO' },
                { v: 'praca', label: 'Praça' },
              ] as const).map((opt) => (
                <button key={opt.v} type="button" onClick={() => setCategoria(opt.v)}
                  className={`py-3 px-2 rounded-xl text-sm font-medium border transition-all
                    ${categoria === opt.v
                      ? 'bg-azul text-white border-azul shadow-sm'
                      : 'bg-white text-texto-fraco border-borda hover:border-azul/50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Esquadrão de Origem</label>
            <input type="text" value={esquadraoOrigem}
              onChange={(e) => setEsquadraoOrigem(e.target.value.toUpperCase())}
              placeholder="Ex: 2/5 GAV, 1/14 GAV..."
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-texto-fraco mb-1.5">Trigrama</label>
              <input type="text" value={trigrama}
                onChange={(e) => setTrigrama(e.target.value.toUpperCase().replace(/[^A-ZÀ-ÚÖ]/g, '').slice(0, 3))}
                maxLength={3} placeholder="RET"
                className="w-full bg-white border border-borda rounded-xl px-4 py-3 uppercase tracking-widest font-display text-lg text-center focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-texto-fraco mb-1.5">SARAM</label>
              <input type="text" inputMode="numeric" value={saram}
                onChange={(e) => setSaram(e.target.value.replace(/\D/g, ''))} placeholder="Identificação"
                className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">WhatsApp</label>
            <input type="tel" value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 62999998888"
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres"
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Confirmar Senha</label>
            <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" required />
          </div>

          <label className="flex items-start gap-2 text-xs text-texto-fraco bg-fundo rounded-xl p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={aceiteLgpd}
              onChange={(e) => setAceiteLgpd(e.target.checked)}
              className="mt-0.5 accent-azul"
            />
            <span>
              Li e aceito a{' '}
              <Link to="/privacidade" target="_blank" className="text-azul font-medium hover:underline">
                Política de Privacidade
              </Link>
              . Autorizo o uso dos meus dados para os fins descritos.
            </span>
          </label>

          {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading || !aceiteLgpd}>
            {loading ? 'Cadastrando...' : 'Cadastrar como Visitante'}
          </Button>
        </form>
        <p className="text-center text-sm text-texto-fraco mt-4">
          Já tem conta? <Link to="/login" state={{ returnTo }} className="text-azul font-medium hover:underline">Entrar</Link>
        </p>
      </div>
    </AppLayout>
  );
}
