import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';

export function Configuracoes() {
  const [config, setConfig] = useState<Record<string, string>>({});
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

  const inputClass = "w-full bg-white border border-borda rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul";

  return (
    <AppLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">CONFIGURAÇÕES</h1>

      <form onSubmit={salvar} className="max-w-md space-y-6">

        {/* Nomes dos Catálogos */}
        <div className="bg-white rounded-xl border border-borda shadow-sm p-5 space-y-4">
          <h2 className="font-medium text-sm text-texto-fraco uppercase tracking-wider">Nomes dos Catálogos</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Catálogo 1 (Oficiais)</label>
            <input value={v('nome_sala_oficiais', 'Sala dos Oficiais')} onChange={(e) => set('nome_sala_oficiais', e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Catálogo 2 (Graduados)</label>
            <input value={v('nome_sala_graduados', 'Sala dos Graduados')} onChange={(e) => set('nome_sala_graduados', e.target.value)} className={inputClass} required />
          </div>
        </div>

        {/* Nomes Café */}
        <div className="bg-white rounded-xl border border-borda shadow-sm p-5 space-y-4">
          <h2 className="font-medium text-sm text-texto-fraco uppercase tracking-wider">Caixinha do Café - Salas</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Sala 1 (Oficiais)</label>
            <input value={v('nome_cafe_oficiais', 'Sala dos Oficiais')} onChange={(e) => set('nome_cafe_oficiais', e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Sala 2 (Graduados)</label>
            <input value={v('nome_cafe_graduados', 'Sala do Lange')} onChange={(e) => set('nome_cafe_graduados', e.target.value)} className={inputClass} required />
          </div>
        </div>

        {/* PIX Guloseimas / Loja */}
        <div className="bg-white rounded-xl border border-borda shadow-sm p-5 space-y-4">
          <h2 className="font-medium text-sm text-texto-fraco uppercase tracking-wider">PIX - Guloseimas / Loja</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Chave PIX (e-mail)</label>
            <input value={v('pix_guloseimas_chave')} onChange={(e) => set('pix_guloseimas_chave', e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Nome do recebedor</label>
            <input value={v('pix_guloseimas_nome')} onChange={(e) => set('pix_guloseimas_nome', e.target.value)} className={inputClass} required maxLength={25} />
            <p className="text-xs text-texto-fraco mt-1">Máx 25 caracteres, sem acento</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Cidade</label>
              <input value={v('pix_guloseimas_cidade', 'ANAPOLIS')} onChange={(e) => set('pix_guloseimas_cidade', e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">WhatsApp</label>
              <input value={v('pix_guloseimas_whatsapp')} onChange={(e) => set('pix_guloseimas_whatsapp', e.target.value.replace(/\D/g, ''))} className={inputClass} placeholder="5562999..." required />
            </div>
          </div>
        </div>

        {/* PIX Café Oficiais */}
        <div className="bg-white rounded-xl border border-borda shadow-sm p-5 space-y-4">
          <h2 className="font-medium text-sm text-texto-fraco uppercase tracking-wider">PIX - Café Oficiais</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Chave PIX</label>
            <input value={v('pix_cafe_oficial_chave')} onChange={(e) => set('pix_cafe_oficial_chave', e.target.value)} className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome recebedor</label>
              <input value={v('pix_cafe_oficial_nome')} onChange={(e) => set('pix_cafe_oficial_nome', e.target.value)} className={inputClass} required maxLength={25} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">WhatsApp</label>
              <input value={v('pix_cafe_oficial_whatsapp')} onChange={(e) => set('pix_cafe_oficial_whatsapp', e.target.value.replace(/\D/g, ''))} className={inputClass} required />
            </div>
          </div>
        </div>

        {/* PIX Café Graduados */}
        <div className="bg-white rounded-xl border border-borda shadow-sm p-5 space-y-4">
          <h2 className="font-medium text-sm text-texto-fraco uppercase tracking-wider">PIX - Café Graduados</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Chave PIX</label>
            <input value={v('pix_cafe_graduado_chave')} onChange={(e) => set('pix_cafe_graduado_chave', e.target.value)} className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome recebedor</label>
              <input value={v('pix_cafe_graduado_nome')} onChange={(e) => set('pix_cafe_graduado_nome', e.target.value)} className={inputClass} required maxLength={25} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">WhatsApp</label>
              <input value={v('pix_cafe_graduado_whatsapp')} onChange={(e) => set('pix_cafe_graduado_whatsapp', e.target.value.replace(/\D/g, ''))} className={inputClass} required />
            </div>
          </div>
        </div>

        {/* Loja Parcelamento */}
        <div className="bg-white rounded-xl border border-borda shadow-sm p-5 space-y-4">
          <h2 className="font-medium text-sm text-texto-fraco uppercase tracking-wider">Loja - Parcelamento</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Parcelas máximas no PIX</label>
            <select value={v('loja_max_parcelas', '1')} onChange={(e) => set('loja_max_parcelas', e.target.value)} className={inputClass}>
              <option value="1">Somente 1x (sem parcelamento)</option>
              <option value="2">Até 2x</option>
              <option value="3">Até 3x</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pb-8">
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Tudo'}
          </Button>
          {salvo && <span className="text-verde text-sm font-medium">Salvo com sucesso!</span>}
        </div>
      </form>
    </AppLayout>
  );
}
