import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

export function NomeGuerraInput({ id, value, onChange }: Props) {
  const [sugestoes, setSugestoes] = useState<{ id: string; nome_guerra: string }[]>([]);
  const [aberto, setAberto] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.length < 2) { setSugestoes([]); return; }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await api.get<{ id: string; nome_guerra: string }[]>(`/api/clientes/buscar?q=${encodeURIComponent(value)}`);
        setSugestoes(data);
        setAberto(data.length > 0);
      } catch { setSugestoes([]); }
    }, 300);
    return () => clearTimeout(timeoutRef.current);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        type="text" value={value}
        maxLength={3}
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={aberto && sugestoes.length > 0}
        aria-autocomplete="list"
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-ZÀ-ÚÖ]/g, '').slice(0, 3))}
        onFocus={() => sugestoes.length > 0 && setAberto(true)}
        placeholder="Ex.: HÖE"
        className="w-full bg-white border border-borda rounded-xl px-4 py-2.5 uppercase placeholder:text-gray-400 placeholder:font-body placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-azul/25 focus:border-azul tracking-[0.3em] font-display text-xl"
      />
      {aberto && sugestoes.length > 0 && (
        <ul role="listbox" className="absolute z-10 w-full bg-white border border-borda rounded-xl mt-1 shadow-lg max-h-48 overflow-y-auto">
          {sugestoes.map((s) => (
            <li key={s.id} role="option" aria-selected={false}>
              <button type="button" className="w-full text-left px-4 min-h-[44px] hover:bg-fundo font-display text-lg tracking-[0.2em] transition-colors" onClick={() => { onChange(s.nome_guerra); setAberto(false); }}>
                {s.nome_guerra}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
