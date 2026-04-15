import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { useCart } from '../hooks/useCart';
import { useUserAuth } from '../hooks/useUserAuth';
import { api } from '../services/api';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function Checkout() {
  const { itens, total, alterarQuantidade, remover, limpar } = useCart();
  const { user } = useUserAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  if (itens.length === 0) {
    navigate('/');
    return null;
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-sm mx-auto py-10 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-azul/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-azul" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl text-azul tracking-wider mb-3">IDENTIFICAÇÃO</h1>
          <p className="text-texto-fraco text-sm mb-8">Para finalizar seu pedido, entre na sua conta ou cadastre-se.</p>
          <div className="space-y-3">
            <Link to="/login" state={{ returnTo: '/checkout' }}>
              <Button size="lg" className="w-full">Entrar</Button>
            </Link>
            <Link to="/cadastro" state={{ returnTo: '/checkout' }}>
              <Button variant="outline" size="lg" className="w-full">Cadastrar</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const enviarPedido = async (metodo: 'pix' | 'fiado' | 'dinheiro') => {
    setLoading(true);
    setErro('');
    try {
      const body = {
        nome_guerra: user.trigrama,
        itens: itens.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade })),
        metodo,
        whatsapp: user.whatsapp,
      };
      const data = await api.post<{ pedido_id: string }>('/api/pedidos', body);
      limpar();
      if (metodo === 'pix') {
        navigate(`/pix/${data.pedido_id}`);
      } else {
        navigate('/obrigado', { state: { nome: user.trigrama, metodo, pedidoId: data.pedido_id } });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <BackButton className="mb-3" />
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">FECHAR PEDIDO</h1>

      {/* Militar identificado */}
      <div className="bg-white rounded-xl border border-borda p-4 mb-5 flex items-center gap-3">
        {resolveImg(user.foto_url) ? (
          <img src={resolveImg(user.foto_url)!} alt={user.trigrama} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-azul/10 flex items-center justify-center font-display text-azul text-sm">
            {user.trigrama}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{user.trigrama}</div>
          <div className="text-xs text-texto-fraco">{user.whatsapp}</div>
        </div>
        <Link to="/perfil" className="text-xs text-azul hover:underline flex-shrink-0">Editar</Link>
      </div>

      <div className="space-y-2 mb-6">
        {itens.map(({ produto, quantidade }) => (
          <div key={produto.id} className="bg-white rounded-xl p-3 flex items-center gap-3 border border-borda shadow-sm">
            {resolveImg(produto.imagem_url) ? (
              <img src={resolveImg(produto.imagem_url)!} alt={produto.nome} className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-fundo flex items-center justify-center text-xl">{produto.emoji}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{produto.nome}</div>
              <div className="text-azul text-sm font-bold">R$ {(produto.preco * quantidade).toFixed(2)}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => alterarQuantidade(produto.id, quantidade - 1)}
                disabled={quantidade <= 1}
                aria-label="Diminuir quantidade"
                className="w-9 h-9 rounded-lg bg-fundo text-base font-bold border border-borda disabled:opacity-40"
              >-</button>
              <span className="w-6 text-center font-medium text-sm" aria-live="polite">{quantidade}</span>
              <button
                onClick={() => alterarQuantidade(produto.id, quantidade + 1)}
                aria-label="Aumentar quantidade"
                className="w-9 h-9 rounded-lg bg-fundo text-base font-bold border border-borda"
              >+</button>
              <button
                onClick={() => remover(produto.id)}
                className="ml-1 w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-vermelho hover:bg-red-100 transition-colors"
                title="Remover item"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-azul rounded-2xl p-5 mb-6 text-center shadow-sm">
        <div className="text-xs text-white/70 uppercase tracking-widest">Total</div>
        <div className="font-display text-2xl sm:text-3xl text-white tracking-wider mt-1">R$ {total().toFixed(2)}</div>
      </div>

      {erro && <p className="text-vermelho text-sm mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

      <div className="space-y-3 pb-4">
        <Button variant="success" size="lg" className="w-full" onClick={() => enviarPedido('pix')} disabled={loading}>
          Pagar via PIX
        </Button>
        <Button variant="primary" size="lg" className="w-full" onClick={() => enviarPedido('dinheiro')} disabled={loading}>
          Paguei em Dinheiro
        </Button>
        {user.permite_fiado !== 0 && (
          <Button variant="outline" size="lg" className="w-full" onClick={() => enviarPedido('fiado')} disabled={loading}>
            Anotar no Fiado
          </Button>
        )}
        {user.permite_fiado === 0 && user.is_visitante === 1 && (
          <p className="text-xs text-texto-fraco text-center">
            Visitantes pagam à vista. Fiado não disponível.
          </p>
        )}
        <p className="text-[10px] text-texto-fraco text-center">
          Dinheiro: o admin confirma quando receber. PIX: envie comprovante ao terminar.
        </p>
      </div>
    </AppLayout>
  );
}
