import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { useUserAuth } from '../hooks/useUserAuth';
import { getConfig } from '../services/config';
import { TelaEntrada } from './TelaEntrada';

export function AcessoExpirado() {
  const { logout } = useUserAuth();
  const [whatsapp, setWhatsapp] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getConfig()
      .then(c => setWhatsapp(c.pix_guloseimas_whatsapp || ''))
      .catch(() => {});
  }, []);

  const abrirWhats = () => {
    if (!whatsapp) return;
    const msg = 'Olá, meu acesso de visitante expirou. Poderia renovar?';
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <TelaEntrada titulo="Acesso expirado">
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-3.5 mb-5">
        <Icon name="clock" size={22} className="text-amber-700 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">
          Seu acesso de visitante chegou ao fim ou foi pausado pelo administrador. Para renovar, fale com o responsável pela cantina.
        </p>
      </div>
      <div className="space-y-3">
        <Button variant="success" size="lg" className="w-full" onClick={abrirWhats} disabled={!whatsapp}>
          Pedir renovação no WhatsApp
        </Button>
        <Button variant="ghost" size="lg" className="w-full" onClick={() => { logout(); navigate('/'); }}>
          Sair da conta
        </Button>
      </div>
    </TelaEntrada>
  );
}
