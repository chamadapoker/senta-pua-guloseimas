import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { montarStatementsDoSchema } from './test/helpers/schema';

// Suíte de testes do Worker: roda o Worker de verdade no workerd (miniflare local), com D1 local
// isolado por teste. Nada aqui acessa a Cloudflare remota.
export default defineWorkersConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30_000,
    poolOptions: {
      workers: {
        singleWorker: true,
        // isolatedStorage do pool falha no Windows (arquivos -shm/-wal do SQLite); o reset por teste
        // é feito em test/setup.ts (resetarBanco)
        isolatedStorage: false,
        main: './src/index.ts',
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          // O pool exige nodejs_compat (só no ambiente de teste; o wrangler.toml de produção não muda)
          compatibilityFlags: ['nodejs_compat'],
          // Banco 100% local e descartável
          d1Databases: { DB: 'senta-pua-db-test' },
          r2Buckets: { IMAGES: 'senta-pua-images-test' },
          bindings: {
            JWT_SECRET: 'segredo-de-teste-nao-usar-em-producao',
            ADMIN_EMAIL: 'super@teste.local',
            ADMIN_SENHA: 'SenhaSuper123!',
            FRONTEND_URL: 'http://localhost:5173',
            AMBIENTE: 'test',
            // schema.sql + migrations 001..038 + saram, já quebrados em statements
            TEST_STMTS: montarStatementsDoSchema(),
          },
        },
      },
    },
  },
});
