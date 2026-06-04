/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_RESEND_API_KEY?: string;
  readonly VITE_AI_STUDIO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}