import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function NomeGuerraInput({ value, onChange }: Props) {
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
      } catch {
        setSugestoes([]);
      }
    }, 300);

    return () => clearTimeout(timeoutRef.current);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onFocus={() => sugestoes.length > 0 && setAberto(true)}
        placeholder="Ex: MAVERICK, ICEMAN..."
        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base uppercase focus:outline-none focus:ring-2 focus:ring-azul"
      />
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
          {sugestoes.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                onClick={() => { onChange(s.nome_guerra); setAberto(false); }}
              >
                {s.nome_guerra}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
