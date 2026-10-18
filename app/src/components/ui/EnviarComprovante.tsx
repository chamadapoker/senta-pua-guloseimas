import { useCallback, useId, useRef, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { api } from '../../services/api';

interface EnviarComprovanteProps {
  origem: 'cantina' | 'loja' | 'loja_parcela' | 'cafe' | 'ximboca';
  referenciaId: string;
  onEnviado?: () => void;
  size?: 'sm' | 'md';
}

export function EnviarComprovante({ origem, referenciaId, onEnviado, size = 'sm' }: EnviarComprovanteProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [observacao, setObservacao] = useState('');
  const [modal, setModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [enviado, setEnviado] = useState(false);
  // Callback estável para o Modal (ele refaz o foco quando onClose muda)
  const loadingRef = useRef(false);
  loadingRef.current = loading;
  const fechar = useCallback(() => { if (!loadingRef.current) setModal(false); }, []);
  const obsId = useId();

  const abrir = () => { setMsg(''); setEnviado(false); setFile(null); setObservacao(''); setModal(true); };

  const enviar = async () => {
    if (!file) { setMsg('Selecione um arquivo'); return; }
    setLoading(true);
    setMsg('');
    setEnviado(false);
    try {
      const fd = new FormData();
      fd.append('origem', origem);
      fd.append('referencia_id', referenciaId);
      fd.append('observacao', observacao);
      fd.append('file', file);
      await api.upload('/api/comprovantes', fd);
      setEnviado(true);
      setMsg('Comprovante enviado. Agora é só aguardar a conferência.');
      setTimeout(() => { setModal(false); onEnviado?.(); }, 1500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao enviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="primary" size={size} onClick={abrir}>
        <Icon name="paper-clip" size={16} /> Enviar comprovante
      </Button>

      <Modal open={modal} onClose={fechar} title="Enviar comprovante">
        <p className="text-sm text-texto-fraco mb-3">Anexe o print ou o PDF do comprovante do banco.</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-xl p-6 text-center transition-colors mb-4 outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${file ? 'border-azul bg-blue-50/40' : 'border-borda hover:border-azul'}`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3 text-left">
              <Icon name="document" size={28} className="text-azul" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-texto truncate">{file.name}</div>
                <div className="text-xs text-texto-fraco mt-0.5">{(file.size / 1024).toFixed(0)} KB · toque para trocar</div>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-texto-fraco mb-2 flex justify-center"><Icon name="upload" size={32} /></div>
              <div className="text-sm font-medium text-texto">Escolher foto ou PDF</div>
              <div className="text-xs text-texto-fraco mt-1">Até 5 MB · JPG, PNG, WEBP ou PDF</div>
            </div>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={e => {
            const f = e.target.files?.[0] || null;
            if (f) {
              const tipoOk = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type)
                || /\.(jpe?g|png|webp|pdf)$/i.test(f.name);
              if (!tipoOk) { setMsg('Formato inválido. Use JPG, PNG, WEBP ou PDF'); setFile(null); return; }
              if (f.size > 5 * 1024 * 1024) { setMsg('Arquivo muito grande (máx. 5 MB)'); setFile(null); return; }
            }
            setMsg('');
            setFile(f);
          }}
          className="hidden"
        />

        <label htmlFor={obsId} className="block text-sm font-medium mb-1.5">Observação <span className="text-texto-fraco font-normal">(opcional)</span></label>
        <textarea
          id={obsId}
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          rows={2}
          className="w-full bg-white border border-borda rounded-xl px-3.5 py-2.5 text-base sm:text-sm mb-4 outline-none focus:ring-2 focus:ring-azul/20"
          placeholder="Ex.: paguei junto com o pedido de ontem"
        />

        {msg && (
          <p role={enviado ? 'status' : 'alert'} className={`text-sm rounded-xl px-3 py-2 mb-4 ${enviado ? 'text-verde-escuro bg-green-50 border border-green-200' : 'text-vermelho bg-red-50 border border-red-200'}`}>
            {msg}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={fechar} disabled={loading}>Cancelar</Button>
          <Button onClick={enviar} disabled={loading || !file || enviado}>
            {loading ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
