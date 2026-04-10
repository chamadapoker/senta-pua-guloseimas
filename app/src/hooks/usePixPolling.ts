import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { Pedido } from '../types';

export function usePixPolling(pedidoId: string | undefined) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [pago, setPago] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!pedidoId) return;

    const poll = async () => {
      try {
        const data = await api.get<Pedido>(`/api/pedidos/${pedidoId}`);
        setPedido(data);
        if (data.status === 'pago') {
          setPago(true);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // silently retry
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pedidoId]);

  return { pedido, pago };
}
