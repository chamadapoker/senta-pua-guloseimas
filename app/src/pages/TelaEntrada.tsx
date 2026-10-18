import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ESQUADRAO } from '../config/esquadrao';

// Campo das telas de entrada: 16px para o iPhone não dar zoom ao focar
export const campoEntrada =
  'w-full bg-white border border-borda rounded-xl px-4 py-3 text-base text-texto placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-azul/25 focus:border-azul';

export const rotuloEntrada = 'block text-sm font-medium text-texto mb-1.5';

interface TelaEntradaProps {
  titulo: string;
  subtitulo?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode; // links abaixo do cartão (sobre o fundo escuro)
  largura?: 'sm' | 'md';
}

// Moldura das telas de entrada (login, cadastro, acesso expirado):
// fundo azul-noite em tela cheia, brasão, nome do esquadrão e o cartão branco com a faixa escarlate.
export function TelaEntrada({ titulo, subtitulo, children, rodape, largura = 'sm' }: TelaEntradaProps) {
  return (
    <div className="min-h-screen bg-noite flex flex-col items-center px-4 pt-10 pb-10 sm:pt-16">
      <Link to="/" className="flex flex-col items-center gap-3 mb-7 outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-2xl" aria-label={`${ESQUADRAO.nome}, ir para o início`}>
        <img src={ESQUADRAO.imagens.brasao_grande} alt="" width={88} height={88} className="w-[88px] h-[88px] object-contain" />
        <span className="font-display text-[2.6rem] leading-none text-white tracking-[0.08em]">{ESQUADRAO.nome}</span>
        <span className="text-sm text-noite-texto -mt-1">{ESQUADRAO.nome_completo}</span>
      </Link>

      <main className={`w-full ${largura === 'md' ? 'max-w-md' : 'max-w-sm'} bg-white rounded-2xl overflow-hidden shadow-flutua animate-fade-in`}>
        <div className="h-1.5 bg-escarlate" aria-hidden="true" />
        <div className="p-5 sm:p-6">
          <h1 className="font-display text-[1.9rem] leading-none text-noite tracking-wide">{titulo}</h1>
          {subtitulo && <p className="text-sm text-texto-fraco mt-2">{subtitulo}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </main>

      {rodape && <div className="w-full max-w-sm mt-6 text-center text-sm text-noite-texto space-y-3">{rodape}</div>}
    </div>
  );
}

// Seção curta dentro de um formulário de cadastro
export function SecaoForm({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 pt-5 first:pt-0 border-t border-borda first:border-t-0">
      <legend className="sr-only">{titulo}</legend>
      <p aria-hidden="true" className="text-[15px] font-semibold text-noite flex items-center gap-2">
        <span className="flamula-sm inline-block w-4 h-2 bg-escarlate" />
        {titulo}
      </p>
      {children}
    </fieldset>
  );
}

// Foto opcional do cadastro (círculo tocável)
export function FotoOpcional({ preview, onEscolher }: { preview: string | null; onEscolher: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onEscolher}
        aria-label={preview ? 'Trocar foto' : 'Escolher foto'}
        className="w-20 h-20 shrink-0 rounded-full bg-fundo border-2 border-dashed border-borda flex items-center justify-center overflow-hidden hover:border-azul transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
      >
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg className="w-8 h-8 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
      <div className="text-sm">
        <p className="font-medium text-texto">Foto (opcional)</p>
        <p className="text-texto-fraco text-xs mt-0.5">Ajuda a identificar você no balcão. Até 2 MB.</p>
      </div>
    </div>
  );
}

const CATEGORIAS = [
  { v: 'oficial', label: 'Oficial' },
  { v: 'graduado', label: 'Graduado/SO' },
  { v: 'praca', label: 'Praça' },
] as const;

export function EscolhaCategoria({ valor, onChange }: { valor: string; onChange: (v: 'oficial' | 'graduado' | 'praca') => void }) {
  return (
    <div role="radiogroup" aria-label="Categoria militar">
      <p className={rotuloEntrada}>Categoria</p>
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIAS.map((opt) => (
          <button
            key={opt.v}
            type="button"
            role="radio"
            aria-checked={valor === opt.v}
            onClick={() => onChange(opt.v)}
            className={`min-h-[48px] px-1 rounded-xl text-[13px] min-[380px]:text-sm leading-tight font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40
              ${valor === opt.v ? 'bg-noite text-white border-noite' : 'bg-white text-texto border-borda hover:border-azul/60'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AceitePrivacidade({ marcado, onChange }: { marcado: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-sm text-texto-fraco bg-fundo-elevado border border-borda rounded-xl p-3.5 cursor-pointer">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 shrink-0 accent-azul"
      />
      <span>
        Li e aceito a{' '}
        <Link to="/privacidade" target="_blank" className="text-azul font-medium underline underline-offset-2">
          Política de Privacidade
        </Link>
        . Autorizo o uso dos meus dados para os fins descritos.
      </span>
    </label>
  );
}
