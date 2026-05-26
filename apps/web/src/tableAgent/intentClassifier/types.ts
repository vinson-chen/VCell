/**
 * 意图分类器类型定义
 */

// ========== 意图类型 ==========

/**
 * 表格操作意图类型
 */
export type TableIntent =
  | 'filter'       // 筛选行
  | 'aggregate'    // 聚合计算
  | 'group'        // 分组聚合
  | 'sort'         // 排序
  | 'calculate'    // 计算列
  | 'transform'    // 数据变换
  | 'visualize'    // 可视化
  | 'query'        // 查询
  | 'explain'      // 解释
  | 'skill'        // 调用技能
  | 'undo'         // 撤销
  | 'redo'         // 重做
  | 'unknown';     // 未识别

// ========== 子类型 ==========

/**
 * 聚合类型
 */
export type AggType = 'sum' | 'avg' | 'max' | 'min' | 'count' | 'std' | 'var';

/**
 * 篩选操作符
 */
export type FilterOperator =
  | '>' | '<' | '==' | '!='
  | 'contains' | 'not_contains'
  | 'between';

/**
 * 排序方向
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 图表类型
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

// ========== 表格结构 ==========

/**
 * 列定义
 */
export interface ColumnDef {
  name: string;
  type: 'numeric' | 'text' | 'date' | 'boolean';
  aliases?: string[];  // 列名别名
}

/**
 * 表格 Schema
 */
export interface TableSchema {
  columns: ColumnDef[];
  rowCount: number;
}

// ========== 选区 ==========

/**
 * 选区类型
 */
export type SelectionType = 'rows' | 'columns' | 'range' | 'cells';

/**
 * 选区结构
 */
export interface Selection {
  type: SelectionType;
  indices: number[];  // 行索引或列索引
  range?: CellRange;  // 区域选择
}

/**
 * 单元格范围
 */
export interface CellRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

// ========== 篩选条件 ==========

/**
 * 篩选条件
 */
export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: any;
}

// ========== 分类器输入 ==========

/**
 * 分类器输入
 */
export interface ClassifierInput {
  message: string;           // 用户说的话
  state: TableSessionState;  // 当前状态
  schema: TableSchema;       // 表格结构
}

/**
 * 表格会话状态（简化版）
 */
export interface TableSessionState {
  phase: 'initial' | 'filtered' | 'operated';
  selection: Selection | null;
  activeFilters: FilterCondition[];
  context: InheritedContext;
}

/**
 * 继承的上下文
 */
export interface InheritedContext {
  lastScope: 'full' | 'selection' | 'filtered' | null;
  lastSelection: Selection | null;
  recentColumns: string[];      // 最近使用的列（最多3个）
  lastOperation: TableOperation | null;
}

/**
 * 表格操作（简化版）
 */
export interface TableOperation {
  type: TableIntent;
  params: Record<string, any>;
  scope: 'full' | 'selection' | 'filtered';
  description: string;
}

// ========== 分类器输出 ==========

/**
 * 分类器输出
 */
export interface ClassifierOutput {
  intents: IntentResult[];       // 识别出的意图列表
  confidence: number;            // 置信度 0-1
  ambiguities: Ambiguity[];      // 需要消歧的参数
  scopeDescription: string;      // 作用范围描述
}

/**
 * 意图识别结果
 */
export interface IntentResult {
  intent: TableIntent;
  params: Record<string, any>;
  scope: 'full' | 'selection' | 'filtered';
  source: 'rule' | 'inherit' | 'fallback';  // 来源标识
}

/**
 * 消歧项
 */
export interface Ambiguity {
  param: string;           // 参数名
  question: string;        // 询问用户的问题
  options?: string[];      // 可选值
  reason: string;          // 消歧原因
}

// ========== 规则结构 ==========

/**
 * 意图规则
 */
export interface IntentRule {
  intent: TableIntent;
  patterns: RegExp[];
  priority: number;
  paramHints?: ParamHint[];
}

/**
 * 参数提取提示
 */
export interface ParamHint {
  param: string;
  extractType: 'column' | 'number' | 'operator' | 'aggType' | 'chartType' | 'sortOrder' | 'text';
  keywords?: RegExp;
}

// ========== 执行计划 ==========

/**
 * 执行计划
 */
export interface ExecutionPlan {
  steps: ExecutionStep[];
}

/**
 * 执行步骤
 */
export interface ExecutionStep {
  order: number;
  intent: TableIntent;
  params: Record<string, any>;
  scope: 'full' | 'selection' | 'filtered';
}

// ========== 执行结果 ==========

/**
 * 执行结果
 */
export interface ExecutionResult {
  success: boolean;
  finalTable?: any;
  finalValue?: any;
  results?: StepResult[];
  snapshots?: any[];
  error?: ExecutionError;
  rollbackTable?: any;
  partialResults?: StepResult[];
}

/**
 * 步骤执行结果
 */
export interface StepResult {
  success: boolean;
  operation?: TableOperation;
  snapshot?: any;
  data?: any;
  value?: any;
  message?: string;
  error?: ExecutionError;
}

/**
 * 执行错误
 */
export interface ExecutionError {
  code: string;
  message: string;
  detail?: any;
}