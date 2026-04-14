import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';
import { api } from '../services/api';

export function AcessoExpirado() {
  const { logout } = useUserAuth();
  const [whatsapp, setWhatsapp] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Record<string, string>>('/api/config')
      .then(c => setWhatsapp(c.pix_guloseimas_whatsapp || ''))
      .catch(() => {});
  }, []);

  const abrirWhats = () => {
    if (!whatsapp) return;
    const msg = 'Olá, meu acesso de visitante expirou. Poderia renovar?';
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-16 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl text-azul tracking-wider mb-3">ACESSO EXPIRADO</h1>
        <p className="text-texto-fraco text-sm mb-8">
          Seu acesso de visitante chegou ao fim ou foi pausado pelo administrador.
          Para renovar, fale com o responsável da cantina.
        </p>
        <div className="space-y-3">
          <Button variant="success" size="lg" className="w-full" onClick={abrirWhats} disabled={!whatsapp}>
            Falar no WhatsApp
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => { logout(); navigate('/'); }}>
            Sair
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
