import { useRef, useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Icon, type IconName } from '../components/ui/Icon';
import { useCart } from '../hooks/useCart';
import { useUserAuth } from '../hooks/useUserAuth';
import { useConfirm } from '../hooks/useConfirm';
import { api } from '../services/api';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

type Metodo = 'pix' | 'fiado' | 'dinheiro';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Checkout() {
  const { itens, total, alterarQuantidade, remover, limpar } = useCart();
  const { user } = useUserAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [metodo, setMetodo] = useState<Metodo>('pix');
  const navigate = useNavigate();
  const confirm = useConfirm();
  // Trava contra duplo envio (clique duplo antes do re-render com loading=true)
  const enviandoRef = useRef(false);
  // Pedido concluído: o carrinho fica vazio, mas não deve redirecionar para "/"
  const concluidoRef = useRef(false);

  if (itens.length === 0) {
    if (concluidoRef.current) return null;
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-sm mx-auto py-10 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-noite text-white flex items-center justify-center mx-auto mb-5">
            <Icon name="user" size={28} />
          </div>
          <h1 className="font-display text-3xl text-noite tracking-wide leading-none mb-3">Entre para fechar o pedido</h1>
          <p className="text-texto-fraco text-sm mb-7">Seu carrinho fica guardado. Entre na sua conta ou crie uma para finalizar.</p>
          <div className="space-y-3">
            <Link to="/login" state={{ returnTo: '/checkout' }} className="block">
              <Button size="lg" className="w-full" tabIndex={-1}>Entrar</Button>
            </Link>
            <Link to="/cadastro" state={{ returnTo: '/checkout' }} className="block">
              <Button variant="outline" size="lg" className="w-full" tabIndex={-1}>Criar conta</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const enviarPedido = async (metodo: Metodo) => {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    if (metodo !== 'pix') {
      const valor = brl(total());
      const ok = await confirm({
        title: metodo === 'dinheiro' ? 'Pagamento em dinheiro' : 'Anotar no fiado',
        message: metodo === 'dinheiro'
          ? `Confirma que pagou ${valor} em dinheiro? O responsável vai conferir o pagamento.`
          : `Confirma anotar ${valor} no fiado? O valor fica como débito na sua conta.`,
        confirmText: 'Confirmar',
      });
      if (!ok) { enviandoRef.current = false; return; }
    }
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
      concluidoRef.current = true;
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
      enviandoRef.current = false;
    }
  };

  const valorTotal = total();
  const metodos: { v: Metodo; icon: IconName; titulo: string; texto: string }[] = [
    { v: 'pix', icon: 'pix', titulo: 'PIX', texto: 'Na próxima tela, copie o código e pague no app do banco.' },
    { v: 'dinheiro', icon: 'cash', titulo: 'Dinheiro', texto: 'Deixe o valor no caixa. O responsável confere depois.' },
    ...(user.permite_fiado === 1
      ? [{ v: 'fiado' as const, icon: 'note' as const, titulo: 'Fiado', texto: 'Fica como débito na sua conta para pagar depois.' }]
      : []),
  ];
  const textoBotao = metodo === 'pix' ? 'Pagar com PIX' : metodo === 'dinheiro' ? 'Paguei em dinheiro' : 'Anotar no fiado';

  return (
    <AppLayout>
      <BackButton className="min-h-[44px] mb-1" />
      <PageHeader title="Fechar pedido" subtitle="Confira os itens, escolha como pagar e finalize." />

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start pb-32 lg:pb-6">
        {/* Passo 1: resumo */}
        <section aria-labelledby="passo-1">
          <h2 id="passo-1" className="flex items-center gap-2.5 text-[15px] font-semibold text-noite mb-3">
            <span className="w-7 h-7 rounded-full bg-noite text-white font-display text-base flex items-center justify-center">1</span>
            Seu pedido
          </h2>

          <Card className="!p-0 overflow-hidden mb-3">
            <ul className="divide-y divide-borda">
              {itens.map(({ produto, quantidade }) => (
                <li key={produto.id} className="p-3 flex items-center gap-3">
                  {resolveImg(produto.imagem_url) ? (
                    <img src={resolveImg(produto.imagem_url)!} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-fundo flex items-center justify-center text-xl shrink-0" aria-hidden="true">{produto.emoji}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[15px] leading-snug line-clamp-2">{produto.nome}</div>
                    <div className="font-display text-lg leading-none tracking-wide text-noite mt-1">{brl(produto.preco * quantidade)}</div>
                  </div>
                  <div className="flex items-center rounded-xl border border-borda bg-fundo-elevado">
                    <button
                      type="button"
                      onClick={() => quantidade <= 1 ? remover(produto.id) : alterarQuantidade(produto.id, quantidade - 1)}
                      aria-label={quantidade <= 1 ? `Remover ${produto.nome}` : `Diminuir ${produto.nome}`}
                      className="w-11 h-11 flex items-center justify-center rounded-xl text-texto hover:bg-borda/60 outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
                    >
                      {quantidade <= 1 ? <Icon name="trash" size={18} className="text-vermelho" /> : <span className="text-xl leading-none" aria-hidden="true">−</span>}
                    </button>
                    <span className="w-7 text-center font-display text-xl leading-none tabular-nums" aria-live="polite">{quantidade}</span>
                    <button
                      type="button"
                      onClick={() => alterarQuantidade(produto.id, quantidade + 1)}
                      aria-label={`Aumentar ${produto.nome}`}
                      className="w-11 h-11 flex items-center justify-center rounded-xl text-texto hover:bg-borda/60 outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
                    >
                      <Icon name="plus" size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between px-4 py-3 bg-fundo-elevado border-t border-borda">
              <span className="text-sm text-texto-fraco">Total</span>
              <span className="font-display text-3xl leading-none tracking-wide text-noite">{brl(valorTotal)}</span>
            </div>
          </Card>

          {/* Militar identificado */}
          <div className="flex items-center gap-3 px-1 mb-6 lg:mb-0">
            {resolveImg(user.foto_url) ? (
              <img src={resolveImg(user.foto_url)!} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-noite flex items-center justify-center font-display text-white text-sm">
                {user.trigrama}
              </div>
            )}
            <div className="flex-1 min-w-0 text-sm">
              <span className="text-texto-fraco">Pedido em nome de </span>
              <span className="font-semibold">{user.trigrama}</span>
            </div>
            <Link to="/perfil" className="text-sm text-azul underline underline-offset-2 min-h-[44px] inline-flex items-center shrink-0">Editar</Link>
          </div>
        </section>

        {/* Passo 2: forma de pagamento */}
        <section aria-labelledby="passo-2">
          <h2 id="passo-2" className="flex items-center gap-2.5 text-[15px] font-semibold text-noite mb-3">
            <span className="w-7 h-7 rounded-full bg-noite text-white font-display text-base flex items-center justify-center">2</span>
            Como você vai pagar?
          </h2>
          <div role="radiogroup" aria-labelledby="passo-2" className="space-y-2">
            {metodos.map((m) => {
              const ativo = metodo === m.v;
              return (
                <button
                  key={m.v}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setMetodo(m.v)}
                  disabled={loading}
                  className={`w-full flex items-center gap-3 text-left p-3.5 rounded-2xl border-2 bg-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40
                    ${ativo ? 'border-azul' : 'border-borda hover:border-borda-forte'}`}
                >
                  <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${ativo ? 'bg-azul text-white' : 'bg-fundo-elevado text-texto-fraco'}`}>
                    <Icon name={m.icon} size={22} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-texto">{m.titulo}</span>
                    <span className="block text-sm text-texto-fraco leading-snug">{m.texto}</span>
                  </span>
                  <span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${ativo ? 'border-azul' : 'border-borda-forte'}`} aria-hidden="true">
                    {ativo && <span className="w-2.5 h-2.5 rounded-full bg-azul" />}
                  </span>
                </button>
              );
            })}
          </div>
          {user.permite_fiado === 0 && user.is_visitante === 1 && (
            <p className="text-sm text-texto-fraco mt-3">Visitantes pagam à vista. Fiado não disponível.</p>
          )}

          {erro && <p role="alert" className="text-vermelho text-sm mt-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}

          {/* Passo 3: pagar (fixo acima da navegação no mobile) */}
          <div className="fixed acima-nav left-0 right-0 z-30 px-4 pb-3 lg:static lg:p-0 lg:mt-5">
            <div className="max-w-lg mx-auto lg:max-w-none">
              <Button
                variant="success"
                size="lg"
                className="w-full min-h-[56px] shadow-flutua lg:shadow-sm justify-between"
                onClick={() => enviarPedido(metodo)}
                disabled={loading}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-white/20 font-display text-base flex items-center justify-center" aria-hidden="true">3</span>
                  {loading ? 'Enviando...' : textoBotao}
                </span>
                <span className="font-display text-2xl leading-none tracking-wide">{brl(valorTotal)}</span>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
