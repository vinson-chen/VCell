import type {
  TableAgentAction,
  TableAgentResult,
  TableAgentTableFlags,
} from './tableAgentTypes';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const TABLE_FLAG_KEYS = [
  'enableColumnResize',
  'enableVerticalCenter',
  'enableFreezeFirstCol',
  'enableFreezeLastCol',
  'enableFreezeLastRow',
  'enableBodyCellRightBorder',
  'enableShowRowIndex',
  'enableInsertRowCol',
  'enableEditMode',
  'enableRegularTableFont',
] as const satisfies readonly (keyof TableAgentTableFlags)[];

function parseTableFlags(raw: unknown): TableAgentTableFlags | null {
  if (!isRecord(raw)) return null;
  const flags: TableAgentTableFlags = {};
  for (const k of TABLE_FLAG_KEYS) {
    if (k in raw && typeof raw[k] === 'boolean') {
      flags[k] = raw[k];
    }
  }
  return Object.keys(flags).length > 0 ? flags : null;
}

function parseAction(raw: unknown): TableAgentAction | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null;
  switch (raw.type) {
    case 'set_cells': {
      const values = raw.values;
      if (!isRecord(values)) return null;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (typeof v === 'string') out[k] = v;
      }
      return { type: 'set_cells', values: out };
    }
    case 'insert_rows':
    case 'insert_columns': {
      const n = raw.count;
      if (typeof n !== 'number' || !Number.isFinite(n)) return null;
      return raw.type === 'insert_rows'
        ? { type: 'insert_rows', count: Math.trunc(n) }
        : { type: 'insert_columns', count: Math.trunc(n) };
    }
    case 'insert_rows_at':
    case 'insert_columns_at': {
      const idx = raw.index;
      const n = raw.count;
      if (typeof idx !== 'number' || !Number.isFinite(idx)) return null;
      if (typeof n !== 'number' || !Number.isFinite(n)) return null;
      return raw.type === 'insert_rows_at'
        ? { type: 'insert_rows_at', index: Math.trunc(idx), count: Math.trunc(n) }
        : { type: 'insert_columns_at', index: Math.trunc(idx), count: Math.trunc(n) };
    }
    case 'sort_body_rows': {
      if (!Array.isArray(raw.keys) || raw.keys.length === 0) return null;
      const keys: Array<{ colIndex: number; direction: 'asc' | 'desc' }> = [];
      for (const k of raw.keys) {
        if (!isRecord(k)) return null;
        if (typeof k.colIndex !== 'number' || !Number.isFinite(k.colIndex)) return null;
        if (k.direction !== 'asc' && k.direction !== 'desc') return null;
        keys.push({ colIndex: Math.trunc(k.colIndex), direction: k.direction });
      }
      return { type: 'sort_body_rows', keys };
    }
    case 'keep_rows_by_column_condition': {
      const colIndex = raw.colIndex;
      const operator = raw.operator;
      if (typeof colIndex !== 'number' || !Number.isFinite(colIndex)) return null;
      if (operator !== 'eq' && operator !== 'contains' && operator !== 'range') return null;
      if (operator === 'range') {
        if (typeof raw.min !== 'number' || !Number.isFinite(raw.min)) return null;
        if (typeof raw.max !== 'number' || !Number.isFinite(raw.max)) return null;
        return {
          type: 'keep_rows_by_column_condition',
          colIndex: Math.trunc(colIndex),
          operator,
          min: raw.min,
          max: raw.max,
        };
      }
      if (typeof raw.value !== 'string') return null;
      return {
        type: 'keep_rows_by_column_condition',
        colIndex: Math.trunc(colIndex),
        operator,
        value: raw.value,
      };
    }
    case 'clear_row_filter':
      return { type: 'clear_row_filter' };
    case 'dedupe_rows_by_columns': {
      if (!Array.isArray(raw.colIndices) || raw.colIndices.length === 0) return null;
      const colIndices: number[] = [];
      for (const c of raw.colIndices) {
        if (typeof c !== 'number' || !Number.isFinite(c)) return null;
        colIndices.push(Math.trunc(c));
      }
      if (raw.keep !== 'first' && raw.keep !== 'last') return null;
      return { type: 'dedupe_rows_by_columns', colIndices, keep: raw.keep };
    }
    case 'delete_body_row': {
      const rowIndex = raw.rowIndex;
      if (typeof rowIndex !== 'number' || !Number.isFinite(rowIndex)) return null;
      return { type: 'delete_body_row', rowIndex: Math.trunc(rowIndex) };
    }
    case 'delete_column': {
      const colIndex = raw.colIndex;
      if (typeof colIndex !== 'number' || !Number.isFinite(colIndex)) return null;
      return { type: 'delete_column', colIndex: Math.trunc(colIndex) };
    }
    case 'column_numeric_transform': {
      const colIndex = raw.colIndex;
      const value = raw.value;
      const op = raw.op;
      if (typeof colIndex !== 'number' || !Number.isFinite(colIndex)) return null;
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      if (op !== 'multiply' && op !== 'add') return null;
      const decimals = raw.decimals;
      if (decimals !== undefined && (typeof decimals !== 'number' || !Number.isFinite(decimals))) {
        return null;
      }
      return {
        type: 'column_numeric_transform',
        colIndex: Math.trunc(colIndex),
        op,
        value,
        ...(decimals !== undefined ? { decimals: Math.trunc(decimals) } : {}),
      };
    }
    case 'column_round': {
      const colIndex = raw.colIndex;
      const decimals = raw.decimals;
      if (typeof colIndex !== 'number' || !Number.isFinite(colIndex)) return null;
      if (typeof decimals !== 'number' || !Number.isFinite(decimals)) return null;
      return {
        type: 'column_round',
        colIndex: Math.trunc(colIndex),
        decimals: Math.trunc(decimals),
      };
    }
    case 'convert_column_unit': {
      const colIndex = raw.colIndex;
      const factor = raw.factor;
      if (typeof colIndex !== 'number' || !Number.isFinite(colIndex)) return null;
      if (typeof factor !== 'number' || !Number.isFinite(factor)) return null;
      const decimals = raw.decimals;
      if (decimals !== undefined && (typeof decimals !== 'number' || !Number.isFinite(decimals))) {
        return null;
      }
      return {
        type: 'convert_column_unit',
        colIndex: Math.trunc(colIndex),
        factor,
        ...(decimals !== undefined ? { decimals: Math.trunc(decimals) } : {}),
      };
    }
    case 'set_table_flags': {
      const flags = parseTableFlags(raw.flags);
      if (!flags) return null;
      return { type: 'set_table_flags', flags };
    }
    case 'clear_all_body':
      return { type: 'clear_all_body' };
    case 'clear_row': {
      const rowIndex = raw.rowIndex;
      if (typeof rowIndex !== 'number' || !Number.isFinite(rowIndex)) return null;
      return { type: 'clear_row', rowIndex: Math.trunc(rowIndex) };
    }
    case 'clear_column': {
      const colIndex = raw.colIndex;
      if (typeof colIndex !== 'number' || !Number.isFinite(colIndex)) return null;
      const includeHeader =
        typeof raw.includeHeader === 'boolean' ? raw.includeHeader : undefined;
      return {
        type: 'clear_column',
        colIndex: Math.trunc(colIndex),
        ...(includeHeader !== undefined ? { includeHeader } : {}),
      };
    }
    case 'replace_text_in_all_body': {
      const find = raw.find;
      const replace = raw.replace;
      if (typeof find !== 'string' || typeof replace !== 'string') return null;
      const matchCase = typeof raw.matchCase === 'boolean' ? raw.matchCase : undefined;
      return {
        type: 'replace_text_in_all_body',
        find,
        replace,
        ...(matchCase !== undefined ? { matchCase } : {}),
      };
    }
    case 'replace_text_in_column': {
      const colIndex = raw.colIndex;
      const find = raw.find;
      const replace = raw.replace;
      if (typeof colIndex !== 'number' || !Number.isFinite(colIndex)) return null;
      if (typeof find !== 'string' || typeof replace !== 'string') return null;
      const matchCase = typeof raw.matchCase === 'boolean' ? raw.matchCase : undefined;
      return {
        type: 'replace_text_in_column',
        colIndex: Math.trunc(colIndex),
        find,
        replace,
        ...(matchCase !== undefined ? { matchCase } : {}),
      };
    }
    case 'set_column_hidden': {
      const colIndex = raw.colIndex;
      const hidden = raw.hidden;
      if (typeof colIndex !== 'number' || !Number.isFinite(colIndex)) return null;
      if (typeof hidden !== 'boolean') return null;
      return { type: 'set_column_hidden', colIndex: Math.trunc(colIndex), hidden };
    }
    case 'clear_hidden_columns':
      return { type: 'clear_hidden_columns' };
    default:
      return null;
  }
}

export function parseTableAgentResult(parsed: unknown): TableAgentResult | null {
  if (!isRecord(parsed)) return null;
  const reply = typeof parsed.reply === 'string' ? parsed.reply : '';
  const rawActions = parsed.actions;
  if (!Array.isArray(rawActions)) return null;
  const actions: TableAgentAction[] = [];
  for (const a of rawActions) {
    const one = parseAction(a);
    if (one) actions.push(one);
  }
  return { reply: reply || '已完成表格更新。', actions };
}
