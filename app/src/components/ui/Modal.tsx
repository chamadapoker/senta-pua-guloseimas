import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={(e) => e.target === backdropRef.current && onClose()}
    >
      <div className="bg-fundo-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto border border-borda animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-borda">
          <h2 className="font-display text-2xl text-dourado tracking-wide">{title}</h2>
          <button onClick={onClose} className="text-texto-fraco hover:text-texto text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-fundo-elevado">&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
