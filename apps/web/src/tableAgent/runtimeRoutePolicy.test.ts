import { describe, expect, it } from 'vitest';
import { shouldAttemptFastCommands } from './runtimeRoutePolicy';

describe('runtime route policy', () => {
  it('tries L1 in qwen mode when L0 misses', () => {
    expect(shouldAttemptFastCommands(false, 'qwen')).toBe(true);
  });

  it('tries L1 in automation_rules mode when L0 misses', () => {
    expect(shouldAttemptFastCommands(false, 'automation_rules')).toBe(true);
  });

  it('skips L1 when L0 matches regardless of model', () => {
    expect(shouldAttemptFastCommands(true, 'qwen')).toBe(false);
    expect(shouldAttemptFastCommands(true, 'automation_rules')).toBe(false);
  });
});

