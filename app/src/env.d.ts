/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_URL: string;
  readonly VITE_ADMIN_WHATSAPP: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Versão do app injetada no build a partir do package.json (vite define)
declare const __APP_VERSION__: string;

// Identidade do esquadrão injetada no build (vite define) a partir de
// esquadroes/<VITE_ESQUADRAO>.json. Use via src/config/esquadrao.ts.
declare const __ESQUADRAO__: import('../esquadroes/tipo').EsquadraoCarregado;
