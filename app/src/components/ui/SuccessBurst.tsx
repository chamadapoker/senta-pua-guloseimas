import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { ESQUADRAO } from '../../config/esquadrao';

/**
 * Rajada de confete de sucesso — dispara uma vez e some sozinha.
 * Uso: renderize condicionalmente quando uma ação der certo (pedido, ingresso, pagamento).
 * Cores do brasão (azul-noite, faixa, destaque) com um toque de dourado. Respeita redução de movimento.
 */
export function SuccessBurst({ pieces = 180, duration = 3500 }: { pieces?: number; duration?: number }) {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  // Quem pediu menos movimento não recebe confete
  const [ativo, setAtivo] = useState(() => {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
  });

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
        colors={[ESQUADRAO.cores.noite, ESQUADRAO.cores.faixa, ESQUADRAO.cores.destaque, '#d4a843', '#ffffff']}
      />
    </div>
  );
}
