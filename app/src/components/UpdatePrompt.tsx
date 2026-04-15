import { useEffect, useState } from 'react';

export function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      if (reg.waiting) setWaitingWorker(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(installing);
          }
        });
      });

      // Checa por atualizacoes a cada 30 min e tambem quando a aba volta a ser visivel
      const interval = setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      const onVis = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', onVis);
      return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
    });

    // Recarrega quando o SW novo assumir o controle
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  if (!waitingWorker) return null;

  const atualizar = () => {
    waitingWorker.postMessage('SKIP_WAITING');
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[60] bg-azul text-white rounded-2xl shadow-2xl p-4 border border-azul-claro/30 animate-fade-in">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm mb-0.5">Nova versão disponível</div>
          <div className="text-xs text-white/80 mb-3">Atualize para ter as últimas melhorias.</div>
          <button
            onClick={atualizar}
            className="w-full bg-white text-azul text-sm font-medium py-2 rounded-lg hover:bg-fundo transition-colors"
          >
            Atualizar agora
          </button>
        </div>
      </div>
    </div>
  );
}
