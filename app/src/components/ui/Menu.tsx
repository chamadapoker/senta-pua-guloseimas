import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

type Item = MenuItem | false | null | undefined;

/**
 * Menu de ações (kebab ⋮). Junta as ações secundárias de uma linha/card.
 * Abre via portal (posição fixa) para não ser cortado por containers com overflow-hidden.
 * Itens falsy são ignorados — dá pra passar `cond && { ... }`.
 */
export function Menu({ items, label = 'Ações' }: { items: Item[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visiveis = items.filter(Boolean) as MenuItem[];

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = 180;
    setPos({ top: r.bottom + 6, left: Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (visiveis.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="p-1.5 rounded-lg text-texto-fraco border border-transparent hover:bg-fundo-elevado hover:text-texto hover:border-borda transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
      >
        <Icon name="dots-vertical" size={18} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 180 }}
          className="z-[120] bg-white border border-borda rounded-xl shadow-lg py-1 animate-scale-in origin-top-right"
        >
          {visiveis.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick(); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                it.danger ? 'text-vermelho hover:bg-red-50' : 'text-texto hover:bg-fundo-elevado'
              }`}
            >
              {it.icon && <Icon name={it.icon} size={15} className={it.danger ? '' : 'text-texto-fraco'} />}
              {it.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
