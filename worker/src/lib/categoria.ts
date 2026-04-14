export type Categoria = 'oficial' | 'graduado' | 'praca';
export type SalaCafe = 'oficiais' | 'graduados' | null;

export const CATEGORIAS_VALIDAS: Categoria[] = ['oficial', 'graduado', 'praca'];

export function isCategoriaValida(v: unknown): v is Categoria {
  return typeof v === 'string' && (CATEGORIAS_VALIDAS as string[]).includes(v);
}

export function derivarSalaCafe(categoria: Categoria): SalaCafe {
  if (categoria === 'oficial') return 'oficiais';
  if (categoria === 'graduado') return 'graduados';
  return null;
}
