/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 見本版（ブラウザの中で動くもの）を作るときだけ "1" */
  readonly VITE_DEMO?: string;
}
