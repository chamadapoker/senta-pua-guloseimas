import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Loading } from '../../components/ui/Loading';
import { inputClass } from '../../components/ui/Field';
import { api } from '../../services/api';
import { clearConfigCache } from '../../services/config';
import { PageHeader } from '../../components/ui/PageHeader';
import { useToast } from '../../hooks/useToast';

type Aba = 'nomes' | 'pix' | 'valores' | 'loja';

const ABAS: { id: Aba; label: string; icon: 'tag' | 'pix' | 'cash' | 'cart'; descricao: string }[] = [
  { id: 'nomes',   label: 'Nomes',   icon: 'tag',  descricao: 'Como as cantinas e as salas do café aparecem no app.' },
  { id: 'pix',     label: 'PIX',     icon: 'pix',  descricao: 'Chaves que recebem os pagamentos de cada área.' },
  { id: 'valores', label: 'Valores', icon: 'cash', descricao: 'Valores padrão do café por sala e plano, e o valor cobrado de visitantes.' },
  { id: 'loja',    label: 'Loja',    icon: 'cart', descricao: 'Parcelamento e frete da loja.' },
];

const DICA_NOME_PIX = 'Sem acento e até 25 letras, como aparece no banco (ex.: JOAO DA SILVA).';
const DICA_WHATSAPP = 'Só números, com DDI e DDD (ex.: 5562999998888).';

// Componentes FORA do corpo de Configuracoes: se fossem definidos dentro, seriam recriados
// a cada render e o React remontaria os inputs (perdendo o foco a cada letra digitada).
function Campo({ id, label, hint, children, className = '' }: { id: string; label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-texto-fraco mt-1">{hint}</p>}
    </div>
  );
}

function Secao({ title, descricao, children }: { title: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-borda shadow-sm p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-noite">{title}</h2>
        {descricao && <p className="text-sm text-texto-fraco mt-0.5">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

// Valores padrão do café por sala e plano (fora do corpo de Configuracoes, pelo mesmo motivo acima)
function ValoresPadraoCafe({ v, set }: { v: (k: string, f?: string) => string; set: (k: string, valor: string) => void }) {
  const salas = [
    { id: 'oficial', nome: v('nome_cafe_oficiais', 'Sala dos oficiais') },
    { id: 'graduado', nome: v('nome_cafe_graduados', 'Sala dos graduados') },
  ];
  return (
    <Secao title="Café" descricao="Valor usado ao cadastrar um assinante sem informar o valor. O anual vale 12 meses a partir da adesão.">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {salas.map(sala => (
          <fieldset key={sala.id} className="space-y-3 border border-borda rounded-xl p-3">
            <legend className="px-1 text-sm font-medium text-noite">{sala.nome}</legend>
            {(['mensal', 'anual'] as const).map(plano => {
              const k = `cafe_valor_${sala.id}_${plano}`;
              return (
                <Campo key={k} id={k} label={plano === 'mensal' ? 'Mensal (R$)' : 'Anual (R$)'}>
                  <input id={k} type="number" inputMode="decimal" step="0.01" min="0" value={v(k)} onChange={e => set(k, e.target.value)} className={inputClass} placeholder="0,00" />
                </Campo>
              );
            })}
          </fieldset>
        ))}
      </div>
    </Secao>
  );
}

// Bloco de PIX reaproveitado por área (chave, nome, cidade opcional e WhatsApp)
function BlocoPix({ prefixo, titulo, descricao, comCidade, v, set }: {
  prefixo: string; titulo: string; descricao: string; comCidade?: boolean;
  v: (k: string, f?: string) => string; set: (k: string, valor: string) => void;
}) {
  const nome = v(`${prefixo}_nome`);
  return (
    <Secao title={titulo} descricao={descricao}>
      <Campo id={`${prefixo}_chave`} label="Chave PIX" hint="CPF, CNPJ, email, telefone ou chave aleatória.">
        <input id={`${prefixo}_chave`} value={v(`${prefixo}_chave`)} onChange={e => set(`${prefixo}_chave`, e.target.value)} className={inputClass} required autoComplete="off" />
      </Campo>
      <div className={`grid grid-cols-1 gap-4 ${comCidade ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Campo id={`${prefixo}_nome`} label={`Nome do recebedor (${nome.length}/25)`} hint={DICA_NOME_PIX} className={comCidade ? 'sm:col-span-2' : ''}>
          <input id={`${prefixo}_nome`} value={nome} onChange={e => set(`${prefixo}_nome`, e.target.value)} className={inputClass} required maxLength={25} autoComplete="off" />
        </Campo>
        {comCidade && (
          <Campo id={`${prefixo}_cidade`} label="Cidade" hint="Sem acento.">
            <input id={`${prefixo}_cidade`} value={v(`${prefixo}_cidade`, 'ANAPOLIS')} onChange={e => set(`${prefixo}_cidade`, e.target.value)} className={inputClass} required />
          </Campo>
        )}
        <Campo id={`${prefixo}_whatsapp`} label="WhatsApp para comprovantes" hint={DICA_WHATSAPP}>
          <input id={`${prefixo}_whatsapp`} inputMode="numeric" value={v(`${prefixo}_whatsapp`)} onChange={e => set(`${prefixo}_whatsapp`, e.target.value.replace(/\D/g, ''))} className={inputClass} placeholder="5562999998888" required />
        </Campo>
      </div>
    </Secao>
  );
}

export function Configuracoes() {
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = useState<Record<string, string>>({});
  const [aba, setAba] = useState<Aba>('nomes');
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setCarregando(true);
    setErroCarga('');
    api.get<Record<string, string>>('/api/config')
      .then(setConfig)
      .catch((e: any) => {
        const msg = e?.message || 'Erro ao carregar configurações';
        setErroCarga(msg);
        showToast(msg, 'error');
      })
      .finally(() => setCarregando(false));
  }, [showToast, tentativa]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const abaParam = params.get('aba') as Aba;
    if (abaParam && ABAS.some(a => a.id === abaParam)) {
      setAba(abaParam);
    }
  }, [location.search]);

  const trocarAba = (id: Aba) => {
    setAba(id);
    const params = new URLSearchParams(location.search);
    params.set('aba', id);
    navigate({ search: params.toString() }, { replace: true });
  };

  const v = (key: string, fallback = '') => config[key] || fallback;
  const set = (key: string, valor: string) => setConfig(prev => ({ ...prev, [key]: valor }));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setSalvo(false);
    try {
      await api.put('/api/config', config);
      clearConfigCache();
      setSalvo(true);
      showToast('Configurações salvas', 'success');
      setTimeout(() => setSalvo(false), 3000);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar configurações', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const abaAtual = ABAS.find(a => a.id === aba)!;

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <PageHeader title="Configurações" subtitle="Nomes, chaves PIX e valores usados em todo o sistema." />

      {carregando ? (
        <Loading label="Carregando configurações..." />
      ) : erroCarga ? (
        <div role="alert" className="bg-white border border-borda rounded-2xl p-6 text-center max-w-2xl">
          <p className="font-medium text-texto">Não foi possível carregar as configurações.</p>
          <p className="text-sm text-texto-fraco mt-1">{erroCarga}</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => setTentativa(t => t + 1)}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </div>
      ) : (
        <div className="max-w-3xl">
          {/* Abas */}
          <div role="tablist" aria-label="Seções das configurações" className="grid grid-cols-4 gap-1 bg-white rounded-2xl p-1 border border-borda shadow-sm mb-2">
            {ABAS.map(a => (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`aba-${a.id}`}
                aria-selected={aba === a.id}
                aria-controls="painel-config"
                onClick={() => trocarAba(a.id)}
                className={`min-h-[44px] px-1 rounded-xl text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
                  aba === a.id ? 'bg-azul text-white' : 'text-texto-fraco hover:bg-fundo hover:text-texto'
                }`}
              >
                <Icon name={a.icon} size={16} />
                <span className="text-xs sm:text-sm">{a.label}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-texto-fraco mb-4 px-1">{abaAtual.descricao}</p>

          <form onSubmit={salvar} id="painel-config" role="tabpanel" aria-labelledby={`aba-${aba}`} className="space-y-4">
            {aba === 'nomes' && (
              <>
                <Secao title="Cantina" descricao="Nome de cada catálogo da cantina.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Campo id="nome_sala_oficiais" label="Catálogo 1 (oficiais)">
                      <input id="nome_sala_oficiais" value={v('nome_sala_oficiais', 'Cantina dos Oficiais')} onChange={e => set('nome_sala_oficiais', e.target.value)} className={inputClass} required />
                    </Campo>
                    <Campo id="nome_sala_graduados" label="Catálogo 2 (graduados)">
                      <input id="nome_sala_graduados" value={v('nome_sala_graduados', 'Cantina dos Graduados')} onChange={e => set('nome_sala_graduados', e.target.value)} className={inputClass} required />
                    </Campo>
                  </div>
                </Secao>

                <Secao title="Caixinha do café" descricao="Nome de cada sala do café.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Campo id="nome_cafe_oficiais" label="Sala 1 (oficiais)">
                      <input id="nome_cafe_oficiais" value={v('nome_cafe_oficiais', 'Sala dos Oficiais')} onChange={e => set('nome_cafe_oficiais', e.target.value)} className={inputClass} required />
                    </Campo>
                    <Campo id="nome_cafe_graduados" label="Sala 2 (graduados)">
                      <input id="nome_cafe_graduados" value={v('nome_cafe_graduados', 'Sala do Lange')} onChange={e => set('nome_cafe_graduados', e.target.value)} className={inputClass} required />
                    </Campo>
                  </div>
                </Secao>
              </>
            )}

            {aba === 'pix' && (
              <>
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 text-azul rounded-2xl px-4 py-3 text-sm">
                  <Icon name="info" size={18} className="mt-0.5 shrink-0" />
                  <p>O nome do recebedor vai dentro do código PIX: escreva sem acento e com no máximo 25 letras, senão alguns bancos recusam o pagamento.</p>
                </div>
                <BlocoPix prefixo="pix_guloseimas" titulo="Cantina e loja" descricao="Recebe os pagamentos da cantina e da loja." comCidade v={v} set={set} />
                <BlocoPix prefixo="pix_cafe_oficial" titulo="Café dos oficiais" descricao="Recebe as mensalidades do café dos oficiais." v={v} set={set} />
                <BlocoPix prefixo="pix_cafe_graduado" titulo="Café dos graduados" descricao="Recebe as mensalidades do café dos graduados." v={v} set={set} />
                <BlocoPix prefixo="pix_ximboca" titulo="Ximboca" descricao="Recebe as contribuições dos eventos." v={v} set={set} />
              </>
            )}

            {aba === 'valores' && (
              <>
              <ValoresPadraoCafe v={v} set={set} />
              <Secao title="Café para visitantes" descricao="Valor pago por visitantes de outros esquadrões para usar o café.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo id="cafe_visitante_oficial_valor" label="Oficiais (R$)">
                    <input id="cafe_visitante_oficial_valor" type="number" inputMode="decimal" step="0.01" min="0" value={v('cafe_visitante_oficial_valor', '20.00')} onChange={e => set('cafe_visitante_oficial_valor', e.target.value)} className={inputClass} required />
                  </Campo>
                  <Campo id="cafe_visitante_graduado_valor" label="Graduados (R$)">
                    <input id="cafe_visitante_graduado_valor" type="number" inputMode="decimal" step="0.01" min="0" value={v('cafe_visitante_graduado_valor', '20.00')} onChange={e => set('cafe_visitante_graduado_valor', e.target.value)} className={inputClass} required />
                  </Campo>
                </div>
              </Secao>
              </>
            )}

            {aba === 'loja' && (
              <Secao title="Pagamento e envio" descricao="Regras aplicadas no checkout da loja.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Campo id="loja_max_parcelas" label="Parcelas máximas no PIX">
                    <select id="loja_max_parcelas" value={v('loja_max_parcelas', '1')} onChange={e => set('loja_max_parcelas', e.target.value)} className={inputClass}>
                      <option value="1">Somente 1x (sem parcelamento)</option>
                      <option value="2">Até 2x</option>
                      <option value="3">Até 3x</option>
                    </select>
                  </Campo>
                  <Campo id="loja_frete" label="Frete de envio (R$)" hint="Somado ao total quando o cliente escolhe envio. Deixe 0 se não faz envio.">
                    <input id="loja_frete" type="number" inputMode="decimal" step="0.01" min="0" value={v('loja_frete', '0')} onChange={e => set('loja_frete', e.target.value)} className={inputClass} required />
                  </Campo>
                </div>
              </Secao>
            )}

            {/* Barra de salvar: gruda no rodapé (acima da navegação inferior no celular) */}
            <div className="sticky bottom-[84px] lg:bottom-3 z-10 bg-white border border-borda rounded-2xl p-3 flex flex-wrap items-center gap-x-3 gap-y-2 shadow-sm">
              <Button type="submit" disabled={salvando} className="flex-1 sm:flex-none">
                <Icon name="check" size={16} /> {salvando ? 'Salvando...' : 'Salvar configurações'}
              </Button>
              {salvo
                ? <span role="status" className="text-verde-escuro text-sm font-medium flex items-center gap-1"><Icon name="check" size={16} /> Salvo</span>
                : <span className="text-xs text-texto-fraco">Salva as alterações de todas as abas.</span>}
            </div>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
