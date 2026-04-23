/** 与 vc-biz 表壳开关对齐；仅列出出现的键会被更新 */
export type TableAgentTableFlags = Partial<{
  enableColumnResize: boolean;
  enableVerticalCenter: boolean;
  enableFreezeFirstCol: boolean;
  enableFreezeLastCol: boolean;
  enableFreezeLastRow: boolean;
  enableBodyCellRightBorder: boolean;
  enableShowRowIndex: boolean;
  enableInsertRowCol: boolean;
  enableEditMode: boolean;
  enableRegularTableFont: boolean;
}>;

/** 筛选条件操作符（L0 规则核心能力） */
export type FilterOperator =
  | 'eq' // 等于
  | 'neq' // 不等于
  | 'contains' // 包含
  | 'not_contains' // 不包含
  | 'starts_with' // 开头是
  | 'ends_with' // 结尾是
  | 'regex' // 正则匹配
  | 'range' // 数值区间
  | 'gt' // 大于
  | 'lt' // 小于
  | 'gte' // 大于等于
  | 'lte' // 小于等于
  | 'empty' // 空值
  | 'not_empty'; // 非空

/** 单列筛选条件 */
export type SingleFilterCondition = {
  colIndex: number;
  operator: FilterOperator;
  value?: string;
  min?: number;
  max?: number;
  regex?: string;
};

/** 多列组合筛选条件 */
export type CompositeFilterCondition = {
  type: 'composite';
  logic: 'and' | 'or';
  conditions: SingleFilterCondition[];
};

/** 筛选条件（单列或组合） */
export type FilterCondition = SingleFilterCondition | CompositeFilterCondition;

export type TableAgentAction =
  | { type: 'set_cells'; values: Record<string, string> }
  | { type: 'insert_rows'; count: number }
  | { type: 'insert_columns'; count: number }
  | { type: 'insert_rows_at'; index: number; count: number }
  | { type: 'insert_columns_at'; index: number; count: number }
  | { type: 'swap_columns'; colAIndex: number; colBIndex: number }
  | { type: 'reorder_columns'; order: number[] }
  | {
      type: 'sort_body_rows';
      keys: Array<{ colIndex: number; direction: 'asc' | 'desc' }>;
    }
  | {
      type: 'keep_rows_by_column_condition';
      colIndex: number;
      operator: FilterOperator;
      value?: string;
      min?: number;
      max?: number;
      regex?: string;
    }
  | { type: 'clear_row_filter' }
  | {
      type: 'dedupe_rows_by_columns';
      colIndices: number[];
      keep: 'first' | 'last';
    }
  | { type: 'delete_selected_rows' }
  | { type: 'delete_empty_rows' }
  | { type: 'delete_empty_columns' }
  | { type: 'delete_body_row'; rowIndex: number }
  | { type: 'delete_column'; colIndex: number }
  /** 根据筛选条件删除行 */
  | {
      type: 'delete_rows_by_condition';
      colIndex: number;
      operator: FilterOperator;
      value?: string;
      min?: number;
      max?: number;
      regex?: string;
    }
  /** 根据多列组合条件删除行 */
  | {
      type: 'delete_rows_by_multi_condition';
      conditions: SingleFilterCondition[];
      logic: 'and' | 'or';
    }
  | { type: 'clear_all_body' }
  | { type: 'clear_selected_rows' }
  | { type: 'clear_row'; rowIndex: number }
  | { type: 'clear_column'; colIndex: number; includeHeader?: boolean }
  /** 根据筛选条件清空目标列 */
  | {
      type: 'clear_column_for_condition';
      filterColIndex: number;
      filterOperator: FilterOperator;
      filterValue?: string;
      filterMin?: number;
      filterMax?: number;
      filterRegex?: string;
      targetColIndex: number;
    }
  /** 根据筛选条件进行数值变换 */
  | {
      type: 'numeric_transform_for_condition';
      filterColIndex: number;
      filterOperator: FilterOperator;
      filterValue?: string;
      filterMin?: number;
      filterMax?: number;
      filterRegex?: string;
      targetColIndex?: number; // 默认为筛选列
      op: 'multiply' | 'add';
      value: number;
      decimals?: number;
    }
  /** 根据筛选条件进行文本替换 */
  | {
      type: 'replace_text_for_condition';
      filterColIndex: number;
      filterOperator: FilterOperator;
      filterValue?: string;
      filterMin?: number;
      filterMax?: number;
      filterRegex?: string;
      targetColIndex?: number;
      find: string;
      replace: string;
    }
  | {
      type: 'replace_text_in_all_body';
      find: string;
      replace: string;
      matchCase?: boolean;
    }
  | {
      type: 'replace_text_in_column';
      colIndex: number;
      find: string;
      replace: string;
      matchCase?: boolean;
    }
  | {
      type: 'replace_text_in_selected_rows';
      find: string;
      replace: string;
      matchCase?: boolean;
    }
  | { type: 'trim_whitespace_in_all_body' }
  | { type: 'trim_whitespace_in_column'; colIndex: number }
  | { type: 'trim_whitespace_in_selected_rows' }
  | { type: 'normalize_case_in_all_body'; mode: 'upper' | 'lower' }
  | { type: 'normalize_case_in_column'; colIndex: number; mode: 'upper' | 'lower' }
  | { type: 'normalize_case_in_selected_rows'; mode: 'upper' | 'lower' }
  | { type: 'fill_empty_in_all_body'; value: string }
  | { type: 'fill_empty_in_column'; colIndex: number; value: string }
  | { type: 'fill_empty_in_selected_rows'; value: string }
  | {
      type: 'numeric_transform_in_selected_rows';
      op: 'multiply' | 'add';
      value: number;
      decimals?: number;
    }
  | { type: 'round_in_selected_rows'; decimals: number }
  | {
      type: 'column_numeric_transform';
      colIndex: number;
      op: 'multiply' | 'add';
      value: number;
      decimals?: number;
    }
  | {
      type: 'column_round';
      colIndex: number;
      decimals: number;
    }
  | {
      type: 'convert_column_unit';
      colIndex: number;
      factor: number;
      decimals?: number;
    }
  | { type: 'set_table_flags'; flags: TableAgentTableFlags }
  /** 与 vc-biz TableArea hiddenColSet 对齐；hidden=true 为隐藏该列 */
  | { type: 'set_column_hidden'; colIndex: number; hidden: boolean }
  /** 显示所有列（清空隐藏集合） */
  | { type: 'clear_hidden_columns' };

export type TableAgentResult = Readonly<{
  reply: string;
  actions: TableAgentAction[];
}>;

export const TABLE_GRID_MIN = 2;
/** 与 vc-biz TableArea GRID_MAX_ROW 对齐（含表头） */
export const TABLE_GRID_MAX_ROW = 1001;
/** 与 vc-biz TableArea GRID_MAX_COL 对齐 */
export const TABLE_GRID_MAX_COL = 20;
