import { useCallback, useState } from 'react';
import { Modal } from '../components/ui/Modal';

// Copia texto para a área de transferência. Se o navegador bloquear
// (http, permissão negada, WebView antigo), abre um campo com o texto
// para o usuário copiar manualmente.
export function useCopiar() {
  const [manual, setManual] = useState<string | null>(null);

  const copiar = useCallback(async (texto: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      setManual(texto);
      return false;
    }
  }, []);

  const modalCopiaManual = (
    <Modal open={manual !== null} onClose={() => setManual(null)} title="COPIE MANUALMENTE">
      <p className="text-sm text-texto-fraco mb-3">
        Não foi possível copiar automaticamente. Toque no campo, selecione todo o texto e copie.
      </p>
      <textarea
        readOnly
        value={manual ?? ''}
        rows={5}
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.currentTarget.select()}
        className="w-full text-xs font-mono break-all bg-fundo border border-borda rounded-xl p-3 resize-none"
      />
    </Modal>
  );

  return { copiar, modalCopiaManual };
}
