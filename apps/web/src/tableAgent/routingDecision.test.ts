import { describe, expect, it } from 'vitest';
import { decideFastCommandsRoute } from './routingDecision';

describe('decideFastCommandsRoute', () => {
  it('returns L1 when actions exist and confidence passes threshold', () => {
    const d = decideFastCommandsRoute({ hasActions: true, confidence: 0.91, threshold: 0.8 });
    expect(d).toEqual({ route: 'L1' });
  });

  it('returns L2 when no actions', () => {
    const d = decideFastCommandsRoute({ hasActions: false, confidence: 0.99, threshold: 0.8 });
    expect(d).toEqual({ route: 'L2', reason: 'L1无可执行动作' });
  });

  it('returns L2 when confidence is low', () => {
    const d = decideFastCommandsRoute({ hasActions: true, confidence: 0.62, threshold: 0.8 });
    expect(d.route).toBe('L2');
    expect(d.reason).toContain('L1置信度不足');
  });

  it('returns L2 on request failure/exception', () => {
    expect(
      decideFastCommandsRoute({
        hasActions: false,
        confidence: 0,
        threshold: 0.8,
        errorKind: 'request_failed',
      })
    ).toEqual({ route: 'L2', reason: 'L1请求失败' });
    expect(
      decideFastCommandsRoute({
        hasActions: false,
        confidence: 0,
        threshold: 0.8,
        errorKind: 'request_exception',
      })
    ).toEqual({ route: 'L2', reason: 'L1请求异常' });
  });
});

