import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { TelaEntrada } from './TelaEntrada';

export function CadastroEscolha() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/';

  const opcoes = [
    {
      to: '/cadastro/militar',
      icon: 'user' as const,
      titulo: 'Sou do 1/10 GpAv',
      texto: 'Conta permanente para os militares do esquadrão.',
    },
    {
      to: '/cadastro/visitante',
      icon: 'users' as const,
      titulo: 'Sou visitante',
      texto: 'De outro esquadrão. Acesso por 30 dias, pagamento à vista.',
    },
  ];

  return (
    <TelaEntrada
      titulo="Criar conta"
      subtitulo="Escolha o tipo de cadastro."
      rodape={
        <p>
          Já tem conta?{' '}
          <Link to="/login" state={{ returnTo }} className="text-white font-semibold underline underline-offset-4">Entrar</Link>
        </p>
      }
    >
      <div className="space-y-3">
        {opcoes.map((o) => (
          <button
            key={o.to}
            type="button"
            onClick={() => navigate(o.to, { state: { returnTo } })}
            className="w-full flex items-center gap-4 text-left p-4 rounded-2xl border border-borda bg-white hover:border-azul hover:bg-blue-50/40 active:scale-[0.99] transition-[background-color,border-color,transform] outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
          >
            <span className="w-12 h-12 shrink-0 rounded-xl bg-noite text-white flex items-center justify-center">
              <Icon name={o.icon} size={22} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-texto">{o.titulo}</span>
              <span className="block text-sm text-texto-fraco mt-0.5">{o.texto}</span>
            </span>
            <Icon name="chevron-right" size={18} className="text-texto-fraco shrink-0" />
          </button>
        ))}
      </div>
      <p className="text-xs text-texto-fraco mt-5">
        Visitante precisa de mais tempo? Fale com o responsável pela cantina para estender o acesso.
      </p>
    </TelaEntrada>
  );
}
