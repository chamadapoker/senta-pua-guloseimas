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

  if (itens.length === 0) { navigate('/'); return null; }

  const validarTrigrama = (nome: string) => {
    const limpo = nome.trim();
    if (limpo.length < 3) return 'Trigrama deve ter no mínimo 3 letras';
    if (!/^[A-Za-zÀ-ú\s]+$/.test(limpo)) return 'Trigrama deve conter apenas letras';
    return null;
  };

  const enviarPedido = async (metodo: 'pix' | 'fiado') => {
    const erroTrigrama = validarTrigrama(nomeGuerra);
    if (erroTrigrama) { setErro(erroTrigrama); return; }
    if (metodo === 'fiado' && !whatsapp.trim()) { setErro('Informe seu WhatsApp para pagamento posterior'); return; }

    setLoading(true); setErro('');
    try {
      const body: Record<string, unknown> = {
        nome_guerra: nomeGuerra.trim().toUpperCase(),
        itens: itens.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade })),
        metodo,
      };
      if (metodo === 'fiado' && whatsapp.trim()) body.whatsapp = whatsapp.trim();
      const data = await api.post<{ pedido_id: string }>('/api/pedidos', body);
      limpar();
      if (metodo === 'pix') navigate(`/pix/${data.pedido_id}`);
      else navigate('/obrigado', { state: { nome: nomeGuerra.toUpperCase() } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar pedido');
    } finally { setLoading(false); }
  };

  return (
    <PublicLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">FECHAR PEDIDO</h1>

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
              <button onClick={() => alterarQuantidade(produto.id, quantidade - 1)} className="w-7 h-7 rounded-lg bg-fundo text-sm font-bold border border-borda">-</button>
              <span className="w-6 text-center font-medium text-sm">{quantidade}</span>
              <button onClick={() => alterarQuantidade(produto.id, quantidade + 1)} className="w-7 h-7 rounded-lg bg-fundo text-sm font-bold border border-borda">+</button>
              <button onClick={() => remover(produto.id)} className="ml-1 text-gray-400 hover:text-vermelho text-lg">&times;</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-azul rounded-2xl p-5 mb-6 text-center shadow-sm">
        <div className="text-xs text-white/70 uppercase tracking-widest">Total</div>
        <div className="font-display text-3xl text-white tracking-wider mt-1">R$ {total().toFixed(2)}</div>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-texto-fraco mb-1.5">Trigrama (nome de guerra)</label>
          <NomeGuerraInput value={nomeGuerra} onChange={setNomeGuerra} />
          <p className="text-xs text-texto-fraco mt-1">Mínimo 3 letras — seu trigrama militar</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-texto-fraco mb-1.5">
            WhatsApp <span className="text-texto-fraco/60">(obrigatório para fiado)</span>
          </label>
          <input
            type="tel" value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
            placeholder="Ex: 62999998888"
            className="w-full bg-white border border-borda rounded-xl px-4 py-3 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
          />
        </div>
      </div>

      {erro && <p className="text-vermelho text-sm mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

      <div className="space-y-3 pb-4">
        <Button variant="success" size="lg" className="w-full" onClick={() => enviarPedido('pix')} disabled={loading}>
          Pagar via PIX
        </Button>
        <Button variant="outline" size="lg" className="w-full" onClick={() => enviarPedido('fiado')} disabled={loading}>
          Anotar no Fiado
        </Button>
      </div>
    </PublicLayout>
  );
}
