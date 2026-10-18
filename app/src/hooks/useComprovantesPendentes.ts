import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '../services/api';

// Contador de comprovantes aguardando aprovação, compartilhado entre o menu e a barra mobile
// (um único polling, mesmo com os dois na tela)
const usePendentesStore = create<{ total: number; set: (n: number) => void }>((set) => ({
  total: 0,
  set: (total) => set({ total }),
}));

let assinantes = 0;
let intervalo: ReturnType<typeof setInterval> | null = null;

function buscar() {
  api.get<{ total: number }>('/api/comprovantes/pendentes/count')
    .then((r) => usePendentesStore.getState().set(r.total))
    .catch(() => {});
}

export function useComprovantesPendentes(ativo: boolean, gatilho?: string): number {
  const total = usePendentesStore((s) => s.total);

  useEffect(() => {
    if (!ativo) return;
    assinantes++;
    if (!intervalo) {
      buscar();
      intervalo = setInterval(buscar, 60000);
    }
    return () => {
      assinantes--;
      if (assinantes === 0 && intervalo) {
        clearInterval(intervalo);
        intervalo = null;
      }
    };
  }, [ativo]);

  // Atualiza ao trocar de página (ex.: depois de aprovar comprovantes)
  useEffect(() => {
    if (ativo && gatilho !== undefined) buscar();
  }, [ativo, gatilho]);

  return ativo ? total : 0;
}
