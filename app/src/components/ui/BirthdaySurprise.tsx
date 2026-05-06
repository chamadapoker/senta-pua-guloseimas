import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';

interface BirthdaySurpriseProps {
  titulo: string;
  texto: string;
  imagemUrl: string | null;
  onClose: () => void;
}

export function BirthdaySurprise({ titulo, texto, imagemUrl, onClose }: BirthdaySurpriseProps) {
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-azul/90 backdrop-blur-md animate-fade-in">
      <Confetti width={windowSize.width} height={windowSize.height} recycle={true} numberOfPieces={200} gravity={0.1} />
      
      <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full relative animate-scale-in">
        {imagemUrl && (
          <div className="h-64 overflow-hidden relative">
            <img src={imagemUrl.startsWith('/api') ? `${import.meta.env.VITE_WORKER_URL}${imagemUrl}` : imagemUrl} alt="Aniversariante" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
          </div>
        )}
        
        <div className="p-8 text-center">
          <div className="inline-block p-3 bg-azul/10 rounded-2xl mb-4 text-azul animate-bounce">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 0 1-3 0 2.704 2.704 0 0 0-3 0 2.704 2.704 0 0 1-3 0 2.704 2.704 0 0 0-3 0 2.704 2.704 0 0 1-3 0 2.701 2.701 0 0 0-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7h18ZM12 11V7" />
            </svg>
          </div>
          
          <h2 className="font-display text-3xl text-azul mb-4 tracking-wider leading-tight">
            {titulo}
          </h2>
          
          <p className="text-texto-fraco mb-8 leading-relaxed whitespace-pre-wrap">
            {texto}
          </p>
          
          <button
            onClick={onClose}
            className="w-full bg-azul text-white py-4 rounded-2xl font-bold tracking-widest hover:bg-azul-claro transition-colors shadow-lg shadow-azul/20"
          >
            SENTA PUA! 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
