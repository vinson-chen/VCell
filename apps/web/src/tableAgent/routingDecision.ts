export type FastCommandsDecision = Readonly<{
  route: 'L1' | 'L2';
  reason?: string;
}>;

export type FastCommandsInput = Readonly<{
  hasActions: boolean;
  confidence: number;
  threshold: number;
  errorKind?: 'request_failed' | 'request_exception';
}>;

export function decideFastCommandsRoute(input: FastCommandsInput): FastCommandsDecision {
  const { hasActions, confidence, threshold, errorKind } = input;
  if (errorKind === 'request_failed') return { route: 'L2', reason: 'L1请求失败' };
  if (errorKind === 'request_exception') return { route: 'L2', reason: 'L1请求异常' };
  if (!hasActions) return { route: 'L2', reason: 'L1无可执行动作' };
  if (confidence < threshold) return { route: 'L2', reason: `L1置信度不足(${confidence.toFixed(2)})` };
  return { route: 'L1' };
}

