import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { SuccessBurst } from '../components/ui/SuccessBurst';
import { Card } from '../components/ui/Card';
import { Icon, type IconName } from '../components/ui/Icon';

const FRASES_PIX = [
  'Pagamento na hora, moral lá em cima!',
  'PIX feito, missão cumprida!',
  'Rápido no gatilho e no PIX!',
];

const FRASES_FIADO = [
  'Um Leão sempre paga suas dívidas. Já um Centauro... não sabemos!',
  'Fiado anotado! Lembre-se: a cantina não esquece... e o WhatsApp também não.',
  'Dívida registrada, militar. Um Senta Pua sempre paga o que deve!',
  'Anotado no fiado! Mas lembre-se: aqui não tem anistia.',
  'Fiado feito. A conta não prescreve, militar!',
  'Registrado! Um devedor honrado paga antes da próxima missão.',
];

const FRASES_DINHEIRO = [
  'Pagamento em dinheiro registrado! O responsável vai confirmar quando conferir.',
  'Dinheiro anotado! A confirmação sai assim que o responsável conferir o caixa.',
];

function fraseAleatoria(metodo: string): string {
  const lista = metodo === 'fiado' ? FRASES_FIADO : metodo === 'dinheiro' ? FRASES_DINHEIRO : FRASES_PIX;
  return lista[Math.floor(Math.random() * lista.length)];
}

const RESUMO: Record<string, { icon: IconName; forma: string; situacao: string; proximo: string }> = {
  pix: {
    icon: 'pix', forma: 'PIX', situacao: 'Pagamento confirmado',
    proximo: 'Se ainda não enviou, mande o comprovante do banco para a RP.',
  },
  dinheiro: {
    icon: 'cash', forma: 'Dinheiro', situacao: 'Aguardando conferência',
    proximo: 'O responsável confirma o pagamento quando conferir o caixa.',
  },
  fiado: {
    icon: 'note', forma: 'Fiado', situacao: 'Anotado na sua conta',
    proximo: 'O valor fica como débito. Pague pelo início do app quando quiser.',
  },
};

export function Obrigado() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { nome?: string; metodo?: string } | null;
  const nome = state?.nome || 'MILITAR';
  const metodo = state?.metodo || 'fiado';
  const [frase] = useState(() => fraseAleatoria(metodo));
  const r = RESUMO[metodo] ?? RESUMO.fiado;

  return (
    <AppLayout>
      {metodo !== 'fiado' && <SuccessBurst />}
      <div className="max-w-md mx-auto py-8 animate-fade-in">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-50 border border-green-200 text-verde-escuro flex items-center justify-center mb-4 animate-scale-in">
            <Icon name="check" size={32} />
          </div>
          <h1 className="font-display text-4xl text-noite tracking-wide leading-none">Pedido registrado</h1>
          <p className="font-display text-2xl text-escarlate tracking-wide mt-2">{nome}</p>
          <p className="text-texto-fraco italic px-4 text-sm leading-relaxed mt-3">"{frase}"</p>
        </div>

        <Card size="lg" className="mt-6">
          <dl className="divide-y divide-borda">
            <div className="flex items-center justify-between gap-3 pb-3">
              <dt className="text-sm text-texto-fraco">Forma de pagamento</dt>
              <dd className="flex items-center gap-1.5 font-medium"><Icon name={r.icon} size={16} /> {r.forma}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 pt-3">
              <dt className="text-sm text-texto-fraco">Situação</dt>
              <dd className="font-medium">{r.situacao}</dd>
            </div>
          </dl>
          <div className="flex items-start gap-2.5 mt-4 rounded-xl bg-fundo-elevado border border-borda p-3">
            <Icon name="info" size={18} className="text-azul mt-0.5" />
            <p className="text-sm text-texto">{r.proximo}</p>
          </div>
        </Card>

        <div className="grid gap-3 mt-5">
          <Button size="lg" className="w-full" onClick={() => navigate('/')}>Voltar ao início</Button>
          <Link to="/perfil" className="inline-flex items-center justify-center min-h-[44px] rounded-xl text-sm font-medium text-azul underline underline-offset-2">
            Ver meu extrato
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
