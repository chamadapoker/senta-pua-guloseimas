import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

export interface StatusItem {
  origem: 'cantina' | 'loja' | 'loja_parcela' | 'cafe' | 'ximboca';
  referencia_id: string;
  status: 'aguardando' | 'aprovado' | 'rejeitado';
  motivo_rejeicao: string | null;
  created_at: string;
}

export function useComprovantesStatus() {
  const [status, setStatus] = useState<Map<string, StatusItem>>(new Map());

  const carregar = useCallback(() => {
    api.get<StatusItem[]>('/api/comprovantes/me/status')
      .then(arr => {
        const m = new Map<string, StatusItem>();
        for (const it of arr) m.set(`${it.origem}:${it.referencia_id}`, it);
        setStatus(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const get = (origem: StatusItem['origem'], referencia_id: string) =>
    status.get(`${origem}:${referencia_id}`) || null;

  return { get, recarregar: carregar };
}
