// Banco de teste (D1 local, dentro do Worker).
//
// montarBanco: aplica schema.sql + migrations 001..038 + saram, statement a statement.
//   001 e 007 adicionam colunas que o schema.sql já tem: só "duplicate column name" é ignorado;
//   qualquer outro erro derruba a suíte (schema quebrado tem de aparecer).
//   Ao final tira um "retrato" de cada tabela (_snap_<tabela>) com os dados de seed.
//
// resetarBanco: antes de CADA teste, apaga tudo e restaura o retrato (estado recém-migrado).
//   Usado no lugar do isolatedStorage do pool, que no Windows falha com os arquivos -shm/-wal
//   do SQLite ("Failed to pop isolated storage stack frame").

const MARCADOR = '_schema_teste_ok';
const PREFIXO_SNAP = '_snap_';

async function tabelasDeDados(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name NOT LIKE 'd1_%'
       AND name NOT LIKE '${PREFIXO_SNAP}%' AND name != '${MARCADOR}'`,
    )
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

export async function montarBanco(db: D1Database, stmts: string[]): Promise<void> {
  const pronto = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(MARCADOR)
    .first();
  if (pronto) return;

  for (const sql of stmts) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/duplicate column name/i.test(msg)) continue;
      throw new Error(`Falha ao montar o banco de teste no statement:\n${sql}\n-> ${msg}`);
    }
  }

  const tabelas = await tabelasDeDados(db);
  await db.batch(tabelas.map((t) => db.prepare(`CREATE TABLE "${PREFIXO_SNAP}${t}" AS SELECT * FROM "${t}"`)));
  await db.prepare(`CREATE TABLE ${MARCADOR} (id INTEGER)`).run();
}

export async function resetarBanco(db: D1Database): Promise<void> {
  const tabelas = await tabelasDeDados(db);
  const temSeq = await db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'").first();
  // Um batch = uma transação; defer_foreign_keys deixa apagar/recriar em qualquer ordem
  await db.batch([
    db.prepare('PRAGMA defer_foreign_keys = on'),
    ...tabelas.map((t) => db.prepare(`DELETE FROM "${t}"`)),
    ...(temSeq ? [db.prepare('DELETE FROM sqlite_sequence')] : []),
    ...tabelas.map((t) => db.prepare(`INSERT INTO "${t}" SELECT * FROM "${PREFIXO_SNAP}${t}"`)),
  ]);
}
