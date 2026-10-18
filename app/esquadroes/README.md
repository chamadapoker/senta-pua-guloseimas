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
