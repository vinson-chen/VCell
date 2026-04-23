export type ChatLlmOption = Readonly<{
  value: string;
  label: string;
  /** 暂不可选时置 true，菜单项灰色且不可切换 */
  disabled?: boolean;
}>;

/** 与「Qwen」选项对应的 Ollama 模型名（可通过 VITE_OLLAMA_MODEL 覆盖） */
export const QWEN_OLLAMA_MODEL = 'qwen2.5:14b';

/** 与「DeepSeek」选项对应的 Ollama 模型名（可通过 VITE_DEEPSEEK_OLLAMA_MODEL 覆盖） */
export const DEEPSEEK_OLLAMA_MODEL = 'deepseek-r1:8b';

export const CHAT_LLM_OPTIONS: ChatLlmOption[] = [
  { value: 'automation_rules', label: '预设规则' },
  { value: 'qwen', label: 'Qwen' },
  { value: 'deepseek', label: 'DeepSeek' },
];

export const DEFAULT_CHAT_LLM_VALUE = 'qwen';

/** 将右侧下拉选中的 value 解析为发给 BFF / Ollama 的模型名 */
export function resolveOllamaModelForLlmValue(chatLlm: string): string | undefined {
  if (chatLlm === 'qwen') {
    const fromEnv =
      typeof import.meta.env.VITE_OLLAMA_MODEL === 'string' && import.meta.env.VITE_OLLAMA_MODEL.trim();
    return fromEnv || QWEN_OLLAMA_MODEL;
  }
  if (chatLlm === 'deepseek') {
    const fromEnv =
      typeof import.meta.env.VITE_DEEPSEEK_OLLAMA_MODEL === 'string' &&
      import.meta.env.VITE_DEEPSEEK_OLLAMA_MODEL.trim();
    return fromEnv || DEEPSEEK_OLLAMA_MODEL;
  }
  return undefined;
}
