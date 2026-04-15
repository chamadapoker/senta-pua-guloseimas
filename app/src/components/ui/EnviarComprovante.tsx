import { useRef, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
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

  const abrir = () => { setMsg(''); setFile(null); setObservacao(''); setModal(true); };

  const enviar = async () => {
    if (!file) { setMsg('Selecione um arquivo'); return; }
    setLoading(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('origem', origem);
      fd.append('referencia_id', referenciaId);
      fd.append('observacao', observacao);
      fd.append('file', file);
      await api.upload('/api/comprovantes', fd);
      setMsg('Comprovante enviado! Aguarde aprovação.');
      setTimeout(() => { setModal(false); onEnviado?.(); }, 1500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao enviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="primary" size={size} onClick={abrir}><Icon name="paper-clip" size={14} className="mr-1.5" /> Anexar Comprovante</Button>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !loading && setModal(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg text-azul mb-3">Enviar Comprovante</h3>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-borda rounded-xl p-6 text-center hover:border-azul transition-colors mb-3"
            >
              {file ? (
                <div>
                  <div className="text-sm font-medium text-texto">{file.name}</div>
                  <div className="text-xs text-texto-fraco mt-1">{(file.size / 1024).toFixed(0)} KB</div>
                </div>
              ) : (
                <div>
                  <div className="text-texto-fraco mb-1 flex justify-center"><Icon name="upload" size={32} /></div>
                  <div className="text-sm text-texto-fraco">Toque para selecionar foto ou PDF</div>
                  <div className="text-[10px] text-texto-fraco mt-1">Máx 5MB · JPG, PNG, WEBP, PDF</div>
                </div>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={2}
              className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm mb-3"
              placeholder="Observação (opcional)"
            />

            {msg && <p className={`text-xs rounded-lg px-3 py-2 mb-3 ${msg.includes('enviado') ? 'text-verde bg-green-50 border border-green-200' : 'text-vermelho bg-red-50 border border-red-200'}`}>{msg}</p>}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setModal(false)} disabled={loading}>Cancelar</Button>
              <Button onClick={enviar} disabled={loading || !file}>
                {loading ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
