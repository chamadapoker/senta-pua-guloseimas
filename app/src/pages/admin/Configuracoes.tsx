import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { api } from '../../services/api';

type Aba = 'nomes' | 'pix' | 'valores' | 'loja';

const ABAS: { id: Aba; label: string; icon: 'tag' | 'credit-card' | 'cash' | 'cart' }[] = [
  { id: 'nomes',   label: 'Nomes',   icon: 'tag' },
  { id: 'pix',     label: 'PIX',     icon: 'credit-card' },
  { id: 'valores', label: 'Valores', icon: 'cash' },
  { id: 'loja',    label: 'Loja',    icon: 'cart' },
];

export function Configuracoes() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [aba, setAba] = useState<Aba>('nomes');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    api.get<Record<string, string>>('/api/config').then(setConfig);
  }, []);

  const v = (key: string, fallback = '') => config[key] || fallback;
  const set = (key: string, valor: string) => setConfig(prev => ({ ...prev, [key]: valor }));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setSalvo(false);
    try {
      await api.put('/api/config', config);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      alert('Erro ao salvar configurações');
    } finally {
      setSalvando(false);
    }
  };

  const inputClass = "w-full bg-white border border-borda rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul";
  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-medium text-texto-fraco mb-1">{children}</label>
  );
  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-xl border border-borda shadow-sm p-4 space-y-3">
      <h3 className="font-medium text-xs text-azul uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <h1 className="font-display text-2xl text-azul tracking-wider mb-4">CONFIGURAÇÕES</h1>

      {/* Abas */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-borda shadow-sm mb-4 sticky top-2 z-10">
        {ABAS.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              aba === a.id ? 'bg-azul text-white shadow-sm' : 'text-texto-fraco hover:bg-fundo'
            }`}
          >
            <Icon name={a.icon} size={16} />
            <span className="hidden sm:inline">{a.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={salvar} className="max-w-2xl space-y-4">
        {aba === 'nomes' && (
          <>
            <Card title="Catálogos (Cantina)">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Catálogo 1 (Oficiais)</Label>
                  <input value={v('nome_sala_oficiais', 'Cantina dos Oficiais')} onChange={e => set('nome_sala_oficiais', e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <Label>Catálogo 2 (Graduados)</Label>
                  <input value={v('nome_sala_graduados', 'Cantina dos Graduados')} onChange={e => set('nome_sala_graduados', e.target.value)} className={inputClass} required />
                </div>
              </div>
            </Card>

            <Card title="Caixinha do Café - Salas">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Sala 1 (Oficiais)</Label>
                  <input value={v('nome_cafe_oficiais', 'Sala dos Oficiais')} onChange={e => set('nome_cafe_oficiais', e.target.value)} className={inputClass} required />
                </div>
                <div>
                  <Label>Sala 2 (Graduados)</Label>
                  <input value={v('nome_cafe_graduados', 'Sala do Lange')} onChange={e => set('nome_cafe_graduados', e.target.value)} className={inputClass} required />
                </div>
              </div>
            </Card>
          </>
        )}

        {aba === 'pix' && (
          <>
            <Card title="PIX — Cantina / Loja">
              <div>
                <Label>Chave PIX</Label>
                <input value={v('pix_guloseimas_chave')} onChange={e => set('pix_guloseimas_chave', e.target.value)} className={inputClass} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label>Nome recebedor (máx 25, sem acento)</Label>
                  <input value={v('pix_guloseimas_nome')} onChange={e => set('pix_guloseimas_nome', e.target.value)} className={inputClass} required maxLength={25} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <input value={v('pix_guloseimas_cidade', 'ANAPOLIS')} onChange={e => set('pix_guloseimas_cidade', e.target.value)} className={inputClass} required />
                </div>
              </div>
              <div>
                <Label>WhatsApp</Label>
                <input value={v('pix_guloseimas_whatsapp')} onChange={e => set('pix_guloseimas_whatsapp', e.target.value.replace(/\D/g, ''))} className={inputClass} placeholder="5562999..." required />
              </div>
            </Card>

            <Card title="PIX — Café Oficiais">
              <div>
                <Label>Chave PIX</Label>
                <input value={v('pix_cafe_oficial_chave')} onChange={e => set('pix_cafe_oficial_chave', e.target.value)} className={inputClass} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nome recebedor</Label>
                  <input value={v('pix_cafe_oficial_nome')} onChange={e => set('pix_cafe_oficial_nome', e.target.value)} className={inputClass} required maxLength={25} />
                </div>
                <div>
                  <Label>WhatsApp</Label>
                  <input value={v('pix_cafe_oficial_whatsapp')} onChange={e => set('pix_cafe_oficial_whatsapp', e.target.value.replace(/\D/g, ''))} className={inputClass} required />
                </div>
              </div>
            </Card>

            <Card title="PIX — Café Graduados">
              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">Chave PIX</label>
                <input value={v('pix_cafe_graduado_chave')} onChange={e => set('pix_cafe_graduado_chave', e.target.value)} className={inputClass} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-texto-fraco mb-1">Nome recebedor</label>
                  <input value={v('pix_cafe_graduado_nome')} onChange={e => set('pix_cafe_graduado_nome', e.target.value)} className={inputClass} required maxLength={25} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-texto-fraco mb-1">WhatsApp</label>
                  <input value={v('pix_cafe_graduado_whatsapp')} onChange={e => set('pix_cafe_graduado_whatsapp', e.target.value.replace(/\D/g, ''))} className={inputClass} required />
                </div>
              </div>
            </Card>

            <Card title="PIX — Ximboca">
              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">Chave PIX</label>
                <input value={v('pix_ximboca_chave')} onChange={e => set('pix_ximboca_chave', e.target.value)} className={inputClass} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-texto-fraco mb-1">Nome recebedor</label>
                  <input value={v('pix_ximboca_nome')} onChange={e => set('pix_ximboca_nome', e.target.value)} className={inputClass} required maxLength={25} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-texto-fraco mb-1">WhatsApp</label>
                  <input value={v('pix_ximboca_whatsapp')} onChange={e => set('pix_ximboca_whatsapp', e.target.value.replace(/\D/g, ''))} className={inputClass} required />
                </div>
              </div>
            </Card>
          </>
        )}

        {aba === 'valores' && (
          <Card title="Café — Valor para Visitantes">
            <p className="text-xs text-texto-fraco">Valor pago por visitantes de outros esquadrões para usar o café.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Oficiais (R$)</Label>
                <input type="number" step="0.01" min="0" value={v('cafe_visitante_oficial_valor', '20.00')} onChange={e => set('cafe_visitante_oficial_valor', e.target.value)} className={inputClass} required />
              </div>
              <div>
                <Label>Graduados (R$)</Label>
                <input type="number" step="0.01" min="0" value={v('cafe_visitante_graduado_valor', '20.00')} onChange={e => set('cafe_visitante_graduado_valor', e.target.value)} className={inputClass} required />
              </div>
            </div>
          </Card>
        )}

        {aba === 'loja' && (
          <Card title="Loja — Parcelamento">
            <Label>Parcelas máximas no PIX</Label>
            <select value={v('loja_max_parcelas', '1')} onChange={e => set('loja_max_parcelas', e.target.value)} className={inputClass}>
              <option value="1">Somente 1x (sem parcelamento)</option>
              <option value="2">Até 2x</option>
              <option value="3">Até 3x</option>
            </select>
          </Card>
        )}

        <div className="sticky bottom-2 bg-white/95 backdrop-blur border border-borda rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Tudo'}
          </Button>
          {salvo && <span className="text-verde text-sm font-medium flex items-center gap-1"><Icon name="check" size={16} /> Salvo com sucesso</span>}
          <span className="ml-auto text-xs text-texto-fraco">Salva todas as abas</span>
        </div>
      </form>
    </AppLayout>
  );
}
