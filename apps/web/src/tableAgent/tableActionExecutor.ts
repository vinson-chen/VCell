import { TableAreaDemoModel } from '@vinson.hx/vc-biz';
import { applyTableAgentActions, ApplyTableAgentReport, AggregateResult, getSelectedBodyRows } from './applyTableAgentActions';
import { TableAgentAction } from './tableAgentTypes';
import { flushSync } from 'react-dom';
import { MutableRefObject } from 'react';

export interface TableExecutorDims {
  rowCountRef: MutableRefObject<number>;
  colCountRef: MutableRefObject<number>;
}

export interface TableExecutorResult extends ApplyTableAgentReport {
  success: boolean;
  error?: string;
  /** 统计结果（聚合计算返回值） */
  aggregateResult?: AggregateResult;
}

export function executeTableActions(
  model: TableAreaDemoModel,
  actions: TableAgentAction[],
  dims: TableExecutorDims
): TableExecutorResult {
  if (actions.length === 0) {
    return { applied: 0, skipped: 0, notes: [], success: true };
  }

  model.startUndoBatch();
  try {
    const report = applyTableAgentActions(
      model,
      actions,
      dims,
      { runAfterUpdate: flushSync }
    );
    return { ...report, success: true };
  } catch (e) {
    return {
      applied: 0,
      skipped: 0,
      notes: [`执行异常: ${e instanceof Error ? e.message : String(e)}`],
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    model.endUndoBatch();
  }
}

export function formatExecutionReport(report: TableExecutorResult): string {
  const parts: string[] = [];
  if (report.notes.length > 0) {
    parts.push(`执行备注：${report.notes.join('；')}`);
  }
  if (report.skipped > 0) {
    parts.push(`（有 ${report.skipped} 步未生效，可能因越界或已达限制）`);
  }
  return parts.length > 0 ? `\n\n${parts.join('\n')}` : '';
}

export { getSelectedBodyRows };
