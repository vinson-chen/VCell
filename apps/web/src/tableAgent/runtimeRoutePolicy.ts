export function shouldAttemptFastCommands(
  quickMatched: boolean,
  _currentLlm: string
): boolean {
  // L0 命中直接返回；L0 miss 时，无论当前模型（automation_rules/qwen/...）均先尝试 L1。
  return !quickMatched;
}

