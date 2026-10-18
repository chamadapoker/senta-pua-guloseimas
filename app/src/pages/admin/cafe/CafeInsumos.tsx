import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { inputClass } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';
import { Icon } from '../../../components/ui/Icon';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Loading } from '../../../components/ui/Loading';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoque: number;
  estoque_min: number;
}

export function CafeInsumos() {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [tipo, setTipo] = useState<'oficial' | 'graduado'>(() =>
    (localStorage.getItem('cafe_tipo') as 'oficial' | 'graduado') || 'graduado'
  );
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const fecharModal = useCallback(() => setModalAberto(false), []);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [estoque, setEstoque] = useState('0');
  const [estoqueMin, setEstoqueMin] = useState('0');

  useEffect(() => { localStorage.setItem('cafe_tipo', tipo); }, [tipo]);
  const carregar = () => {
    setCarregando(true);
    setErro('');
    return api.get<Insumo[]>(`/api/cafe/admin/insumos?tipo=${tipo}`)
      .then(setInsumos)
      .catch((e: any) => setErro(e?.message || 'Erro ao carregar insumos'))
      .finally(() => setCarregando(false));
  };
  useEffect(() => { carregar(); }, [tipo]);

  const abrirNovo = () => {
    setEditando(null);
    setNome(''); setUnidade('un'); setEstoque('0'); setEstoqueMin('0');
    setModalAberto(true);
  };

  const abrirEditar = (i: Insumo) => {
    setEditando(i);
    setNome(i.nome); setUnidade(i.unidade); setEstoque(String(i.estoque)); setEstoqueMin(String(i.estoque_min));
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    const data = { nome, unidade, estoque: parseFloat(estoque), estoque_min: parseFloat(estoqueMin), tipo };
    setSalvando(true);
    try {
      if (editando) {
        await api.put(`/api/cafe/admin/insumos/${editando.id}`, data);
      } else {
        await api.post('/api/cafe/admin/insumos', data);
      }
      setModalAberto(false);
      showToast(editando ? 'Insumo atualizado' : 'Insumo criado', 'success');
      carregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar insumo', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (i: Insumo) => {
    if (!(await confirm({ title: 'Excluir', message: `Excluir "${i.nome}"?`, confirmText: 'Excluir', danger: true }))) return;
    await api.delete(`/api/cafe/admin/insumos/${i.id}`);
    carregar();
  };

  const emAlerta = insumos.filter(i => i.estoque <= i.estoque_min).length;

  return (
    <AppLayout>
      <PageHeader
        title="Insumos do café"
        subtitle="Estoque de café, açúcar, copos e o mínimo de cada um."
        right={<Button size="sm" onClick={abrirNovo}><Icon name="plus" size={16} /> Novo insumo</Button>}
      />
      <div className="flex flex-wrap items-center gap-2 mb-5" role="group" aria-label="Sala do café">
        {(['oficial', 'graduado'] as const).map(t => (
          <Button key={t} size="sm" variant={tipo === t ? 'primary' : 'chip'} aria-pressed={tipo === t} onClick={() => setTipo(t)}>
            {t === 'oficial' ? 'Oficiais' : 'Graduados'}
          </Button>
        ))}
        {emAlerta > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-escarlate font-medium ml-1">
            <Icon name="warning" size={16} /> {emAlerta} {emAlerta === 1 ? 'item abaixo' : 'itens abaixo'} do mínimo
          </span>
        )}
      </div>

      {erro ? (
        <Card className="text-center py-10">
          <p className="text-escarlate text-sm mb-4">{erro}</p>
          <Button size="sm" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </Card>
      ) : carregando && insumos.length === 0 ? (
        <Loading label="Carregando insumos..." />
      ) : insumos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="coffee" size={24} />}
            message="Nenhum insumo cadastrado"
            hint="Cadastre os itens da sala para receber alerta quando estiverem acabando."
            action={<Button size="sm" onClick={abrirNovo}><Icon name="plus" size={16} /> Novo insumo</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insumos.map((i) => {
            const alerta = i.estoque <= i.estoque_min;
            return (
              <Card key={i.id} className={alerta ? '!border-red-300' : ''}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-noite min-w-0 break-words">{i.nome}</h3>
                  {alerta ? <Badge variant="danger">Abaixo do mínimo</Badge> : <Badge variant="success">Em dia</Badge>}
                </div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className={`font-display text-4xl leading-none tracking-wide ${alerta ? 'text-escarlate' : 'text-noite'}`}>{i.estoque.toLocaleString('pt-BR')}</span>
                  <span className="text-sm text-texto-fraco">{i.unidade}</span>
                </div>
                <p className="text-xs text-texto-fraco mb-3">Mínimo: {i.estoque_min.toLocaleString('pt-BR')} {i.unidade}</p>
                <div className="flex gap-2 pt-3 border-t border-borda">
                  <Button variant="chip-primary" size="sm" onClick={() => abrirEditar(i)}><Icon name="pencil" size={15} /> Editar</Button>
                  <Button variant="chip-danger" size="sm" onClick={() => excluir(i)} aria-label={`Excluir ${i.nome}`}><Icon name="trash" size={15} /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalAberto} onClose={fecharModal} title={editando ? 'Editar insumo' : 'Novo insumo'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label htmlFor="ci-nome" className="block text-sm font-medium mb-1.5">Nome</label>
            <input id="ci-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} required placeholder="Ex.: Café, açúcar, copos" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ci-un" className="block text-sm font-medium mb-1.5">Unidade</label>
              <select id="ci-un" value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputClass}>
                <option value="un">un</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
                <option value="pct">pct</option>
                <option value="cx">cx</option>
              </select>
            </div>
            <div>
              <label htmlFor="ci-est" className="block text-sm font-medium mb-1.5">Estoque atual</label>
              <input id="ci-est" type="number" step="0.01" inputMode="decimal" value={estoque} onChange={(e) => setEstoque(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="ci-min" className="block text-sm font-medium mb-1.5">Estoque mínimo</label>
              <input id="ci-min" type="number" step="0.01" inputMode="decimal" value={estoqueMin} onChange={(e) => setEstoqueMin(e.target.value)} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-texto-fraco">Quando o estoque chegar ao mínimo, o item aparece em alerta.</p>
          <Button type="submit" className="w-full" disabled={salvando}>{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar insumo'}</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
