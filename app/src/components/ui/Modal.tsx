import { useEffect, useId, useRef } from 'react';
import { Icon } from './Icon';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  // onClose costuma vir inline (nova função a cada render); guardar numa ref evita
  // re-rodar o efeito a cada tecla, o que jogaria o foco de volta ao primeiro campo
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const anterior = document.activeElement as HTMLElement | null;
    // Foco no primeiro campo do modal (ou no próprio painel)
    const primeiro = painelRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-fechar])');
    (primeiro ?? painelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      anterior?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-noite/50 backdrop-blur-[2px] p-0 sm:p-4 animate-fade-in"
      onClick={(e) => e.target === backdropRef.current && onClose()}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`bg-white rounded-t-3xl sm:rounded-2xl w-full ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto shadow-2xl animate-slide-up outline-none
          pb-[env(safe-area-inset-bottom)] sm:pb-0`}
      >
        {/* Alça de arraste visual no mobile */}
        <div className="sm:hidden flex justify-center pt-2.5"><span className="w-10 h-1 rounded-full bg-borda" /></div>
        <div className="flex items-center justify-between gap-3 px-5 pt-3 sm:pt-5 pb-4 border-b border-borda sticky top-0 bg-white z-10">
          <h2 id={tituloId} className="font-display text-2xl text-noite tracking-wide leading-none">{title}</h2>
          <button
            data-fechar
            onClick={onClose}
            aria-label="Fechar"
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-texto-fraco hover:text-texto hover:bg-fundo outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
