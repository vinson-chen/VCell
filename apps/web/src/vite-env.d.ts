/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 覆盖 Ollama 模型名（默认由服务端 OLLAMA_MODEL 决定） */
  readonly VITE_OLLAMA_MODEL?: string;
  /** 线上前后端分离时设为 API 根 URL，勿尾斜杠；本地留空走 Vite 代理 */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
