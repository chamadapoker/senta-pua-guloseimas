import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';
import { carregarEsquadrao, arquivoEsquadrao } from './esquadroes/carregar';
import type { EsquadraoConfig } from './esquadroes/tipo';

// Identidade do esquadrão: app/esquadroes/<VITE_ESQUADRAO>.json (padrão "senta-pua").
// Falha o build com mensagem clara se o arquivo não existir.
const esquadrao = carregarEsquadrao();

const escaparHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function gerarManifest(e: EsquadraoConfig): string {
  const icone = (sizes: string) => ({ src: e.imagens.logo, sizes, type: 'image/png', purpose: 'any maskable' });
  return JSON.stringify({
    name: e.nome,
    short_name: e.nome,
    description: e.slogan,
    start_url: '/',
    display: 'standalone',
    background_color: e.cor_fundo_pwa,
    theme_color: e.cores.noite,
    icons: [icone('192x192'), icone('512x512')],
  }, null, 2) + '\n';
}

function pluginEsquadrao(e: EsquadraoConfig): Plugin {
  const tokens: Record<string, string> = {
    ESQ_TITULO: `${e.nome} - ${e.nome_completo}`,
    ESQ_NOME: e.nome,
    ESQ_SLOGAN: e.slogan,
    ESQ_COR_TEMA: e.cores.noite,
    ESQ_ICONE: e.imagens.logo,
    ESQ_OG_IMAGE: e.imagens.og_image,
    ESQ_URL: e.url_app,
  };
  return {
    name: 'esquadrao-identidade',
    // Recarrega o dev server quando o JSON do esquadrão muda
    configureServer(server) {
      server.watcher.add(arquivoEsquadrao(e.id));
      // Dev: serve o manifest gerado (o estático saiu de public/)
      server.middlewares.use('/manifest.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        res.end(gerarManifest(carregarEsquadrao(e.id)));
      });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const out = html.replace(/\{\{(ESQ_[A-Z_]+)\}\}/g, (m, k: string) => {
          if (!(k in tokens)) throw new Error(`[esquadrao] Placeholder desconhecido no index.html: ${m}`);
          return escaparHtml(tokens[k]);
        });
        return out;
      },
    },
    // Build: manifest.json gerado a partir do config
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: gerarManifest(e) });
    },
  };
}

// Build: o service worker (copiado de public/) recebe o id do esquadrão no nome do cache
// e o logo do config na lista de pré-cache (no fonte fica '/logo.png', que funciona no dev).
function pluginSwEsquadrao(e: EsquadraoConfig): Plugin {
  let outDir = 'dist';
  return {
    name: 'esquadrao-sw',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const f = path.join(outDir, 'sw.js');
      if (!fs.existsSync(f)) return;
      const src = fs.readFileSync(f, 'utf8')
        .split('__ESQUADRAO_ID__').join(e.id)
        .split("'/logo.png'").join(`'${e.imagens.logo}'`);
      fs.writeFileSync(f, src);
    },
  };
}

export default defineConfig({
  plugins: [react(), pluginEsquadrao(esquadrao), pluginSwEsquadrao(esquadrao)],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __ESQUADRAO__: JSON.stringify(esquadrao),
  },
  server: {
    port: 5173,
  },
});
