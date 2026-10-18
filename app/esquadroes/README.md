# Esquadrões (white-label)

Cada arquivo `<id>.json` desta pasta é a identidade de um esquadrão: nome, sigla, lema,
cores do brasão, imagens, rodapé, nomes padrão das salas do café, frases temáticas e áreas.
O build escolhe o arquivo pela variável `VITE_ESQUADRAO` (padrão: `senta-pua`).

```bash
npm run build                          # senta-pua (padrão)
VITE_ESQUADRAO=exemplo npm run build   # bash
$env:VITE_ESQUADRAO='exemplo'; npm run build   # PowerShell
```

Se o arquivo não existir, o build falha listando os esquadrões disponíveis.

## Criar um esquadrão novo

1. Copie `senta-pua.json` para `<id>.json` (id: letras minúsculas, números e hífen) e troque `"id"`.
2. Edite os textos, as cores (`cores.*`, usadas pelo Tailwind e pelo `theme-color`/manifest) e as
   frases. O formato completo, comentado, está em `tipo.ts`.
3. Coloque as imagens em `app/public/` e aponte `imagens.brasao` (96 px), `imagens.brasao_grande`
   (192 px), `imagens.logo` (ícone do PWA, 512 px) e `imagens.og_image` (URL absoluta para prévias
   de link) para elas.
4. `areas` já existe no config (`ESQUADRAO.areas`), mas nesta etapa ainda não esconde telas.
5. Rode o build com `VITE_ESQUADRAO=<id>`.

## Onde cada coisa é usada

- `index.html`: placeholders `{{ESQ_*}}` preenchidos no build (`vite.config.ts`).
- `manifest.json`: gerado a partir do config (dev e build); não existe mais em `public/`.
- `public/sw.js`: `__ESQUADRAO_ID__` vira o id no nome do cache durante o build.
- App: `src/config/esquadrao.ts` (`ESQUADRAO`), injetado via `__ESQUADRAO__`.

## Servidor

O worker (`worker/`) usa os **mesmos** arquivos `<id>.json`: `worker/src/lib/esquadrao.ts` importa os
JSON no bundle e escolhe o esquadrão pela variável `ESQUADRAO` do ambiente (`[vars]` do
`wrangler.toml`; padrão `senta-pua`; id desconhecido cai no `senta-pua` com aviso no console).
Do config o servidor usa:

- `url_app`: origem permitida no CORS (além de `FRONTEND_URL` e `http://localhost:5173`).
- `servidor.mensalidade_cafe` / `servidor.anuidade_cafe`: frases das notificações do cron.
- `servidor.aniversario_notificacao`: notificação "FELIZ ANIVERSÁRIO!" do cron.
- `servidor.aniversario_homenagem`: texto padrão da homenagem no painel do militar.
- `servidor.lembrete_cafe_pendente`: aviso do dia 10 (marcadores `{qtd}`, `{cobrancas}`, `{total}`).

Cada esquadrão é um deploy separado: worker, banco D1, bucket R2, segredos e projeto do Pages
próprios. O ambiente padrão do `wrangler.toml` é o Senta Pua em produção; não mexa nele.

### Colocar um esquadrão novo no ar

Exemplo com o id `exemplo`; troque pelo seu. Comandos rodados em `worker/`.

1. **Config**: crie `app/esquadroes/<id>.json` (veja "Criar um esquadrão novo") e acrescente o
   import dele no mapa `ESQUADROES` de `worker/src/lib/esquadrao.ts`.
2. **Banco e bucket**:
   ```bash
   npx wrangler d1 create exemplo-db           # anote o database_id que ele devolve
   npx wrangler r2 bucket create exemplo-images
   ```
3. **Ambiente no `wrangler.toml`**: descomente/copie o bloco `[env.exemplo]` do final do arquivo e
   preencha `name`, `database_name`, `database_id`, `bucket_name` e `ESQUADRAO = "<id>"`.
   `[vars]` e `[triggers]` não são herdados pelos ambientes: repita `AMBIENTE`, `ESQUADRAO` e o cron.
4. **Schema no banco novo** (`--env exemplo --remote` só depois de conferir que é o banco certo):
   ```bash
   npx wrangler d1 execute exemplo-db --env exemplo --remote --file=src/db/schema.sql
   # migrations em ordem (001..038). Pule 001 e 007: as colunas já estão no schema.sql
   for f in src/db/migrations/0*.sql; do
     case "$f" in *001_*|*007_*) continue;; esac
     npx wrangler d1 execute exemplo-db --env exemplo --remote --file="$f" || break
   done
   # coluna que existe em produção sem migration (a suíte de testes também aplica)
   npx wrangler d1 execute exemplo-db --env exemplo --remote --command="ALTER TABLE clientes ADD COLUMN saram TEXT"
   ```
   É a mesma sequência que a suíte de testes usa (`worker/test/helpers/schema.ts`).
5. **Segredos** (por esquadrão; nunca reutilize os do Senta Pua):
   ```bash
   npx wrangler secret put JWT_SECRET   --env exemplo   # valor aleatório e PRÓPRIO (ex.: openssl rand -base64 48)
   npx wrangler secret put ADMIN_EMAIL  --env exemplo   # super admin criado no primeiro login
   npx wrangler secret put ADMIN_SENHA  --env exemplo
   npx wrangler secret put FRONTEND_URL --env exemplo   # URL do Pages do esquadrão (opcional se igual a url_app)
   ```
   `JWT_SECRET` próprio impede que um token de um esquadrão valha no outro.
6. **Worker**: confira com `npx wrangler deploy --env exemplo --dry-run --outdir <pasta temporária>` e
   publique com `npx wrangler deploy --env exemplo`.
7. **App (Pages)**: crie o projeto (`npx wrangler pages project create app-exemplo`), gere o build
   com a identidade e a URL do worker novo e publique:
   ```bash
   cd ../app
   VITE_ESQUADRAO=exemplo VITE_WORKER_URL=https://exemplo-worker.<conta>.workers.dev npm run build
   npx wrangler pages deploy dist --project-name=app-exemplo --branch=main
   ```
   A URL final do Pages deve ser o `url_app` do JSON (é a origem liberada no CORS).
8. **CI** (`.github/workflows/`): os workflows atuais publicam só o Senta Pua. Para incluir outro
   esquadrão, acrescente passos (ou um `matrix` com o id) que rodem
   `pnpm --filter senta-pua-worker exec wrangler deploy --env <id>` no `deploy-worker.yml` e, no
   `deploy-app.yml`, um build com `VITE_ESQUADRAO=<id>` e `VITE_WORKER_URL` do worker novo (segredo
   próprio, ex.: `VITE_WORKER_URL_<ID>`) seguido de `wrangler pages deploy ... --project-name=app-<id>`.
   Os testes (`pnpm --filter senta-pua-worker test`) já cobrem o código comum e o `exemplo`.
