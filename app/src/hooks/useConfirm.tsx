import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const fechar = (valor: boolean) => {
    resolver.current?.(valor);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40" onClick={() => fechar(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {opts.title && <h3 className="font-display text-lg text-azul mb-2 tracking-wider">{opts.title}</h3>}
            <p className="text-sm text-texto-fraco mb-5 leading-relaxed">{opts.message}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => fechar(false)}
                className="py-2.5 rounded-xl text-sm font-medium bg-fundo border border-borda text-texto-fraco hover:bg-white transition-colors"
              >
                {opts.cancelText || 'Cancelar'}
              </button>
              <button
                onClick={() => fechar(true)}
                className={`py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${
                  opts.danger ? 'bg-vermelho hover:bg-red-700' : 'bg-azul hover:bg-azul-claro'
                }`}
              >
                {opts.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de ConfirmProvider');
  return ctx;
}
