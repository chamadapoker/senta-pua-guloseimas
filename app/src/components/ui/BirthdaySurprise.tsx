import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { ESQUADRAO } from '../../config/esquadrao';

interface BirthdaySurpriseProps {
  titulo: string;
  texto: string;
  imagemUrl: string | null;
  onClose: () => void;
}

export function BirthdaySurprise({ titulo, texto, imagemUrl, onClose }: BirthdaySurpriseProps) {
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-noite/90 backdrop-blur-sm animate-fade-in">
      <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={300} gravity={0.15} />
      
      <div role="dialog" aria-modal="true" aria-labelledby="niver-titulo" className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full relative animate-scale-in max-h-[92vh] overflow-y-auto">
        <div className="h-1.5 bg-escarlate" aria-hidden="true" />
        {imagemUrl && (
          <div className="h-56 sm:h-64 overflow-hidden relative">
            <img src={imagemUrl.startsWith('/api') ? `${import.meta.env.VITE_WORKER_URL}${imagemUrl}` : imagemUrl} alt="" className="w-full h-full object-cover" />
                      </div>
        )}
        
        <div className="p-6 sm:p-8 text-center">
          <div className="inline-block p-3 bg-noite rounded-2xl mb-4 text-white">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 0 1-3 0 2.704 2.704 0 0 0-3 0 2.704 2.704 0 0 1-3 0 2.704 2.704 0 0 0-3 0 2.704 2.704 0 0 1-3 0 2.701 2.701 0 0 0-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7h18ZM12 11V7" />
            </svg>
          </div>
          
          <h2 id="niver-titulo" className="font-display text-4xl text-noite mb-3 tracking-wide leading-none">
            {titulo}
          </h2>
          
          <p className="text-texto mb-7 leading-relaxed whitespace-pre-wrap">
            {texto}
          </p>
          
          <button
            onClick={onClose}
            autoFocus
            className="w-full min-h-[52px] bg-escarlate text-white rounded-2xl font-display text-2xl tracking-wider hover:bg-red-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-escarlate/40 focus-visible:ring-offset-2"
          >
            {ESQUADRAO.frases.saudacao}
          </button>
        </div>
      </div>
    </div>
  );
}
