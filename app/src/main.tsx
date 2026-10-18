import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErroDeTela, recarregarPorVersao } from './components/ErroDeTela';
import './index.css';

// O Vite avisa quando não consegue baixar o arquivo de uma tela (versão antiga aberta depois de um deploy):
// recarrega sozinho em vez de deixar a tela em branco
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  recarregarPorVersao();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErroDeTela>
      <App />
    </ErroDeTela>
  </StrictMode>
);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
