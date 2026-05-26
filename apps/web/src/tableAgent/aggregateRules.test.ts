/**
 * 统计类规则测试
 */

import { describe, it, expect } from 'vitest';
import { parseQuickCommand } from './quickCommandRules';
import { QUICK_RULE_SCHEMA } from './quickRuleSchema';

// Mock TableAreaDemoModel
function createMockModel(colCount: number = 5, rowCount: number = 10, headers: string[] = ['销售额', '地区', '数量', '利润', '日期']) {
  const valueByCell: Record<string, string> = {};

  // 设置表头
  for (let c = 0; c < colCount; c++) {
    valueByCell[`header-${c}`] = headers[c] || `第${c + 1}列`;
  }

  // 设置一些数据
  for (let r = 0; r < rowCount - 1; r++) {
    for (let c = 0; c < colCount; c++) {
      valueByCell[`${r}-${c}`] = String((r + 1) * 100 + c * 10);
    }
  }

  return {
    rowCount,
    colCount,
    valueByCell,
    bodyRowSelectionStore: null,
    startUndoBatch: () => {},
    endUndoBatch: () => {},
    tableUndoRedo: { undo: () => {}, redo: () => {}, canUndo: () => false, canRedo: () => false },
  } as any;
}

describe('统计类规则', () => {
  describe('aggregate_column', () => {
    it('应识别"计算第3列总和"', () => {
      const model = createMockModel();
      const result = parseQuickCommand('计算第3列总和', model);
      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.actions[0].type).toBe('aggregate_column');
        expect(result.actions[0].colIndex).toBe(2);
        expect(result.actions[0].aggType).toBe('sum');
      }
    });

    it('应识别"求第2列平均值"', () => {
      const model = createMockModel();
      const result = parseQuickCommand('求第2列平均值', model);
      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.actions[0].type).toBe('aggregate_column');
        expect(result.actions[0].colIndex).toBe(1);
        expect(result.actions[0].aggType).toBe('avg');
      }
    });

    it('应识别"统计第4列数量"', () => {
      const model = createMockModel();
      const result = parseQuickCommand('统计第4列数量', model);
      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.actions[0].type).toBe('aggregate_column');
        expect(result.actions[0].aggType).toBe('count');
      }
    });

    it('应识别"销售额列总和"', () => {
      const model = createMockModel();
      const result = parseQuickCommand('销售额列总和', model);
      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.actions[0].type).toBe('aggregate_column');
        // 销售额是第0列
        expect(result.actions[0].colIndex).toBe(0);
        expect(result.actions[0].aggType).toBe('sum');
      }
    });
  });

  describe('aggregate_selected', () => {
    it('应识别"计算选中的总和"', () => {
      const model = createMockModel();
      const result = parseQuickCommand('计算选中的总和', model);
      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.actions[0].type).toBe('aggregate_selected');
        expect(result.actions[0].aggType).toBe('sum');
      }
    });

    it('应识别"计算选中平均"', () => {
      const model = createMockModel();
      const result = parseQuickCommand('计算选中平均', model);
      expect(result.matched).toBe(true);
      if (result.matched) {
        expect(result.actions[0].type).toBe('aggregate_selected');
        expect(result.actions[0].aggType).toBe('avg');
      }
    });
  });

  describe('列索引越界', () => {
    it('第100列应返回未匹配', () => {
      const model = createMockModel(5);
      const result = parseQuickCommand('计算第100列总和', model);
      expect(result.matched).toBe(false);
    });
  });
});