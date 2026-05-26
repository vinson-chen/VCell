/**
 * 判断是否需要尝试 L1 快速技能路由。
 * - 预设规则模式（automation_rules）：L0 miss 后尝试 L1
 * - 明确选择了模型（qwen/deepseek）：直接走 L2，避免二次请求延迟
 */
export function shouldAttemptFastCommands(
  quickMatched: boolean,
  currentLlm: string
): boolean {
  // L0 命中直接跳过 L1
  if (quickMatched) return false;
  // 只有预设规则模式才尝试 L1 路由
  return currentLlm === 'automation_rules';
}

