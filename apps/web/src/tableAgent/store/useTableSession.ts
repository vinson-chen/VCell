/**
 * 表格 Agent 状态管理 Hook
 */

import { useState, useCallback } from 'react';
import type { TableAgentAction } from '../tableAgentTypes';
import type {
  InheritedContext,
  OperationSnapshot,
  TableSessionState,
  ScopeType,
  Selection,
  RecentColumn,
  LastOperation,
} from './types';

/** 默认上下文 */
const DEFAULT_CONTEXT: InheritedContext = {
  lastScope: 'full',
  lastSelection: null,
  recentColumns: [],
  lastOperation: null,
};

/** 生成快照 ID */
function generateSnapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 清理最近列（保持最多 5 个） */
function pruneRecentColumns(columns: RecentColumn[], max: number = 5): RecentColumn[] {
  return [...columns]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, max);
}

/** 初始状态 */
const INITIAL_STATE: TableSessionState = {
  context: DEFAULT_CONTEXT,
  history: [],
  undoPosition: 0,
  maxHistorySteps: 5,
};

/**
 * 表格会话状态管理 Hook
 */
export function useTableSession(maxHistorySteps: number = 5) {
  const [state, setState] = useState<TableSessionState>({
    ...INITIAL_STATE,
    maxHistorySteps,
  });

  /** 更新作用域 */
  const updateScope = useCallback((scope: ScopeType) => {
    setState(prev => ({
      ...prev,
      context: { ...prev.context, lastScope: scope },
    }));
  }, []);

  /** 更新选区 */
  const updateSelection = useCallback((selection: Selection | null) => {
    setState(prev => ({
      ...prev,
      context: {
        ...prev.context,
        lastScope: selection ? 'selection' : 'full',
        lastSelection: selection,
      },
    }));
  }, []);

  /** 添加最近使用的列 */
  const addRecentColumn = useCallback((column: RecentColumn) => {
    setState(prev => {
      const existing = prev.context.recentColumns.find(c => c.index === column.index);
      const updatedColumns = existing
        ? prev.context.recentColumns.map(c =>
            c.index === column.index ? { ...c, lastUsedAt: column.lastUsedAt } : c
          )
        : [...prev.context.recentColumns, column];
      return {
        ...prev,
        context: {
          ...prev.context,
          recentColumns: pruneRecentColumns(updatedColumns),
        },
      };
    });
  }, []);

  /** 记录操作 */
  const recordOperation = useCallback((operation: LastOperation) => {
    setState(prev => ({
      ...prev,
      context: { ...prev.context, lastOperation: operation },
    }));
  }, []);

  /** 推送操作快照（用于撤销） */
  const pushSnapshot = useCallback((snapshot: OperationSnapshot) => {
    setState(prev => {
      // 如果当前在历史中间位置，先清除后面的历史
      const baseHistory = prev.undoPosition > 0
        ? prev.history.slice(prev.undoPosition)
        : prev.history;
      // 添加新快照，保持最多 maxHistorySteps 步
      const newHistory = [snapshot, ...baseHistory].slice(0, prev.maxHistorySteps);
      return {
        ...prev,
        history: newHistory,
        undoPosition: 0,
      };
    });
  }, []);

  /** 撤销 */
  const undo = useCallback(() => {
    setState(prev => {
      if (prev.undoPosition >= prev.history.length - 1) return prev;
      return {
        ...prev,
        undoPosition: prev.undoPosition + 1,
      };
    });
  }, []);

  /** 重做 */
  const redo = useCallback(() => {
    setState(prev => {
      if (prev.undoPosition <= 0) return prev;
      return {
        ...prev,
        undoPosition: prev.undoPosition - 1,
      };
    });
  }, []);

  /** 清除历史 */
  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      history: [],
      undoPosition: 0,
    }));
  }, []);

  /** 获取当前可撤销的快照 */
  const getUndoSnapshot = useCallback((): OperationSnapshot | null => {
    const idx = state.undoPosition;
    if (idx >= state.history.length) return null;
    return state.history[idx];
  }, [state.history, state.undoPosition]);

  /** 获取当前可重做的快照 */
  const getRedoSnapshot = useCallback((): OperationSnapshot | null => {
    const idx = state.undoPosition - 1;
    if (idx < 0 || idx >= state.history.length) return null;
    return state.history[idx];
  }, [state.history, state.undoPosition]);

  /** 是否可撤销 */
  const canUndo = state.undoPosition < state.history.length;

  /** 是否可重做 */
  const canRedo = state.undoPosition > 0;

  return {
    state,
    context: state.context,
    updateScope,
    updateSelection,
    addRecentColumn,
    recordOperation,
    pushSnapshot,
    undo,
    redo,
    clearHistory,
    getUndoSnapshot,
    getRedoSnapshot,
    canUndo,
    canRedo,
  };
}

/** 从操作生成快照 */
export function createSnapshot(
  description: string,
  actions: LastOperation['actions'],
  dataSnapshot?: Record<string, string>
): OperationSnapshot {
  return {
    id: generateSnapshotId(),
    timestamp: Date.now(),
    description,
    actions,
    dataSnapshot,
  };
}

/** 从动作生成最近操作记录 */
export function createLastOperation(
  type: string,
  params: Record<string, unknown>,
  actions: TableAgentAction[]
): LastOperation {
  return {
    type,
    params,
    timestamp: Date.now(),
    actions,
  };
}

/** 解析上下文提示（用于"再..."类命令） */
export function parseContextHint(
  text: string,
  context: InheritedContext
): { inheritScope: boolean; inheritColumn: boolean; inheritOperation: boolean } {
  return {
    inheritScope: text.includes('再') || text.includes('继续'),
    inheritColumn: text.includes('再') && context.lastOperation != null,
    inheritOperation: text.startsWith('再') && context.lastOperation != null,
  };
}