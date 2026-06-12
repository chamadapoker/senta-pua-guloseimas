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
