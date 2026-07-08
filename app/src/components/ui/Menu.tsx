import { useState, useRef, useEffect } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Menu de ações (kebab ⋮). Junta as ações secundárias de uma linha/card.
 * Uso: <Menu items={[{ label: 'Editar', icon: 'pencil', onClick }, { label: 'Excluir', icon: 'trash', danger: true, onClick }]} />
 */
export function Menu({ items, label = 'Ações', align = 'right' }: { items: MenuItem[]; label?: string; align?: 'right' | 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const visiveis = items.filter(Boolean);
  if (visiveis.length === 0) return null;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-texto-fraco border border-transparent hover:bg-fundo-elevado hover:text-texto hover:border-borda transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
      >
        <Icon name="dots-vertical" size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full mt-1 z-50 min-w-[168px] bg-white border border-borda rounded-xl shadow-lg py-1 animate-scale-in ${align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}
        >
          {visiveis.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                it.danger ? 'text-vermelho hover:bg-red-50' : 'text-texto hover:bg-fundo-elevado'
              }`}
            >
              {it.icon && <Icon name={it.icon} size={15} className={it.danger ? '' : 'text-texto-fraco'} />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
