import { useCallback, useRef, useState } from 'react';
import { useToast } from './useToast';

interface AcaoOpts {
  sucesso?: string;
  erro?: string;
}

/**
 * Trava ações (ex.: "Marcar pago") por chave enquanto a requisição roda.
 * - busy(chave): true enquanto a ação daquela chave está em andamento
 * - executar(chave, fn, opts): ignora clique duplo, faz try/catch e mostra toast
 *   de erro (e de sucesso, se informado). Retorna o resultado ou undefined se falhar.
 */
export function useAcao() {
  const { showToast } = useToast();
  const [rodando, setRodando] = useState<Record<string, boolean>>({});
  const ref = useRef<Record<string, boolean>>({});

  const busy = useCallback((chave?: string) => {
    if (chave === undefined) return Object.values(rodando).some(Boolean);
    return !!rodando[chave];
  }, [rodando]);

  const executar = useCallback(async <T,>(chave: string, fn: () => Promise<T>, opts?: AcaoOpts): Promise<T | undefined> => {
    if (ref.current[chave]) return undefined;
    ref.current[chave] = true;
    setRodando(prev => ({ ...prev, [chave]: true }));
    try {
      const r = await fn();
      if (opts?.sucesso) showToast(opts.sucesso, 'success');
      return r;
    } catch (e: any) {
      showToast(e?.message || opts?.erro || 'Erro ao executar ação', 'error');
      return undefined;
    } finally {
      delete ref.current[chave];
      setRodando(prev => {
        const n = { ...prev };
        delete n[chave];
        return n;
      });
    }
  }, [showToast]);

  return { busy, executar };
}
