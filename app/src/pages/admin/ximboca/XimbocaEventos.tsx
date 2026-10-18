import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../../components/AppLayout';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { inputClass } from '../../../components/ui/Field';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Menu } from '../../../components/ui/Menu';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Icon } from '../../../components/ui/Icon';
import { api } from '../../../services/api';
import { useConfirm } from '../../../hooks/useConfirm';

interface Evento {
  id: string;
  nome: string;
  data: string;
  valor_por_pessoa: number;
  valor_cerveja: number | null;
  valor_refri: number | null;
  descricao: string;
  status: string;
  inscricao_ate: string | null;
  pix_chave: string | null;
  pix_tipo: string | null;
  pix_nome: string | null;
  pix_whatsapp: string | null;
  total_participantes: number;
  total_pagos: number;
  total_arrecadado: number;
  total_despesas: number;
}

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataEvento = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export function XimbocaEventos() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [inscricaoAte, setInscricaoAte] = useState('');
  const [valorPessoa, setValorPessoa] = useState('');
  const [valorCerveja, setValorCerveja] = useState('');
  const [valorRefri, setValorRefri] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pixChave, setPixChave] = useState('');
  const [pixTipo, setPixTipo] = useState('aleatoria');
  const [pixNome, setPixNome] = useState('');
  const [pixWhatsapp, setPixWhatsapp] = useState('');

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = () => {
    setErro('');
    return api.get<Evento[]>('/api/ximboca/eventos')
      .then(setEventos)
      .catch((e: any) => setErro(e?.message || 'Não foi possível carregar os eventos.'))
      .finally(() => setCarregando(false));
  };
  useEffect(() => { carregar(); }, []);

  const limparForm = () => {
    setEditando(null);
    setNome(''); setData(''); setInscricaoAte(''); setValorPessoa('');
    setValorCerveja(''); setValorRefri(''); setDescricao('');
    setPixChave(''); setPixTipo('aleatoria'); setPixNome(''); setPixWhatsapp('');
  };
  // Estável: o Modal refaz o foco quando onClose muda
  const fecharModal = useCallback(() => { setModalAberto(false); limparForm(); }, []);

  const abrirEditar = (ev: Evento) => {
    setEditando(ev);
    setNome(ev.nome);
    setData(ev.data);
    setInscricaoAte(ev.inscricao_ate || '');
    setValorPessoa(ev.valor_por_pessoa?.toString() || '');
    setValorCerveja(ev.valor_cerveja !== null ? ev.valor_cerveja.toString() : '');
    setValorRefri(ev.valor_refri !== null ? ev.valor_refri.toString() : '');
    setDescricao(ev.descricao || '');
    setPixChave(ev.pix_chave || '');
    setPixTipo(ev.pix_tipo || 'aleatoria');
    setPixNome(ev.pix_nome || '');
    setPixWhatsapp(ev.pix_whatsapp || '');
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
      inscricao_ate: inscricaoAte || null,
      valor_por_pessoa: parseFloat(valorPessoa) || 0,
      valor_cerveja: valorCerveja ? parseFloat(valorCerveja) : null,
      valor_refri: valorRefri ? parseFloat(valorRefri) : null,
      descricao,
      pix_chave: pixChave.trim() || null,
      pix_tipo: pixChave.trim() ? pixTipo : null,
      pix_nome: pixNome.trim() || null,
      pix_whatsapp: pixWhatsapp.replace(/\D/g, '') || null,
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
    if (!(await confirm({ message: `Excluir "${ev.nome}"? Todos os participantes e despesas serão apagados.`, confirmText: 'Excluir', danger: true }))) return;
    await api.delete(`/api/ximboca/eventos/${ev.id}`);
    carregar();
  };

  const toggleStatus = async (ev: Evento) => {
    await api.put(`/api/ximboca/eventos/${ev.id}`, { status: ev.status === 'aberto' ? 'fechado' : 'aberto' });
    carregar();
  };

  return (
    <AppLayout>
      <PageHeader
        title="Eventos da Ximboca"
        subtitle="Crie eventos, acompanhe inscrições e o saldo de cada um."
        right={<Button size="sm" onClick={abrirCriar}><Icon name="plus" size={16} />Novo evento</Button>}
      />

      {carregando ? <Loading /> : erro ? (
        <Card size="lg" className="text-center">
          <p className="text-escarlate text-sm mb-4">{erro}</p>
          <Button variant="ghost" size="sm" onClick={() => { setCarregando(true); carregar(); }}><Icon name="refresh" size={16} />Tentar de novo</Button>
        </Card>
      ) : eventos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="cutlery" size={24} />}
            message="Nenhum evento criado"
            hint="Crie um evento para abrir as inscrições e controlar pagamentos e despesas."
            action={<Button size="sm" onClick={abrirCriar}><Icon name="plus" size={16} />Novo evento</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {eventos.map(ev => {
            const saldo = ev.total_arrecadado - ev.total_despesas;
            return (
              <Card key={ev.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-noite break-words">{ev.nome}</h3>
                      <Badge variant={ev.status === 'aberto' ? 'success' : 'neutral'}>{ev.status === 'aberto' ? 'Aberto' : 'Fechado'}</Badge>
                    </div>
                    <p className="text-xs text-texto-fraco mt-0.5">
                      {dataEvento(ev.data)}
                      {ev.inscricao_ate && <> · inscrições até {dataEvento(ev.inscricao_ate)}</>}
                    </p>
                  </div>
                  <Menu label={`Ações de ${ev.nome}`} items={[
                    { label: 'Editar', icon: 'pencil', onClick: () => abrirEditar(ev) },
                    { label: ev.status === 'aberto' ? 'Fechar evento' : 'Reabrir', icon: ev.status === 'aberto' ? 'x' : 'refresh', onClick: () => toggleStatus(ev) },
                    { label: 'Excluir', icon: 'trash', danger: true, onClick: () => excluir(ev) },
                  ]} />
                </div>
                {ev.descricao && <p className="text-sm text-texto-fraco mb-3">{ev.descricao}</p>}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <div className="bg-fundo rounded-xl px-3 py-2 min-w-0">
                    <dt className="text-xs text-texto-fraco">Pagos</dt>
                    <dd className="font-display text-xl leading-tight text-azul truncate">{ev.total_pagos}/{ev.total_participantes}</dd>
                  </div>
                  <div className="bg-fundo rounded-xl px-3 py-2 min-w-0">
                    <dt className="text-xs text-texto-fraco">Por pessoa</dt>
                    <dd className="font-display text-xl leading-tight text-dourado truncate">{brl(ev.valor_por_pessoa)}</dd>
                  </div>
                  <div className="bg-fundo rounded-xl px-3 py-2 min-w-0">
                    <dt className="text-xs text-texto-fraco">Gasto</dt>
                    <dd className="font-display text-xl leading-tight text-escarlate truncate">{brl(ev.total_despesas)}</dd>
                  </div>
                  <div className="bg-fundo rounded-xl px-3 py-2 min-w-0">
                    <dt className="text-xs text-texto-fraco">Saldo</dt>
                    <dd className={`font-display text-xl leading-tight truncate ${saldo >= 0 ? 'text-verde-escuro' : 'text-escarlate'}`}>{brl(saldo)}</dd>
                  </div>
                </dl>
                <div className="mt-auto">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate(`/admin/ximboca/eventos/${ev.id}`)}>
                    Gerenciar evento<Icon name="chevron-right" size={16} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalAberto} onClose={fecharModal} title={editando ? 'Editar evento' : 'Novo evento'} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome do evento</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className={inputClass} required placeholder="Ex.: Churrasco de aniversário" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Data do evento</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Inscrições até</label>
              <input type="date" value={inscricaoAte} onChange={e => setInscricaoAte(e.target.value)} className={inputClass} />
              <p className="text-xs text-texto-fraco mt-1">Deixe vazio para não ter prazo.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valor por pessoa (R$)</label>
            <input type="number" step="0.01" value={valorPessoa} onChange={e => setValorPessoa(e.target.value)} className={inputClass} placeholder="0,00" inputMode="decimal" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Valor com cerveja (opcional)</label>
              <input type="number" step="0.01" value={valorCerveja} onChange={e => setValorCerveja(e.target.value)} className={inputClass} placeholder="Vazio = não oferecer" inputMode="decimal" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor com refri (opcional)</label>
              <input type="number" step="0.01" value={valorRefri} onChange={e => setValorRefri(e.target.value)} className={inputClass} placeholder="Vazio = não oferecer" inputMode="decimal" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className={inputClass} placeholder="Opcional" />
          </div>
          <p className="text-xs text-texto-fraco">
            Se preencher Cerveja ou Refri, o participante poderá escolher entre essas opções. Caso contrário, usa o valor padrão.
          </p>

          <div className="border-t border-borda pt-3 space-y-3">
            <p className="text-sm font-semibold text-noite">PIX do responsável <span className="font-normal text-texto-fraco">(opcional)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo da chave</label>
                <select value={pixTipo} onChange={e => setPixTipo(e.target.value)} className={inputClass}>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Chave aleatória</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Chave PIX</label>
                <input value={pixChave} onChange={e => setPixChave(e.target.value)} className={inputClass} placeholder="Digite a chave" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nome do recebedor</label>
              <input value={pixNome} onChange={e => setPixNome(e.target.value)} className={inputClass} placeholder="Ex.: JOAO SILVA" />
              <p className="text-xs text-texto-fraco mt-1">Sem acento, até 25 letras.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp (comprovante)</label>
              <input type="tel" value={pixWhatsapp} onChange={e => setPixWhatsapp(e.target.value.replace(/\D/g, ''))} className={inputClass} placeholder="Ex.: 62999998888" />
            </div>
          </div>

          <Button type="submit" className="w-full">{editando ? 'Salvar alterações' : 'Criar evento'}</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
