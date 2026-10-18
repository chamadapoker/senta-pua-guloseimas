import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { NomeGuerraInput } from '../components/checkout/NomeGuerraInput';
import { api } from '../services/api';
import { getConfig } from '../services/config';
import { EmptyState } from '../components/ui/EmptyState';
import { gerarPayloadPix } from '../services/pix';
import { useCopiar } from '../hooks/useCopiar';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const GRADE = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3';

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
  const [erroCarga, setErroCarga] = useState(false);
  const { copiar, modalCopiaManual } = useCopiar();
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [variacaoSelecionada, setVariacaoSelecionada] = useState<Variacao | null>(null);
  const [quantidade, setQuantidade] = useState(1);

  // Checkout state
  const [checkout, setCheckout] = useState(false);
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [visitante, setVisitante] = useState(false);
  const [esquadraoOrigem, setEsquadraoOrigem] = useState('');
  const [parcelas, setParcelas] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pedidoCriado, setPedidoCriado] = useState<{ pedido_id: string; total: number; parcelas: number } | null>(null);
  const [copiadoPix, setCopiadoPix] = useState(false);
  const [maxParcelas, setMaxParcelas] = useState(1);
  const [pixConfig, setPixConfig] = useState({ chave: '', nome: '', cidade: '', whatsapp: '' });
  const [entregaTipo, setEntregaTipo] = useState<'retirada' | 'envio'>('retirada');
  const [endereco, setEndereco] = useState('');
  const [freteConfig, setFreteConfig] = useState(0);

  const carregarProdutos = () => {
    setLoading(true);
    setErroCarga(false);
    api.get<Produto[]>('/api/loja/produtos')
      .then(setProdutos)
      .catch(() => setErroCarga(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregarProdutos();
    getConfig().then(c => {
      const max = parseInt(c.loja_max_parcelas) || 1;
      setMaxParcelas(Math.min(Math.max(max, 1), 3));
      setPixConfig({
        chave: c.pix_guloseimas_chave || '',
        nome: c.pix_guloseimas_nome || '',
        cidade: c.pix_guloseimas_cidade || 'ANAPOLIS',
        whatsapp: c.pix_guloseimas_whatsapp || '',
      });
      setFreteConfig(parseFloat(c.loja_frete || '0') || 0);
    }).catch(() => {});
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

  // Callback estável para o Modal (ele refaz o foco quando onClose muda)
  const fecharProduto = useCallback(() => setProdutoAberto(null), []);

  const removerDoCarrinho = (index: number) => {
    setCarrinho(carrinho.filter((_, i) => i !== index));
  };

  const totalCarrinho = carrinho.reduce((acc, i) => acc + i.produto.preco * i.quantidade, 0);
  const totalFinal = totalCarrinho + (entregaTipo === 'envio' ? freteConfig : 0);

  const enviarPedido = async () => {
    const metodo = 'pix' as const;
    if (!/^[A-ZÀ-ÚÖ]{3}$/.test(nomeGuerra.trim())) { setErro('Trigrama deve ter exatamente 3 letras'); return; }
    if (!whatsapp.trim()) { setErro('WhatsApp obrigatório'); return; }
    if (visitante && !esquadraoOrigem.trim()) { setErro('Informe seu esquadrão de origem'); return; }
    if (entregaTipo === 'envio' && !endereco.trim()) { setErro('Informe o endereço completo para envio'); return; }

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
        entrega_tipo: entregaTipo,
      };
      if (whatsapp.trim()) body.whatsapp = whatsapp.trim();
      if (visitante) {
        body.visitante = true;
        body.esquadrao_origem = esquadraoOrigem.trim().toUpperCase();
      }
      if (entregaTipo === 'envio') body.endereco = endereco.trim();

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
    if (!pixConfig.chave) return;
    const payload = gerarPayloadPix(valorParcela, { chave: pixConfig.chave, nome: pixConfig.nome, cidade: pixConfig.cidade });
    if (!(await copiar(payload))) return;
    setCopiadoPix(true);
    setTimeout(() => setCopiadoPix(false), 3000);
  };

  const enviarComprovante = () => {
    if (!pedidoCriado) return;
    const msg = `Comprovante Loja - Pedido #${pedidoCriado.pedido_id}\nValor: R$ ${pedidoCriado.total.toFixed(2)}${pedidoCriado.parcelas > 1 ? ` (${pedidoCriado.parcelas}x de R$ ${(pedidoCriado.total / pedidoCriado.parcelas).toFixed(2)})` : ''}\n\n_Anexe o comprovante do banco abaixo_`;
    window.open(`https://wa.me/${pixConfig.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Pedido criado: pagar a 1ª parcela no PIX
  if (pedidoCriado) {
    const valorParcela = Math.round((pedidoCriado.total / pedidoCriado.parcelas) * 100) / 100;
    return (
      <AppLayout>
        <div className="max-w-md mx-auto py-6 animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-50 border border-green-200 text-verde-escuro flex items-center justify-center mb-4">
              <Icon name="check" size={32} />
            </div>
            <h1 className="font-display text-4xl text-noite tracking-wide leading-none">Pedido criado</h1>
            <p className="text-sm text-texto-fraco mt-2">Agora é só pagar no PIX e enviar o comprovante.</p>
          </div>

          <Card size="lg" className="mt-6 text-center">
            <p className="text-sm text-texto-fraco">{pedidoCriado.parcelas > 1 ? `1ª de ${pedidoCriado.parcelas} parcelas` : 'Valor a pagar'}</p>
            <p className="font-display text-5xl leading-none tracking-wide text-noite mt-1">{brl(pedidoCriado.parcelas > 1 ? valorParcela : pedidoCriado.total)}</p>
            {pedidoCriado.parcelas > 1 && (
              <p className="text-sm text-texto-fraco mt-1.5">Total do pedido: {brl(pedidoCriado.total)}</p>
            )}
            <Button variant="success" size="lg" className="w-full mt-5 min-h-[56px]" onClick={copiarPix} disabled={!pixConfig.chave}>
              {!pixConfig.chave ? 'Carregando dados do PIX...' : copiadoPix ? <><Icon name="check" size={20} /> Código copiado</> : <><Icon name="document" size={20} /> Copiar código PIX</>}
            </Button>
          </Card>

          <ol className="mt-5 space-y-3">
            {[
              'Abra o app do seu banco e escolha "PIX copia e cola".',
              'Cole o código e confirme o pagamento.',
              'Volte aqui e envie o comprovante para a RP.',
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 shrink-0 rounded-full bg-noite text-white font-display text-base flex items-center justify-center">{i + 1}</span>
                <span className="text-[15px] text-texto pt-0.5">{t}</span>
              </li>
            ))}
          </ol>

          <Button variant="primary" size="lg" className="w-full mt-5" onClick={enviarComprovante}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Enviar comprovante no WhatsApp
          </Button>
          <p className="text-xs text-texto-fraco text-center mt-2">O pagamento só é validado com o comprovante oficial do banco.</p>

          <div className="text-center mt-4">
            <button onClick={() => { setPedidoCriado(null); setCheckout(false); }} className="min-h-[44px] px-3 text-texto-fraco text-sm underline hover:text-texto">
              Voltar à loja
            </button>
          </div>
        </div>
        {modalCopiaManual}
      </AppLayout>
    );
  }

  const campo = 'w-full bg-white border border-borda rounded-xl px-4 py-3 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-azul/25 focus:border-azul';
  const qtdItens = carrinho.reduce((a, i) => a + i.quantidade, 0);

  // Fechar pedido
  if (checkout) {
    return (
      <AppLayout>
        <button onClick={() => setCheckout(false)} className="inline-flex items-center gap-1.5 min-h-[44px] -ml-1 px-1 mb-1 text-sm font-medium text-texto-fraco hover:text-texto">
          <Icon name="arrow-left" size={18} /> Voltar à loja
        </button>
        <PageHeader title="Fechar pedido da loja" subtitle="Confira os itens, informe a entrega e pague no PIX." />

        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start">
          <div>
            {/* 1. Itens */}
            <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-noite mb-3">
              <span className="w-7 h-7 rounded-full bg-noite text-white font-display text-base flex items-center justify-center">1</span>
              Seu pedido
            </h2>
            <Card className="!p-0 overflow-hidden mb-6">
              <ul className="divide-y divide-borda">
                {carrinho.map((item, i) => (
                  <li key={i} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[15px] leading-snug">{item.produto.nome}</div>
                      {item.variacao && <div className="text-sm text-texto-fraco">{item.variacao.tamanho}{item.variacao.cor ? ` · ${item.variacao.cor}` : ''}</div>}
                      <div className="text-sm text-texto-fraco mt-0.5">
                        {item.quantidade}× · <span className="font-display text-lg leading-none tracking-wide text-noite">{brl(item.produto.preco * item.quantidade)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removerDoCarrinho(i)}
                      aria-label={`Remover ${item.produto.nome}`}
                      className="w-11 h-11 shrink-0 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-vermelho hover:bg-red-100 outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            {/* 2. Entrega e identificação */}
            <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-noite mb-3">
              <span className="w-7 h-7 rounded-full bg-noite text-white font-display text-base flex items-center justify-center">2</span>
              Entrega e identificação
            </h2>
            <Card className="mb-6 space-y-4">
              <div role="radiogroup" aria-label="Entrega">
                <p className="text-sm font-medium mb-2">Entrega</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'retirada', label: 'Retirar no local' },
                    { v: 'envio', label: `Envio${freteConfig > 0 ? ` (+${brl(freteConfig)})` : ''}` },
                  ] as const).map(o => (
                    <button key={o.v} type="button" role="radio" aria-checked={entregaTipo === o.v} onClick={() => setEntregaTipo(o.v)}
                      className={`min-h-[48px] px-2 rounded-xl text-sm font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
                        entregaTipo === o.v ? 'bg-noite text-white border-noite' : 'bg-white text-texto border-borda hover:border-azul/60'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                {entregaTipo === 'envio' && (
                  <div className="mt-3">
                    <label htmlFor="loja-endereco" className="block text-sm font-medium mb-1.5">Endereço completo</label>
                    <textarea
                      id="loja-endereco"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      placeholder="Rua, número, bairro, cidade - UF, CEP"
                      rows={3}
                      autoComplete="street-address"
                      className={`${campo} resize-none`}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="loja-trigrama" className="block text-sm font-medium mb-1.5">Trigrama</label>
                  <NomeGuerraInput id="loja-trigrama" value={nomeGuerra} onChange={setNomeGuerra} />
                </div>
                <div>
                  <label htmlFor="loja-whatsapp" className="block text-sm font-medium mb-1.5">WhatsApp com DDD</label>
                  <input id="loja-whatsapp" type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                    placeholder="62999998888" className={campo} />
                </div>
              </div>

              <div className="rounded-xl bg-fundo-elevado border border-borda p-3.5">
                <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                  <input type="checkbox" checked={visitante} onChange={(e) => setVisitante(e.target.checked)}
                    className="w-5 h-5 shrink-0 accent-azul rounded" />
                  <span>
                    <span className="block text-sm font-medium">Sou visitante ou estou em missão</span>
                    <span className="block text-sm text-texto-fraco">Marque se você é de outro esquadrão.</span>
                  </span>
                </label>
                {visitante && (
                  <div className="mt-3">
                    <label htmlFor="loja-esquadrao" className="block text-sm font-medium mb-1.5">Esquadrão de origem</label>
                    <input
                      id="loja-esquadrao"
                      type="text" value={esquadraoOrigem}
                      onChange={(e) => setEsquadraoOrigem(e.target.value.toUpperCase())}
                      autoCapitalize="characters"
                      placeholder="Ex.: 2/5 GAV"
                      className={campo}
                    />
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 3. Pagamento */}
          <div className="pb-4">
            <h2 className="flex items-center gap-2.5 text-[15px] font-semibold text-noite mb-3">
              <span className="w-7 h-7 rounded-full bg-noite text-white font-display text-base flex items-center justify-center">3</span>
              Pagar com PIX
            </h2>
            <Card>
              <dl className="text-sm space-y-1.5">
                <div className="flex justify-between"><dt className="text-texto-fraco">Itens ({qtdItens})</dt><dd className="tabular-nums">{brl(totalCarrinho)}</dd></div>
                {entregaTipo === 'envio' && (
                  <div className="flex justify-between"><dt className="text-texto-fraco">Frete</dt><dd className="tabular-nums">{brl(freteConfig)}</dd></div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-borda">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-display text-3xl leading-none tracking-wide text-noite">{brl(totalFinal)}</dd>
                </div>
              </dl>
              {maxParcelas > 1 && (
                <div className="mt-4" role="radiogroup" aria-label="Parcelas">
                  <p className="text-sm font-medium mb-2">Parcelas</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: maxParcelas }, (_, i) => i + 1).map(n => (
                      <button key={n} type="button" role="radio" aria-checked={parcelas === n} onClick={() => setParcelas(n)}
                        className={`min-h-[52px] rounded-xl text-sm font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${parcelas === n ? 'bg-noite text-white border-noite' : 'bg-white text-texto border-borda hover:border-azul/60'}`}>
                        <span className="block font-semibold">{n}×</span>
                        <span className="block text-xs opacity-90 tabular-nums">{brl(totalFinal / n)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {erro && <p role="alert" className="text-vermelho text-sm mt-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

              <Button variant="success" size="lg" className="w-full mt-4" onClick={enviarPedido} disabled={enviando}>
                {enviando ? 'Enviando...' : maxParcelas > 1 && parcelas > 1 ? `Pagar com PIX em ${parcelas}×` : 'Pagar com PIX'}
              </Button>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Vitrine
  return (
    <AppLayout>
      <PageHeader
        title="Loja"
        subtitle="Toque no produto para ver tamanhos e detalhes."
        right={
          <Link to="/loja/minhas" className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl border border-borda bg-white text-sm font-medium hover:bg-fundo-elevado">
            <Icon name="bag" size={16} /> Minhas compras
          </Link>
        }
      />

      {loading ? (
        <div className={GRADE} aria-busy="true" aria-label="Carregando produtos">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-borda animate-pulse">
              <div className="aspect-square bg-fundo-elevado" />
              <div className="p-3 space-y-2"><div className="h-4 bg-fundo-elevado rounded w-3/4" /><div className="h-6 bg-fundo-elevado rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : erroCarga ? (
        <EmptyState
          icon={<Icon name="warning" size={24} />}
          message="Não foi possível carregar os produtos"
          hint="Confira sua conexão e tente de novo."
          action={<Button variant="outline" onClick={carregarProdutos}><Icon name="refresh" size={16} /> Tentar de novo</Button>}
        />
      ) : produtos.length === 0 ? (
        <EmptyState
          icon={<Icon name="bag" size={24} />}
          message="Nenhum produto disponível agora"
          hint="Novos produtos aparecem aqui assim que forem cadastrados."
        />
      ) : (
        <div className={`${GRADE} ${carrinho.length > 0 ? 'pb-28' : 'pb-4'}`}>
          {produtos.map(p => {
            const img = p.imagens?.[0] ? resolveImg(p.imagens[0].url) : resolveImg(p.imagem_url);
            const opcoes = p.variacoes.filter(v => v.estoque > 0).length;
            const semEstoque = p.variacoes.length > 0 && opcoes === 0;
            return (
              <button key={p.id} onClick={() => abrirProduto(p)}
                className="flex flex-col bg-white rounded-2xl overflow-hidden border border-borda text-left hover:border-azul/60 active:scale-[0.98] transition-[border-color,transform] outline-none focus-visible:ring-2 focus-visible:ring-azul/40">
                <div className="relative aspect-square w-full bg-fundo-elevado">
                  {img ? (
                    <img src={img} alt="" loading="lazy" className={`w-full h-full object-cover ${semEstoque ? 'grayscale opacity-60' : ''}`} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-texto-fraco/40">
                      <Icon name="bag" size={40} />
                    </div>
                  )}
                  {semEstoque && (
                    <span className="absolute top-2 left-2 bg-noite text-white text-xs font-semibold px-2.5 py-1 rounded-lg">Esgotado</span>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-medium text-[15px] leading-snug line-clamp-2">{p.nome}</h3>
                  <div className="font-display text-2xl leading-none tracking-wide text-noite mt-1.5">{brl(p.preco)}</div>
                  {p.variacoes.length > 0 && !semEstoque && (
                    <p className="text-xs text-texto-fraco mt-1.5">{opcoes} {opcoes === 1 ? 'opção disponível' : 'opções disponíveis'}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Barra do carrinho */}
      {carrinho.length > 0 && !produtoAberto && (
        <div className="fixed acima-nav left-0 right-0 z-30 px-4 pb-3 lg:pb-4 animate-slide-up pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto">
            <button
              onClick={() => setCheckout(true)}
              className="w-full min-h-[60px] bg-noite text-white rounded-2xl pl-4 pr-3 flex items-center gap-3 shadow-flutua active:scale-[0.98] transition-transform hover:bg-noite-2 outline-none focus-visible:ring-2 focus-visible:ring-azul/50 focus-visible:ring-offset-2"
            >
              <span className="relative">
                <Icon name="bag" size={24} />
                <span className="absolute -top-2 -right-2.5 min-w-[20px] h-5 px-1 rounded-full bg-escarlate text-white text-xs font-bold flex items-center justify-center tabular-nums">{qtdItens}</span>
              </span>
              <span className="flex-1 text-left pl-2">
                <span className="block text-xs text-noite-texto leading-tight">{qtdItens} {qtdItens === 1 ? 'item' : 'itens'}</span>
                <span className="block font-display text-2xl leading-none tracking-wide">{brl(totalCarrinho)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-verde rounded-xl px-4 min-h-[44px] font-semibold text-[15px]">
                Fechar pedido <Icon name="chevron-right" size={16} />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Detalhe do produto */}
      <Modal open={!!produtoAberto} onClose={fecharProduto} title={produtoAberto?.nome || ''}>
        {produtoAberto && (
          <div className="space-y-5">
            {(produtoAberto.imagens?.length > 0 || produtoAberto.imagem_url) && (
              <div className="relative">
                {produtoAberto.imagens?.length > 1 ? (
                  <>
                    <div className="flex overflow-x-auto snap-x snap-mandatory rounded-xl gap-0 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const idx = Math.round(el.scrollLeft / el.offsetWidth);
                        setImgIndex(idx);
                      }}>
                      {produtoAberto.imagens.map((img, i) => (
                        <div key={i} className="aspect-square flex-shrink-0 w-full snap-center bg-fundo">
                          <img src={resolveImg(img.url)!} alt={`${produtoAberto.nome}, foto ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-1.5 mt-2" aria-hidden="true">
                      {produtoAberto.imagens.map((_, i) => (
                        <div key={i} className={`h-2 rounded-full transition-all ${i === imgIndex ? 'bg-noite w-4' : 'bg-borda w-2'}`} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="aspect-square rounded-xl overflow-hidden bg-fundo">
                    <img src={resolveImg(produtoAberto.imagens?.[0]?.url || produtoAberto.imagem_url)!} alt={produtoAberto.nome} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="font-display text-4xl leading-none tracking-wide text-noite">{brl(produtoAberto.preco)}</div>
              {produtoAberto.descricao && <p className="text-[15px] text-texto-fraco mt-2">{produtoAberto.descricao}</p>}
            </div>

            {produtoAberto.variacoes.length > 0 && (
              <div role="radiogroup" aria-label="Opção">
                <p className="text-sm font-medium mb-2">Escolha a opção</p>
                <div className="flex flex-wrap gap-2">
                  {produtoAberto.variacoes.map(v => (
                    <button key={v.id} type="button" role="radio" aria-checked={variacaoSelecionada?.id === v.id}
                      onClick={() => v.estoque > 0 && setVariacaoSelecionada(v)}
                      disabled={v.estoque <= 0}
                      className={`min-h-[44px] min-w-[52px] px-3.5 rounded-xl text-sm font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
                        variacaoSelecionada?.id === v.id
                          ? 'bg-noite text-white border-noite'
                          : v.estoque <= 0
                            ? 'bg-fundo-elevado text-texto-fraco border-borda cursor-not-allowed line-through'
                            : 'bg-white text-texto border-borda hover:border-azul/60'
                      }`}>
                      {v.tamanho || v.nome}{v.cor ? ` · ${v.cor}` : ''}
                      {v.estoque <= 0 && <span className="sr-only"> (esgotado)</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium" id="loja-qtd">Quantidade</span>
              <div className="flex items-center rounded-xl border border-borda bg-fundo-elevado" aria-labelledby="loja-qtd">
                <button type="button" onClick={() => setQuantidade(Math.max(1, quantidade - 1))} disabled={quantidade <= 1} aria-label="Diminuir quantidade"
                  className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-borda/60 disabled:opacity-40 text-xl leading-none">−</button>
                <span className="w-9 text-center font-display text-xl leading-none tabular-nums" aria-live="polite">{quantidade}</span>
                <button type="button" onClick={() => setQuantidade(quantidade + 1)} aria-label="Aumentar quantidade"
                  className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-borda/60"><Icon name="plus" size={18} /></button>
              </div>
            </div>

            <Button size="lg" className="w-full justify-between" onClick={adicionarAoCarrinho}
              disabled={produtoAberto.variacoes.length > 0 && !variacaoSelecionada}>
              <span>{produtoAberto.variacoes.length > 0 && !variacaoSelecionada ? 'Escolha uma opção' : 'Adicionar ao carrinho'}</span>
              <span className="font-display text-xl leading-none tracking-wide">{brl(produtoAberto.preco * quantidade)}</span>
            </Button>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
