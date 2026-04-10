import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';

export function Configuracoes() {
  const [nomeOficiais, setNomeOficiais] = useState('');
  const [nomeGraduados, setNomeGraduados] = useState('');
  const [maxParcelas, setMaxParcelas] = useState('1');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    api.get<Record<string, string>>('/api/config').then((c) => {
      setNomeOficiais(c.nome_sala_oficiais || 'Sala dos Oficiais');
      setNomeGraduados(c.nome_sala_graduados || 'Sala dos Graduados');
      setMaxParcelas(c.loja_max_parcelas || '1');
    });
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setSalvo(false);
    try {
      await api.put('/api/config', {
        nome_sala_oficiais: nomeOficiais,
        nome_sala_graduados: nomeGraduados,
        loja_max_parcelas: maxParcelas,
      });
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    } catch {
      alert('Erro ao salvar configurações');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">CATÁLOGOS</h1>

      <form onSubmit={salvar} className="max-w-md">
        <div className="bg-white rounded-xl border border-borda shadow-sm p-5 space-y-4">
          <h2 className="font-medium text-sm text-texto-fraco uppercase tracking-wider">Nomes dos Catálogos</h2>

          <div>
            <label className="block text-sm font-medium mb-1.5">🎖️ Catálogo 1 (Oficiais)</label>
            <input
              value={nomeOficiais}
              onChange={(e) => setNomeOficiais(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">⭐ Catálogo 2 (Graduados)</label>
            <input
              value={nomeGraduados}
              onChange={(e) => setNomeGraduados(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
            {salvo && <span className="text-verde text-sm font-medium">Salvo com sucesso!</span>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-borda shadow-sm p-5 space-y-4 mt-6">
          <h2 className="font-medium text-sm text-texto-fraco uppercase tracking-wider">Loja Militar - Parcelamento</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Parcelas máximas no PIX</label>
            <select
              value={maxParcelas}
              onChange={(e) => setMaxParcelas(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
            >
              <option value="1">Somente 1x (sem parcelamento)</option>
              <option value="2">Até 2x</option>
              <option value="3">Até 3x</option>
            </select>
            <p className="text-xs text-texto-fraco mt-1">Define quantas parcelas o militar pode escolher no PIX da Loja</p>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
}
