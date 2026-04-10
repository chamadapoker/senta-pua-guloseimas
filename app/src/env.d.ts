/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_URL: string;
  readonly VITE_ADMIN_WHATSAPP: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
