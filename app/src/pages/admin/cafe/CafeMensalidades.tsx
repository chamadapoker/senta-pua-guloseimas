import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/Layout';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';

interface Mensalidade {
  id: string;
  assinante_id: string;
  referencia: string;
  valor: number;
  status: 'pendente' | 'pago';
  nome_guerra: string;
  tipo: string;
  paid_at: string | null;
}

export function CafeMensalidades() {
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroRef, setFiltroRef] = useState('');
  const [modalGerar, setModalGerar] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [gerando, setGerando] = useState(false);

  const carregar = () => {
    const params = new URLSearchParams();
    if (filtroStatus) params.set('status', filtroStatus);
    if (filtroRef) params.set('referencia', filtroRef);
    const query = params.toString() ? `?${params}` : '';
    api.get<Mensalidade[]>(`/api/cafe/admin/mensalidades${query}`).then(setMensalidades);
  };

  useEffect(() => { carregar(); }, [filtroStatus, filtroRef]);

  useEffect(() => {
    const now = new Date();
    setReferencia(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  const gerarMensalidades = async () => {
    setGerando(true);
    try {
      const res = await api.post<{ criados: number; total: number }>('/api/cafe/admin/gerar-mensalidades', { referencia });
      alert(`${res.criados} mensalidades geradas de ${res.total} assinantes`);
      setModalGerar(false);
      carregar();
    } catch (e) {
      alert('Erro: ' + (e instanceof Error ? e.message : 'tente novamente'));
    } finally { setGerando(false); }
  };

  const marcarPago = async (id: string) => {
    await api.put(`/api/cafe/admin/mensalidades/${id}/pagar`, {});
    carregar();
  };

  // Get unique references for filter
  const referencias = [...new Set(mensalidades.map(m => m.referencia))].sort().reverse();

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-azul tracking-wider">MENSALIDADES</h1>
        <Button size="sm" onClick={() => setModalGerar(true)}>Gerar Mensalidades</Button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex gap-1">
          {['', 'pendente', 'pago'].map((s) => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtroStatus === s ? 'bg-vermelho text-white' : 'bg-white text-texto-fraco border border-borda'
              }`}>
              {s || 'Todos'}
            </button>
          ))}
        </div>
        {referencias.length > 0 && (
          <select value={filtroRef} onChange={(e) => setFiltroRef(e.target.value)}
            className="bg-white border border-borda rounded-lg px-3 py-1.5 text-xs">
            <option value="">Todas as referencias</option>
            {referencias.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-azul">
                <th className="px-3 py-3 text-left text-xs text-white uppercase tracking-wider">Militar</th>
                <th className="px-3 py-3 text-center text-xs text-white uppercase tracking-wider">Tipo</th>
                <th className="px-3 py-3 text-center text-xs text-white uppercase tracking-wider">Ref.</th>
                <th className="px-3 py-3 text-right text-xs text-white uppercase tracking-wider">Valor</th>
                <th className="px-3 py-3 text-center text-xs text-white uppercase tracking-wider">Status</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mensalidades.map((m) => (
                <tr key={m.id} className="border-b border-borda/50 hover:bg-fundo transition-colors">
                  <td className="px-3 py-3 font-medium text-texto">{m.nome_guerra}</td>
                  <td className="px-3 py-3 text-center text-xs text-texto-fraco capitalize">{m.tipo}</td>
                  <td className="px-3 py-3 text-center text-xs text-texto-fraco">{m.referencia}</td>
                  <td className="px-3 py-3 text-right font-bold text-dourado font-display tracking-wide">R$ {m.valor.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center">
                    <Badge variant={m.status === 'pago' ? 'success' : 'warning'}>{m.status === 'pago' ? 'Pago' : 'Pendente'}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    {m.status === 'pendente' && (
                      <button onClick={() => marcarPago(m.id)} className="text-verde text-xs hover:underline">Pagar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mensalidades.length === 0 && <div className="text-center py-10 text-texto-fraco">Nenhuma mensalidade</div>}
      </div>

      <Modal open={modalGerar} onClose={() => setModalGerar(false)} title="Gerar Mensalidades">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Referencia (mes)</label>
            <input type="month" value={referencia} onChange={(e) => setReferencia(e.target.value)}
              className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" />
            <p className="text-xs text-texto-fraco mt-1">Gera uma cobranca para cada assinante ativo</p>
          </div>
          <Button className="w-full" onClick={gerarMensalidades} disabled={gerando}>
            {gerando ? 'Gerando...' : 'Gerar'}
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
