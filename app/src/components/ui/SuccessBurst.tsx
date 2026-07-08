import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';

/**
 * Rajada de confete de sucesso — dispara uma vez e some sozinha.
 * Uso: renderize condicionalmente quando uma ação der certo (pedido, ingresso, pagamento).
 * Cores do esquadrão (azul, dourado, verde, vermelho).
 */
export function SuccessBurst({ pieces = 180, duration = 3500 }: { pieces?: number; duration?: number }) {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    const t = setTimeout(() => setAtivo(false), duration);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, [duration]);

  if (!ativo) return null;

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none" aria-hidden="true">
      <Confetti
        width={size.width}
        height={size.height}
        recycle={false}
        numberOfPieces={pieces}
        gravity={0.2}
        colors={['#1d3fa0', '#2b52c4', '#d4a843', '#16a34a', '#d42b2b']}
      />
    </div>
  );
}
