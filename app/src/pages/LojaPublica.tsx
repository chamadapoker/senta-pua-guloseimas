import { useEffect, useState } from 'react';
import { PublicLayout } from '../components/Layout';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { NomeGuerraInput } from '../components/checkout/NomeGuerraInput';
import { api } from '../services/api';
import { gerarPayloadPix } from '../services/pix';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
const PIX_EMAIL = 'sandraobregon12@gmail.com';
const WHATSAPP_RP = '5532998352670';

function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

interface Variacao {
  id: string;
  nome: string;
  tamanho?: string;
  cor?: string;
  estoque: number;
}

interface Imagem {
  id: string;
  url: string;
  ordem: number;
}

interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  disponivel: number;
  imagem_url: string | null;
  variacoes: Variacao[];
  imagens: Imagem[];
}

interface ItemCarrinho {
  produto: Produto;
  variacao: Variacao | null;
  quantidade: number;
}

export function LojaPublica() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [variacaoSelecionada, setVariacaoSelecionada] = useState<Variacao | null>(null);
  const [quantidade, setQuantidade] = useState(1);

  // Checkout state
  const [checkout, setCheckout] = useState(false);
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pedidoCriado, setPedidoCriado] = useState<{ pedido_id: string; total: number; parcelas: number } | null>(null);
  const [copiadoPix, setCopiadoPix] = useState(false);

  useEffect(() => {
    api.get<Produto[]>('/api/loja/produtos').then(setProdutos).finally(() => setLoading(false));
  }, []);

  const abrirProduto = (p: Produto) => {
    setProdutoAberto(p);
    setImgIndex(0);
    setVariacaoSelecionada(p.variacoes.length === 1 ? p.variacoes[0] : null);
    setQuantidade(1);
  };

  const adicionarAoCarrinho = () => {
    if (!produtoAberto) return;
    if (produtoAberto.variacoes.length > 0 && !variacaoSelecionada) return;

    const existing = carrinho.findIndex(
      i => i.produto.id === produtoAberto.id && i.variacao?.id === variacaoSelecionada?.id
    );

    if (existing >= 0) {
      const novo = [...carrinho];
      novo[existing].quantidade += quantidade;
      setCarrinho(novo);
    } else {
      setCarrinho([...carrinho, { produto: produtoAberto, variacao: variacaoSelecionada, quantidade }]);
    }
    setProdutoAberto(null);
  };

  const removerDoCarrinho = (index: number) => {
    setCarrinho(carrinho.filter((_, i) => i !== index));
  };

  const totalCarrinho = carrinho.reduce((acc, i) => acc + i.produto.preco * i.quantidade, 0);

  const enviarPedido = async (metodo: 'pix' | 'fiado') => {
    if (nomeGuerra.trim().length < 3) { setErro('Trigrama deve ter no minimo 3 letras'); return; }
    if (metodo === 'fiado' && !whatsapp.trim()) { setErro('Informe seu WhatsApp para fiado'); return; }

    setEnviando(true); setErro('');
    try {
      const body: Record<string, unknown> = {
        nome_guerra: nomeGuerra.trim().toUpperCase(),
        itens: carrinho.map(i => ({
          produto_id: i.produto.id,
          variacao_id: i.variacao?.id || undefined,
          quantidade: i.quantidade,
        })),
        metodo,
        parcelas: metodo === 'pix' ? parcelas : 1,
      };
      if (whatsapp.trim()) body.whatsapp = whatsapp.trim();

      const data = await api.post<{ pedido_id: string; total: number }>('/api/loja/pedidos', body);
      setPedidoCriado({ pedido_id: data.pedido_id, total: data.total, parcelas: metodo === 'pix' ? parcelas : 1 });
      setCarrinho([]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao enviar pedido');
    } finally { setEnviando(false); }
  };

  const copiarPix = async () => {
    if (!pedidoCriado) return;
    const valorParcela = Math.round((pedidoCriado.total / pedidoCriado.parcelas) * 100) / 100;
    const payload = gerarPayloadPix(valorParcela);
    await navigator.clipboard.writeText(payload);
    setCopiadoPix(true);
    setTimeout(() => setCopiadoPix(false), 3000);
  };

  const enviarComprovante = () => {
    if (!pedidoCriado) return;
    const msg = `Comprovante Loja Militar - Pedido #${pedidoCriado.pedido_id}\nValor: R$ ${pedidoCriado.total.toFixed(2)}${pedidoCriado.parcelas > 1 ? ` (${pedidoCriado.parcelas}x de R$ ${(pedidoCriado.total / pedidoCriado.parcelas).toFixed(2)})` : ''}\n\n_Anexe o comprovante do banco abaixo_`;
    window.open(`https://wa.me/${WHATSAPP_RP}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Order confirmed view
  if (pedidoCriado) {
    const valorParcela = Math.round((pedidoCriado.total / pedidoCriado.parcelas) * 100) / 100;
    return (
      <PublicLayout>
        <div className="text-center py-8 animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-5">
            <svg className="w-10 h-10 text-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl text-azul tracking-wider mb-2">PEDIDO CRIADO!</h2>
          <p className="text-texto-fraco text-sm mb-1">Total: R$ {pedidoCriado.total.toFixed(2)}</p>
          {pedidoCriado.parcelas > 1 && (
            <p className="text-azul font-medium text-sm mb-4">{pedidoCriado.parcelas}x de R$ {valorParcela.toFixed(2)}</p>
          )}

          <div className="bg-white rounded-2xl p-5 mb-4 border border-borda shadow-sm text-left">
            <p className="text-xs text-texto-fraco mb-2 uppercase tracking-wider">PIX Copia e Cola {pedidoCriado.parcelas > 1 ? `(1a parcela: R$ ${valorParcela.toFixed(2)})` : ''}</p>
            <Button variant="success" size="lg" className="w-full" onClick={copiarPix}>
              {copiadoPix ? 'PIX copiado!' : 'Copiar codigo PIX'}
            </Button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-left">
            <p className="text-sm font-medium text-amber-900 mb-1">Envie o comprovante para a RP</p>
            <p className="text-xs text-amber-700">Pagamento so e validado com comprovante oficial do banco.</p>
          </div>

          <Button variant="success" size="lg" className="w-full mb-3" onClick={enviarComprovante}>
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar comprovante no WhatsApp
            </span>
          </Button>

          <button onClick={() => { setPedidoCriado(null); setCheckout(false); }} className="text-texto-fraco text-sm underline hover:text-texto">
            Voltar a loja
          </button>
        </div>
      </PublicLayout>
    );
  }

  // Checkout view
  if (checkout) {
    return (
      <PublicLayout>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setCheckout(false)} className="text-texto-fraco hover:text-texto">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="font-display text-2xl text-azul tracking-wider">FECHAR PEDIDO</h1>
        </div>

        <div className="space-y-2 mb-4">
          {carrinho.map((item, i) => (
            <div key={i} className="bg-white rounded-xl p-3 flex items-center gap-3 border border-borda shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.produto.nome}</div>
                {item.variacao && <div className="text-xs text-texto-fraco">{item.variacao.tamanho}{item.variacao.cor ? ` - ${item.variacao.cor}` : ''}</div>}
                <div className="text-azul text-sm font-bold">R$ {(item.produto.preco * item.quantidade).toFixed(2)} ({item.quantidade}x)</div>
              </div>
              <button onClick={() => removerDoCarrinho(i)}
                className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-vermelho">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="bg-azul rounded-2xl p-5 mb-6 text-center shadow-sm">
          <div className="text-xs text-white/70 uppercase tracking-widest">Total</div>
          <div className="font-display text-2xl text-white tracking-wider mt-1">R$ {totalCarrinho.toFixed(2)}</div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Trigrama</label>
            <NomeGuerraInput value={nomeGuerra} onChange={setNomeGuerra} />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">WhatsApp <span className="text-texto-fraco/60">(obrigatorio para fiado)</span></label>
            <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
              placeholder="Ex: 62999998888"
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul" />
          </div>
        </div>

        {erro && <p className="text-vermelho text-sm mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

        <div className="space-y-3 pb-4">
          {/* PIX options */}
          <div className="bg-white rounded-xl border border-borda p-4 shadow-sm">
            <p className="text-sm font-medium mb-3">Pagar via PIX</p>
            <div className="flex gap-2 mb-3">
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setParcelas(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${parcelas === n ? 'bg-azul text-white' : 'bg-fundo text-texto-fraco border border-borda'}`}>
                  {n}x R$ {(totalCarrinho / n).toFixed(2)}
                </button>
              ))}
            </div>
            <Button variant="success" size="lg" className="w-full" onClick={() => enviarPedido('pix')} disabled={enviando}>
              {enviando ? 'Enviando...' : `Pagar PIX ${parcelas}x`}
            </Button>
          </div>

          <Button variant="outline" size="lg" className="w-full" onClick={() => enviarPedido('fiado')} disabled={enviando}>
            Anotar no Fiado
          </Button>
        </div>
      </PublicLayout>
    );
  }

  // Product list view
  return (
    <PublicLayout>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="font-display text-2xl text-azul tracking-wider">LOJA MILITAR</h1>
      </div>
      <p className="text-sm text-texto-fraco mb-5">Toque no produto para ver detalhes</p>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-borda animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="p-3 space-y-2"><div className="h-4 bg-gray-100 rounded w-3/4" /><div className="h-5 bg-gray-100 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <div className="text-center py-16 text-texto-fraco">Nenhum produto disponivel</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-28">
          {produtos.map(p => {
            const img = p.imagens?.[0] ? resolveImg(p.imagens[0].url) : resolveImg(p.imagem_url);
            return (
              <button key={p.id} onClick={() => abrirProduto(p)}
                className="bg-white rounded-2xl overflow-hidden border border-borda shadow-sm text-left transition-transform active:scale-95">
                <div className="aspect-square bg-fundo">
                  {img ? (
                    <img src={img} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-texto-fraco/30">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                  )}
                </div>
                <div className="bg-azul p-3">
                  <h3 className="font-semibold text-sm text-white truncate">{p.nome}</h3>
                  <div className="text-white/90 font-bold mt-0.5">R$ {p.preco.toFixed(2)}</div>
                  {p.variacoes.length > 0 && (
                    <p className="text-[10px] text-white/60 mt-1">{p.variacoes.filter(v => v.estoque > 0).length} opcao(oes) disponiveis</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Cart bar */}
      {carrinho.length > 0 && !produtoAberto && (
        <div className="fixed bottom-0 left-0 right-0 bg-verde shadow-lg border-t border-verde/80 z-20 animate-slide-up">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <span className="text-white text-sm font-medium">{carrinho.reduce((a, i) => a + i.quantidade, 0)} item(ns)</span>
              <span className="text-white font-display text-lg ml-3">R$ {totalCarrinho.toFixed(2)}</span>
            </div>
            <button onClick={() => setCheckout(true)}
              className="bg-white text-verde font-display text-sm tracking-wider px-5 py-2 rounded-xl">
              FECHAR PEDIDO
            </button>
          </div>
        </div>
      )}

      {/* Product detail modal */}
      <Modal open={!!produtoAberto} onClose={() => setProdutoAberto(null)} title={produtoAberto?.nome || ''}>
        {produtoAberto && (
          <div className="space-y-4">
            {/* Image carousel */}
            {(produtoAberto.imagens?.length > 0 || produtoAberto.imagem_url) && (
              <div className="relative">
                <div className="aspect-square rounded-xl overflow-hidden bg-fundo">
                  {produtoAberto.imagens?.length > 0 ? (
                    <img src={resolveImg(produtoAberto.imagens[imgIndex]?.url)!} alt={produtoAberto.nome} className="w-full h-full object-cover" />
                  ) : (
                    <img src={resolveImg(produtoAberto.imagem_url)!} alt={produtoAberto.nome} className="w-full h-full object-cover" />
                  )}
                </div>
                {produtoAberto.imagens?.length > 1 && (
                  <div className="flex justify-center gap-1.5 mt-2">
                    {produtoAberto.imagens.map((_, i) => (
                      <button key={i} onClick={() => setImgIndex(i)}
                        className={`w-2 h-2 rounded-full transition-all ${i === imgIndex ? 'bg-azul w-4' : 'bg-gray-300'}`} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="font-display text-2xl text-azul">R$ {produtoAberto.preco.toFixed(2)}</div>
              {produtoAberto.descricao && <p className="text-sm text-texto-fraco mt-1">{produtoAberto.descricao}</p>}
            </div>

            {/* Variations */}
            {produtoAberto.variacoes.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Selecione</label>
                <div className="flex flex-wrap gap-2">
                  {produtoAberto.variacoes.map(v => (
                    <button key={v.id} onClick={() => v.estoque > 0 && setVariacaoSelecionada(v)}
                      disabled={v.estoque <= 0}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        variacaoSelecionada?.id === v.id
                          ? 'bg-azul text-white border-azul'
                          : v.estoque <= 0
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                            : 'bg-white text-texto border-borda hover:border-azul'
                      }`}>
                      {v.tamanho || v.nome}{v.cor ? ` - ${v.cor}` : ''}
                      {v.estoque <= 0 && ' (esgotado)'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Qtd:</label>
              <button onClick={() => setQuantidade(Math.max(1, quantidade - 1))} className="w-9 h-9 rounded-lg bg-fundo border border-borda font-bold">-</button>
              <span className="w-8 text-center font-medium">{quantidade}</span>
              <button onClick={() => setQuantidade(quantidade + 1)} className="w-9 h-9 rounded-lg bg-fundo border border-borda font-bold">+</button>
            </div>

            <Button className="w-full" onClick={adicionarAoCarrinho}
              disabled={produtoAberto.variacoes.length > 0 && !variacaoSelecionada}>
              Adicionar R$ {(produtoAberto.preco * quantidade).toFixed(2)}
            </Button>
          </div>
        )}
      </Modal>
    </PublicLayout>
  );
}
