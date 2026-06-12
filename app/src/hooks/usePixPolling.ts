import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { Pedido } from '../types';

export function usePixPolling(pedidoId: string | undefined) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!pedidoId) return;

    let tentativas = 0;
    const MAX_TENTATIVAS = 200; // ~10 min a cada 3s
    const parar = () => { if (intervalRef.current) clearInterval(intervalRef.current); };

    const poll = async () => {
      tentativas++;
      try {
        const data = await api.get<Pedido>(`/api/pedidos/${pedidoId}`);
        setPedido(data);
        if (data.status === 'pago') { setPago(true); parar(); return; }
      } catch (e: any) {
        // Pedido apagado ou sessão inválida: para de tentar e sinaliza erro.
        if (e?.status === 404 || e?.status === 401 || e?.status === 403) {
          setErro(true);
          parar();
          return;
        }
        // Erro de rede transitório: continua tentando.
      }
      if (tentativas >= MAX_TENTATIVAS) parar();
    };

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return parar;
  }, [pedidoId]);

  return { pedido, pago, erro };
}
