// Monta o banco de teste (D1 local) uma vez e, antes de cada teste, volta ao estado recém-migrado.
import { env } from 'cloudflare:test';
import { beforeEach } from 'vitest';
import { montarBanco, resetarBanco } from './helpers/db';

await montarBanco(env.DB, env.TEST_STMTS);

beforeEach(async () => {
  await resetarBanco(env.DB);
});
