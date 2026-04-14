import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';

interface Despesa {
  id: string;
  tipo: 'oficial' | 'graduado';
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  nota_fiscal: string | null;
  observacao: string;
  created_by: string | null;
  created_at: string;
}

interface Saldo {
  total_entrada: number;
  total_saida: number;
  saldo_atual: number;
  total_pendente: number;
  saldo_previsto: number;
}

export function CafeDespesas() {
  const [tipo, setTipo] = useState<'' | 'oficial' | 'graduado'>('');
  const [lista, setLista] = useState<Despesa[]>([]);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [modal, setModal] = useState(false);
  const [novoTipo, setNovoTipo] = useState<'oficial' | 'graduado'>('graduado');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [notaFiscal, setNotaFiscal] = useState('');
  const [observacao, setObservacao] = useState('');

  const carregar = () => {
    const q = tipo ? `?tipo=${tipo}` : '';
    Promise.all([
      api.get<Despesa[]>(`/api/cafe/admin/despesas${q}`),
      api.get<Saldo>(`/api/cafe/admin/saldo${q}`),
    ]).then(([d, s]) => { setLista(d); setSaldo(s); });
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [tipo]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/api/cafe/admin/despesas', {
      tipo: novoTipo, descricao, categoria,
      valor: parseFloat(valor), data,
      nota_fiscal: notaFiscal || null,
      observacao,
    });
    setModal(false);
    setDescricao(''); setValor(''); setNotaFiscal(''); setObservacao('');
    carregar();
  };

  const excluir = async (d: Despesa) => {
    if (!confirm(`Remover "${d.descricao}" (R$ ${d.valor.toFixed(2)})?`)) return;
    await api.delete(`/api/cafe/admin/despesas/${d.id}`);
    carregar();
  };

  return (
    <AppLayout>
      <BackButton to="/admin/cafe" className="mb-3" />
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-azul tracking-wider">DESPESAS DO CAFÉ</h1>
        <Button size="sm" onClick={() => setModal(true)}>+ Nova Despesa</Button>
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-borda shadow-sm mb-4">
        {(['', 'oficial', 'graduado'] as const).map(t => (
          <button
            key={t || 'all'}
            onClick={() => setTipo(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              tipo === t ? 'bg-azul text-white shadow-sm' : 'text-texto-fraco'
            }`}
          >
            {t || 'Todos'}
          </button>
        ))}
      </div>

      {saldo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl p-3 border border-borda text-center">
            <div className="text-[10px] text-texto-fraco uppercase tracking-wider">Entrou</div>
            <div className="font-display text-lg text-verde-escuro">R$ {saldo.total_entrada.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-borda text-center">
            <div className="text-[10px] text-texto-fraco uppercase tracking-wider">Saiu</div>
            <div className="font-display text-lg text-vermelho">R$ {saldo.total_saida.toFixed(2)}</div>
          </div>
          <div className={`rounded-xl p-3 border text-center ${saldo.saldo_atual >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="text-[10px] uppercase tracking-wider text-texto-fraco">Saldo Atual</div>
            <div className={`font-display text-lg ${saldo.saldo_atual >= 0 ? 'text-verde-escuro' : 'text-vermelho'}`}>R$ {saldo.saldo_atual.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-borda text-center">
            <div className="text-[10px] text-texto-fraco uppercase tracking-wider">Previsto (+pend)</div>
            <div className="font-display text-lg text-azul">R$ {saldo.saldo_previsto.toFixed(2)}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-borda overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-azul">
              <th className="px-3 py-2 text-left text-white font-medium">Data</th>
              <th className="px-3 py-2 text-left text-white font-medium">Descrição</th>
              <th className="px-3 py-2 text-left text-white font-medium">Categoria</th>
              <th className="px-3 py-2 text-left text-white font-medium">Tipo</th>
              <th className="px-3 py-2 text-right text-white font-medium">Valor</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lista.map(d => (
              <tr key={d.id}>
                <td className="px-3 py-2 text-xs text-texto-fraco">{new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-3 py-2">
                  {d.descricao}
                  {d.nota_fiscal && <span className="ml-1 text-[10px] text-texto-fraco">NF {d.nota_fiscal}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-texto-fraco">{d.categoria}</td>
                <td className="px-3 py-2 text-xs capitalize">{d.tipo}</td>
                <td className="px-3 py-2 text-right font-medium text-vermelho">R$ {d.valor.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => excluir(d)} className="text-xs px-2 py-1 rounded-lg text-vermelho bg-red-50 border border-red-200 hover:bg-red-100">X</button>
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-texto-fraco">Nenhuma despesa</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nova Despesa">
        <form onSubmit={salvar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Sala</label>
              <select value={novoTipo} onChange={e => setNovoTipo(e.target.value as 'oficial' | 'graduado')} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm">
                <option value="graduado">Graduados</option>
                <option value="oficial">Oficiais</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm">
                <option value="cafe">Café (pó)</option>
                <option value="acucar">Açúcar</option>
                <option value="leite">Leite</option>
                <option value="filtro">Filtro</option>
                <option value="copos">Copos/Descartáveis</option>
                <option value="limpeza">Limpeza</option>
                <option value="equipamento">Equipamento</option>
                <option value="geral">Geral</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Descrição</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm" required placeholder="Ex: 1kg de café Melitta" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nota Fiscal (opcional)</label>
            <input value={notaFiscal} onChange={e => setNotaFiscal(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm" placeholder="Número da NF" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Observação</label>
            <input value={observacao} onChange={e => setObservacao(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm" />
          </div>
          <Button type="submit" className="w-full">Salvar</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
