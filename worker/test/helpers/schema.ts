// Roda no Node (dentro do vitest.config): lê schema.sql + migrations e devolve a lista de statements
// na ordem em que o banco de produção foi montado. O setup.ts (dentro do Worker) aplica essa lista no D1.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizWorker = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dirDb = join(raizWorker, 'src', 'db');

// Colunas que existem em produção mas não têm migration
const EXTRAS_PRODUCAO = ['ALTER TABLE clientes ADD COLUMN saram TEXT'];

/** Remove comentários "-- ..." e quebra em statements por ";" (nenhum arquivo tem trigger/BEGIN...END). */
export function quebrarSql(sql: string): string[] {
  return sql
    .split('\n')
    .map((linha) => linha.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function montarStatementsDoSchema(): string[] {
  const stmts = quebrarSql(readFileSync(join(dirDb, 'schema.sql'), 'utf8'));
  const migrations = readdirSync(join(dirDb, 'migrations'))
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
  for (const f of migrations) {
    stmts.push(...quebrarSql(readFileSync(join(dirDb, 'migrations', f), 'utf8')));
  }
  stmts.push(...EXTRAS_PRODUCAO);
  return stmts;
}
