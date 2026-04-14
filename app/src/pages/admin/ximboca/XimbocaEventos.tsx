import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../../components/AppLayout';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';

interface Evento {
  id: string;
  nome: string;
  data: string;
  valor_por_pessoa: number;
  valor_cerveja: number | null;
  valor_refri: number | null;
  descricao: string;
  status: string;
  total_participantes: number;
  total_pagos: number;
  total_arrecadado: number;
  total_despesas: number;
}

export function XimbocaEventos() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [valorPessoa, setValorPessoa] = useState('');
  const [valorCerveja, setValorCerveja] = useState('');
  const [valorRefri, setValorRefri] = useState('');
  const [descricao, setDescricao] = useState('');

  const carregar = () => api.get<Evento[]>('/api/ximboca/eventos').then(setEventos);
  useEffect(() => { carregar(); }, []);

  const limparForm = () => {
    setEditando(null);
    setNome(''); setData(''); setValorPessoa('');
    setValorCerveja(''); setValorRefri(''); setDescricao('');
  };

  const abrirEditar = (ev: Evento) => {
    setEditando(ev);
    setNome(ev.nome);
    setData(ev.data);
    setValorPessoa(ev.valor_por_pessoa?.toString() || '');
    setValorCerveja(ev.valor_cerveja !== null ? ev.valor_cerveja.toString() : '');
    setValorRefri(ev.valor_refri !== null ? ev.valor_refri.toString() : '');
    setDescricao(ev.descricao || '');
    setModalAberto(true);
  };

  const abrirCriar = () => {
    limparForm();
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      nome, data,
      valor_por_pessoa: parseFloat(valorPessoa) || 0,
      valor_cerveja: valorCerveja ? parseFloat(valorCerveja) : null,
      valor_refri: valorRefri ? parseFloat(valorRefri) : null,
      descricao,
    };
    if (editando) {
      await api.put(`/api/ximboca/eventos/${editando.id}`, body);
    } else {
      await api.post('/api/ximboca/eventos', body);
    }
    setModalAberto(false);
    limparForm();
    carregar();
  };

  const excluir = async (ev: Evento) => {
    if (!confirm(`Excluir "${ev.nome}"? Todos os participantes e despesas serao apagados.`)) return;
    await api.delete(`/api/ximboca/eventos/${ev.id}`);
    carregar();
  };

  const toggleStatus = async (ev: Evento) => {
    await api.put(`/api/ximboca/eventos/${ev.id}`, { status: ev.status === 'aberto' ? 'fechado' : 'aberto' });
    carregar();
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-azul tracking-wider">EVENTOS</h1>
        <Button size="sm" onClick={abrirCriar}>+ Novo Evento</Button>
      </div>

      <div className="space-y-3">
        {eventos.map(ev => {
          const arrecadado = ev.total_arrecadado;
          const saldo = arrecadado - ev.total_despesas;
          return (
            <div key={ev.id} className="bg-white rounded-xl border border-borda shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-texto">{ev.nome}</h3>
                    <Badge variant={ev.status === 'aberto' ? 'success' : 'warning'}>{ev.status === 'aberto' ? 'Aberto' : 'Fechado'}</Badge>
                  </div>
                  <span className="text-xs text-texto-fraco">{new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                </div>
                {ev.descricao && <p className="text-xs text-texto-fraco mb-2">{ev.descricao}</p>}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                  <div className="bg-fundo rounded-lg p-2 text-center">
                    <div className="text-texto-fraco">Participantes</div>
                    <div className="font-bold text-azul">{ev.total_pagos}/{ev.total_participantes}</div>
                  </div>
                  <div className="bg-fundo rounded-lg p-2 text-center">
                    <div className="text-texto-fraco">R$/pessoa</div>
                    <div className="font-bold">R$ {ev.valor_por_pessoa.toFixed(2)}</div>
                  </div>
                  <div className="bg-fundo rounded-lg p-2 text-center">
                    <div className="text-texto-fraco">Gasto</div>
                    <div className="font-bold text-vermelho">R$ {ev.total_despesas.toFixed(2)}</div>
                  </div>
                  <div className="bg-fundo rounded-lg p-2 text-center">
                    <div className="text-texto-fraco">Saldo</div>
                    <div className={`font-bold ${saldo >= 0 ? 'text-verde' : 'text-vermelho'}`}>R$ {saldo.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link to={`/admin/ximboca/eventos/${ev.id}`} className="text-xs font-medium px-3 py-1.5 rounded-lg text-azul bg-blue-50 border border-blue-200 hover:bg-blue-100">Gerenciar</Link>
                  <button onClick={() => abrirEditar(ev)} className="text-xs font-medium px-3 py-1.5 rounded-lg text-texto bg-fundo border border-borda hover:bg-gray-200">Editar</button>
                  <button onClick={() => toggleStatus(ev)} className="text-xs font-medium px-3 py-1.5 rounded-lg text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100">
                    {ev.status === 'aberto' ? 'Fechar' : 'Reabrir'}
                  </button>
                  <button onClick={() => excluir(ev)} className="text-xs font-medium px-3 py-1.5 rounded-lg text-vermelho bg-red-50 border border-red-200 hover:bg-red-100">Excluir</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {eventos.length === 0 && <div className="text-center py-12 text-gray-400">Nenhum evento criado</div>}

      <Modal open={modalAberto} onClose={() => { setModalAberto(false); limparForm(); }} title={editando ? 'Editar Evento' : 'Novo Evento'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome do evento</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required placeholder="Ex: Churrasco de Aniversario" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor por pessoa (R$)</label>
              <input type="number" step="0.01" value={valorPessoa} onChange={e => setValorPessoa(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">🍺 Cerveja (opcional)</label>
              <input type="number" step="0.01" value={valorCerveja} onChange={e => setValorCerveja(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" placeholder="Deixe vazio pra não oferecer" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">🥤 Refri (opcional)</label>
              <input type="number" step="0.01" value={valorRefri} onChange={e => setValorRefri(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" placeholder="Deixe vazio pra não oferecer" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descricao</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" placeholder="Opcional" />
          </div>
          <p className="text-xs text-texto-fraco">
            Se preencher Cerveja ou Refri, o participante poderá escolher entre essas opções. Caso contrário, usa o valor padrão.
          </p>
          <Button type="submit" className="w-full">{editando ? 'Salvar Alterações' : 'Criar Evento'}</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
