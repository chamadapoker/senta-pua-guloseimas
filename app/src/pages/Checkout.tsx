import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { NomeGuerraInput } from '../components/checkout/NomeGuerraInput';
import { useCart } from '../hooks/useCart';
import { api } from '../services/api';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function Checkout() {
  const { itens, total, alterarQuantidade, remover, limpar } = useCart();
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  if (itens.length === 0) {
    navigate('/');
    return null;
  }

  const validarTrigrama = (nome: string) => {
    const limpo = nome.trim();
    if (limpo.length < 3) return 'Trigrama deve ter no mínimo 3 letras';
    if (!/^[A-Za-zÀ-ú\s]+$/.test(limpo)) return 'Trigrama deve conter apenas letras';
    return null;
  };

  const enviarPedido = async (metodo: 'pix' | 'fiado') => {
    const erroTrigrama = validarTrigrama(nomeGuerra);
    if (erroTrigrama) { setErro(erroTrigrama); return; }

    if (metodo === 'fiado' && !whatsapp.trim()) {
      setErro('Informe seu WhatsApp para pagamento posterior');
      return;
    }

    setLoading(true);
    setErro('');
    try {
      const body: Record<string, unknown> = {
        nome_guerra: nomeGuerra.trim().toUpperCase(),
        itens: itens.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade })),
        metodo,
      };
      if (metodo === 'fiado' && whatsapp.trim()) {
        body.whatsapp = whatsapp.trim();
      }

      const data = await api.post<{ pedido_id: string; total: number; status: string }>('/api/pedidos', body);
      limpar();
      if (metodo === 'pix') {
        navigate(`/pix/${data.pedido_id}`);
      } else {
        navigate('/obrigado', { state: { nome: nomeGuerra.toUpperCase() } });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <h1 className="text-xl font-bold text-azul mb-4">Fechar Pedido</h1>

      <div className="space-y-3 mb-6">
        {itens.map(({ produto, quantidade }) => (
          <div key={produto.id} className="bg-white rounded-lg p-3 flex items-center gap-3">
            {resolveImg(produto.imagem_url) ? (
              <img src={resolveImg(produto.imagem_url)!} alt={produto.nome} className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <span className="text-2xl">{produto.emoji}</span>
            )}
            <div className="flex-1">
              <div className="font-medium text-sm">{produto.nome}</div>
              <div className="text-azul text-sm font-bold">R$ {(produto.preco * quantidade).toFixed(2)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => alterarQuantidade(produto.id, quantidade - 1)}
                className="w-8 h-8 rounded-full bg-gray-100 text-lg font-bold"
              >-</button>
              <span className="w-6 text-center font-medium">{quantidade}</span>
              <button
                onClick={() => alterarQuantidade(produto.id, quantidade + 1)}
                className="w-8 h-8 rounded-full bg-gray-100 text-lg font-bold"
              >+</button>
              <button
                onClick={() => remover(produto.id)}
                className="ml-1 text-gray-400 hover:text-vermelho text-lg"
              >&times;</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-azul text-white rounded-lg p-4 mb-6 text-center">
        <div className="text-sm opacity-80">Total</div>
        <div className="text-2xl font-bold">R$ {total().toFixed(2)}</div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Trigrama (nome de guerra)
        </label>
        <NomeGuerraInput value={nomeGuerra} onChange={setNomeGuerra} />
        <p className="text-xs text-gray-400 mt-1">Mínimo 3 letras — seu trigrama militar</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WhatsApp <span className="text-gray-400">(obrigatório para fiado)</span>
        </label>
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
          placeholder="Ex: 62999998888"
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-azul"
        />
      </div>

      {erro && <p className="text-vermelho text-sm mb-3">{erro}</p>}

      <div className="space-y-3">
        <Button variant="danger" size="lg" className="w-full" onClick={() => enviarPedido('pix')} disabled={loading}>
          Pagar via PIX
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={() => enviarPedido('fiado')} disabled={loading}>
          Anotar no Fiado
        </Button>
      </div>
    </PublicLayout>
  );
}
