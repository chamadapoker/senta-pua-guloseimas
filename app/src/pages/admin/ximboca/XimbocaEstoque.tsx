import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Field, inputClass } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Icon } from '../../../components/ui/Icon';
import { api } from '../../../services/api';
import { useConfirm } from '../../../hooks/useConfirm';

interface ItemEstoque {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  origem_evento: string | null;
}

export function XimbocaEstoque() {
  const confirm = useConfirm();
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const fecharModalAberto = useCallback(() => setModalAberto(false), []);
  const [editando, setEditando] = useState<ItemEstoque | null>(null);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('0');
  const [unidade, setUnidade] = useState('un');
  const [origem, setOrigem] = useState('');

  const carregar = () => {
    setErro('');
    return api.get<ItemEstoque[]>('/api/ximboca/estoque')
      .then(setItens)
      .catch((e: any) => setErro(e?.message || 'Não foi possível carregar o estoque.'))
      .finally(() => setCarregando(false));
  };
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setEditando(null); setNome(''); setQuantidade('0'); setUnidade('un'); setOrigem(''); setModalAberto(true); };
  const abrirEditar = (i: ItemEstoque) => { setEditando(i); setNome(i.nome); setQuantidade(String(i.quantidade)); setUnidade(i.unidade); setOrigem(i.origem_evento || ''); setModalAberto(true); };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { nome, quantidade: parseFloat(quantidade), unidade, origem_evento: origem || null };
    if (editando) await api.put(`/api/ximboca/estoque/${editando.id}`, data);
    else await api.post('/api/ximboca/estoque', data);
    setModalAberto(false);
    carregar();
  };

  const excluir = async (i: ItemEstoque) => {
    if (!(await confirm({ message: `Excluir "${i.nome}" do estoque?`, confirmText: 'Excluir', danger: true }))) return;
    await api.delete(`/api/ximboca/estoque/${i.id}`);
    carregar();
  };

  return (
    <AppLayout>
      <PageHeader
        title="Estoque da Ximboca"
        subtitle="Itens guardados para os próximos eventos, incluindo sobras."
        right={<Button size="sm" onClick={abrirNovo}><Icon name="plus" size={16} />Adicionar item</Button>}
      />

      {carregando ? <Loading /> : erro ? (
        <Card size="lg" className="text-center">
          <p className="text-escarlate text-sm mb-4">{erro}</p>
          <Button variant="ghost" size="sm" onClick={() => { setCarregando(true); carregar(); }}><Icon name="refresh" size={16} />Tentar de novo</Button>
        </Card>
      ) : itens.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="archive" size={24} />}
            message="Nenhum item em estoque"
            hint="Cadastre carvão, bebidas ou descartáveis que sobraram de um evento."
            action={<Button size="sm" onClick={abrirNovo}><Icon name="plus" size={16} />Adicionar item</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {itens.map(i => (
            <Card key={i.id} className="flex flex-col">
              <h3 className="font-semibold text-noite mb-2 break-words">{i.nome}</h3>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="font-display text-3xl leading-none text-azul">{i.quantidade.toLocaleString('pt-BR')}</span>
                <span className="text-sm text-texto-fraco">{i.unidade}</span>
              </div>
              <p className="text-xs text-texto-fraco min-h-[1rem]">{i.origem_evento ? `Sobra de ${i.origem_evento}` : ''}</p>
              <div className="flex gap-2 mt-3 pt-3 border-t border-borda">
                <Button variant="chip-primary" size="sm" className="flex-1" onClick={() => abrirEditar(i)}><Icon name="pencil" size={15} />Editar</Button>
                <Button variant="chip-danger" size="sm" onClick={() => excluir(i)} aria-label={`Excluir ${i.nome}`}><Icon name="trash" size={15} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalAberto} onClose={fecharModalAberto} title={editando ? 'Editar item' : 'Novo item'}>
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Nome">
            <input value={nome} onChange={e => setNome(e.target.value)} className={inputClass} required placeholder="Ex.: carvão, cerveja, copo" aria-label="Nome" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade">
              <input type="number" step="0.01" inputMode="decimal" value={quantidade} onChange={e => setQuantidade(e.target.value)} className={inputClass} aria-label="Quantidade" />
            </Field>
            <Field label="Unidade">
              <select value={unidade} onChange={e => setUnidade(e.target.value)} className={inputClass} aria-label="Unidade">
                <option value="un">un</option>
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="fardo">fardo</option>
                <option value="pct">pct</option>
                <option value="cx">cx</option>
                <option value="saco">saco</option>
              </select>
            </Field>
          </div>
          <Field label="Sobra de qual evento" hint="Opcional.">
            <input value={origem} onChange={e => setOrigem(e.target.value)} className={inputClass} placeholder="Ex.: Churrasco de abril" aria-label="Sobra de qual evento" />
          </Field>
          <Button type="submit" className="w-full">{editando ? 'Salvar alterações' : 'Adicionar item'}</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
