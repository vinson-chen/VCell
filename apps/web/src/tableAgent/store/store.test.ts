/**
 * 状态管理模块测试
 */

import { describe, it, expect } from 'vitest';
import {
  createSnapshot,
  createLastOperation,
  parseContextHint,
} from './useTableSession';
import type { InheritedContext, LastOperation } from './types';

describe('createSnapshot', () => {
  it('应生成包含必要信息的快照', () => {
    const snapshot = createSnapshot('测试操作', []);
    expect(snapshot.id).toMatch(/^snap-/);
    expect(snapshot.timestamp).toBeGreaterThan(0);
    expect(snapshot.description).toBe('测试操作');
    expect(snapshot.actions).toEqual([]);
  });

  it('应包含可选的数据快照', () => {
    const dataSnapshot = { '0-0': '100', '0-1': '200' };
    const snapshot = createSnapshot('带数据快照', [], dataSnapshot);
    expect(snapshot.dataSnapshot).toEqual(dataSnapshot);
  });
});

describe('createLastOperation', () => {
  it('应生成最近操作记录', () => {
    const operation = createLastOperation('aggregate_column', { colIndex: 0, aggType: 'sum' }, []);
    expect(operation.type).toBe('aggregate_column');
    expect(operation.params.colIndex).toBe(0);
    expect(operation.params.aggType).toBe('sum');
    expect(operation.timestamp).toBeGreaterThan(0);
  });
});

describe('parseContextHint', () => {
  const contextWithOperation: InheritedContext = {
    lastScope: 'selection',
    lastSelection: null,
    recentColumns: [],
    lastOperation: {
      type: 'aggregate_column',
      params: { colIndex: 0 },
      timestamp: Date.now(),
      actions: [],
    },
  };

  const contextWithoutOperation: InheritedContext = {
    lastScope: 'full',
    lastSelection: null,
    recentColumns: [],
    lastOperation: null,
  };

  it('应识别"再"类命令为继承上下文', () => {
    const hint = parseContextHint('再计算平均值', contextWithOperation);
    expect(hint.inheritScope).toBe(true);
    expect(hint.inheritColumn).toBe(true);
    expect(hint.inheritOperation).toBe(true);
  });

  it('应识别"继续"类命令为继承作用域', () => {
    const hint = parseContextHint('继续筛选', contextWithoutOperation);
    expect(hint.inheritScope).toBe(true);
    expect(hint.inheritColumn).toBe(false);
    expect(hint.inheritOperation).toBe(false);
  });

  it('无上次操作时不继承操作', () => {
    const hint = parseContextHint('再计算总和', contextWithoutOperation);
    expect(hint.inheritScope).toBe(true);
    expect(hint.inheritColumn).toBe(false);
    expect(hint.inheritOperation).toBe(false);
  });

  it('非"再"开头时不继承操作', () => {
    const hint = parseContextHint('计算总和', contextWithOperation);
    expect(hint.inheritScope).toBe(false);
    expect(hint.inheritOperation).toBe(false);
  });
});