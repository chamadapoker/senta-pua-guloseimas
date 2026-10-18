import { useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';
import { useToast } from '../hooks/useToast';
import type { Categoria } from '../types';
import { TelaEntrada, SecaoForm, FotoOpcional, EscolhaCategoria, AceitePrivacidade, campoEntrada, rotuloEntrada } from './TelaEntrada';

export function UserCadastroVisitante() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [trigrama, setTrigrama] = useState('');
  const [saram, setSaram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [esquadraoOrigem, setEsquadraoOrigem] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { cadastrarVisitante, updateFoto, loading } = useUserAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
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
        data_nascimento: dataNascimento || null,
        aceite_lgpd: true,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar');
      return;
    }
    // Conta já criada: falha na foto não pode prender o usuário na tela de cadastro
    if (foto) {
      try {
        await updateFoto(foto);
      } catch {
        showToast('Conta criada, mas a foto não pôde ser enviada. Tente de novo no seu perfil.', 'warning');
      }
    }
    navigate(returnTo, { replace: true });
  };

  return (
    <TelaEntrada
      titulo="Cadastro de visitante"
      subtitulo="Acesso por 30 dias. Para estender, fale com o responsável pela cantina."
      largura="md"
      rodape={
        <p>
          Já tem conta?{' '}
          <Link to="/login" state={{ returnTo }} className="text-white font-semibold underline underline-offset-4">Entrar</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <SecaoForm titulo="Dados militares">
          <EscolhaCategoria valor={categoria} onChange={setCategoria} />
          <div>
            <label htmlFor="vis-esquadrao" className={rotuloEntrada}>Esquadrão de origem</label>
            <input
              id="vis-esquadrao"
              type="text"
              value={esquadraoOrigem}
              onChange={(e) => setEsquadraoOrigem(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              placeholder="Ex.: 2/5 GAV"
              className={campoEntrada}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="vis-trigrama" className={rotuloEntrada}>Trigrama</label>
              <input
                id="vis-trigrama"
                type="text"
                value={trigrama}
                onChange={(e) => setTrigrama(e.target.value.toUpperCase().replace(/[^A-ZÀ-ÚÖ]/g, '').slice(0, 3))}
                maxLength={3}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="RET"
                className={`${campoEntrada} uppercase tracking-[0.3em] font-display text-xl text-center`}
                required
              />
            </div>
            <div>
              <label htmlFor="vis-saram" className={rotuloEntrada}>SARAM</label>
              <input
                id="vis-saram"
                type="text"
                inputMode="numeric"
                value={saram}
                onChange={(e) => setSaram(e.target.value.replace(/\D/g, ''))}
                placeholder="Só números"
                className={campoEntrada}
                required
              />
            </div>
          </div>
        </SecaoForm>

        <SecaoForm titulo="Contato">
          <div>
            <label htmlFor="vis-email" className={rotuloEntrada}>E-mail</label>
            <input
              id="vis-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={campoEntrada}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="vis-whatsapp" className={rotuloEntrada}>WhatsApp com DDD</label>
            <input
              id="vis-whatsapp"
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
              placeholder="62999998888"
              className={campoEntrada}
              required
              autoComplete="tel"
            />
          </div>
          <div>
            <label htmlFor="vis-nascimento" className={rotuloEntrada}>Data de nascimento</label>
            <input
              id="vis-nascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className={campoEntrada}
              required
              autoComplete="bday"
            />
          </div>
          <FotoOpcional preview={fotoPreview} onEscolher={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto} className="hidden" />
        </SecaoForm>

        <SecaoForm titulo="Senha">
          <div>
            <label htmlFor="vis-senha" className={rotuloEntrada}>Senha</label>
            <input
              id="vis-senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              className={campoEntrada}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="vis-senha2" className={rotuloEntrada}>Confirme a senha</label>
            <input
              id="vis-senha2"
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              minLength={6}
              className={campoEntrada}
              required
              autoComplete="new-password"
            />
          </div>
          <AceitePrivacidade marcado={aceiteLgpd} onChange={setAceiteLgpd} />
        </SecaoForm>

        {erro && <p role="alert" className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading || !aceiteLgpd}>
          {loading ? 'Criando conta...' : 'Criar conta de visitante'}
        </Button>
      </form>
    </TelaEntrada>
  );
}
