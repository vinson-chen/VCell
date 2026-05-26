/**
 * 表格 Agent 状态管理类型定义
 */

import type { TableAgentAction } from '../tableAgentTypes';

/** 选择区域 */
export type Selection = Readonly<{
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}>;

/** 作用域类型 */
export type ScopeType = 'full' | 'selection' | 'filtered';

/** 最近的列信息 */
export type RecentColumn = Readonly<{
  index: number;
  name: string;
  lastUsedAt: number;
}>;

/** 上次操作 */
export type LastOperation = Readonly<{
  type: string;
  params: Record<string, unknown>;
  timestamp: number;
  actions: TableAgentAction[];
}>;

/** 继承的上下文 */
export type InheritedContext = Readonly<{
  lastScope: ScopeType;
  lastSelection: Selection | null;
  recentColumns: RecentColumn[];
  lastOperation: LastOperation | null;
}>;

/** 操作快照（用于撤销） */
export type OperationSnapshot = Readonly<{
  id: string;
  timestamp: number;
  description: string;
  actions: TableAgentAction[];
  /** 数据快照（可选，大数据时只存 diff） */
  dataSnapshot?: Record<string, string>;
}>;

/** 会话状态 */
export type TableSessionState = Readonly<{
  context: InheritedContext;
  history: OperationSnapshot[];
  /** 当前撤销位置（0 表示最新） */
  undoPosition: number;
  /** 最大历史步数 */
  maxHistorySteps: number;
}>;

/** 状态更新动作 */
export type StateUpdateAction =
  | { type: 'update_scope'; scope: ScopeType }
  | { type: 'update_selection'; selection: Selection | null }
  | { type: 'add_recent_column'; column: RecentColumn }
  | { type: 'record_operation'; operation: LastOperation }
  | { type: 'push_snapshot'; snapshot: OperationSnapshot }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear_history' };