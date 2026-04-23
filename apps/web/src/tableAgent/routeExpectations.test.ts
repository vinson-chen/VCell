import { describe, expect, it } from 'vitest';
import type { TableAreaDemoModel } from 'vc-biz';
import { parseQuickCommand } from './quickCommandRules';
import { decideFastCommandsRoute } from './routingDecision';

const FAST_THRESHOLD = 0.8;

function makeModel(): TableAreaDemoModel {
  return {
    colCount: 4,
    rowCount: 10,
    valueByCell: {
      'header-0': '组名',
      'header-1': '常用',
      'header-2': '系统设置',
      'header-3': '价格',
    },
  } as unknown as TableAreaDemoModel;
}

describe('route expectations (near e2e)', () => {
  it('routes to L0 when quick rule matches', () => {
    const model = makeModel();
    const quick = parseQuickCommand('删除最后3行', model);
    expect(quick.matched).toBe(true);
  });

  it('routes selected-row deterministic intents to L0', () => {
    const model = makeModel();
    const q1 = parseQuickCommand('清空选中行内容', model);
    const q2 = parseQuickCommand('删除选中行', model);
    const q3 = parseQuickCommand('把选中行都除以2', model);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    expect(q3.matched).toBe(true);
  });

  it('routes to L2 when L0 miss and L1 confidence is low', () => {
    const model = makeModel();
    const quick = parseQuickCommand('把第2列前20行按拼音排序', model);
    expect(quick.matched).toBe(false);

    const fastDecision = decideFastCommandsRoute({
      hasActions: true,
      confidence: 0.61,
      threshold: FAST_THRESHOLD,
    });
    expect(fastDecision.route).toBe('L2');
    expect(fastDecision.reason).toContain('L1置信度不足');
  });

  it('routes selected-row sort/dedupe intents away from L0', () => {
    const model = makeModel();
    const s1 = parseQuickCommand('把选中行按第2列升序排序', model);
    const s2 = parseQuickCommand('对选中行按第1列和第3列多列排序', model);
    const d1 = parseQuickCommand('对选中行按第2列去重并保留首条', model);
    expect(s1.matched).toBe(false);
    expect(s2.matched).toBe(false);
    expect(d1.matched).toBe(false);

    const fastDecision = decideFastCommandsRoute({
      hasActions: false,
      confidence: 0.72,
      threshold: FAST_THRESHOLD,
    });
    expect(fastDecision).toEqual({ route: 'L2', reason: 'L1无可执行动作' });
  });

  it('routes to L2 when L0 miss and L1 has no actions', () => {
    const model = makeModel();
    const quick = parseQuickCommand('把商品管理列中包含首页的行删除', model);
    expect(quick.matched).toBe(false);

    const fastDecision = decideFastCommandsRoute({
      hasActions: false,
      confidence: 0.95,
      threshold: FAST_THRESHOLD,
    });
    expect(fastDecision).toEqual({ route: 'L2', reason: 'L1无可执行动作' });
  });

  it('routes to L1 when L0 miss and L1 confidence passes threshold', () => {
    const model = makeModel();
    const quick = parseQuickCommand('请帮我把第2列旧值替换为新值', model);
    expect(quick.matched).toBe(false);

    const fastDecision = decideFastCommandsRoute({
      hasActions: true,
      confidence: 0.92,
      threshold: FAST_THRESHOLD,
    });
    expect(fastDecision).toEqual({ route: 'L1' });
  });

  it('routes to L2 when L1 request failed', () => {
    const decision = decideFastCommandsRoute({
      hasActions: false,
      confidence: 0,
      threshold: FAST_THRESHOLD,
      errorKind: 'request_failed',
    });
    expect(decision).toEqual({ route: 'L2', reason: 'L1请求失败' });
  });

  it('routes to L2 when L1 request throws exception', () => {
    const decision = decideFastCommandsRoute({
      hasActions: false,
      confidence: 0,
      threshold: FAST_THRESHOLD,
      errorKind: 'request_exception',
    });
    expect(decision).toEqual({ route: 'L2', reason: 'L1请求异常' });
  });
});

