import type { MutableRefObject } from 'react';
import type { TableAreaDemoModel } from 'vc-biz';
import type { TableAgentAction, FilterOperator, SingleFilterCondition } from './tableAgentTypes';
import { TABLE_GRID_MAX_COL, TABLE_GRID_MAX_ROW, TABLE_GRID_MIN } from './tableAgentTypes';

const CELL_KEY_HEADER = /^header-\d+$/;
const CELL_KEY_BODY = /^\d+-\d+$/;

function isValidCellKey(k: string): boolean {
  return CELL_KEY_HEADER.test(k) || CELL_KEY_BODY.test(k);
}

/** 解析单元格内常见价格/数字写法；无法解析则跳过该格 */
function parseCellNumber(s: string): number | null {
  const t = s
    .trim()
    .replace(/[,，]/g, '')
    .replace(/^\s*[¥$€£]\s*/, '')
    .replace(/\s*元\s*$/, '')
    .trim();
  if (t === '' || t === '-' || t === '—') return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function clampDecimals(d: number | undefined): number {
  if (d === undefined || !Number.isFinite(d)) return 2;
  return Math.min(6, Math.max(0, Math.trunc(d)));
}

function formatCellNumber(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toFixed(decimals);
}

function clampInsertRows(count: number, currentRowCount: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const n = Math.trunc(count);
  if (n <= 0) return 0;
  const room = TABLE_GRID_MAX_ROW - currentRowCount;
  if (room <= 0) return 0;
  return Math.min(room, n);
}

function clampInsertColumns(count: number, currentColCount: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const n = Math.trunc(count);
  if (n <= 0) return 0;
  const room = TABLE_GRID_MAX_COL - currentColCount;
  if (room <= 0) return 0;
  return Math.min(room, n);
}

function bodyKey(r: number, c: number): string {
  return `${r}-${c}`;
}

function headerKey(c: number): string {
  return `header-${c}`;
}

function replaceText(raw: string, find: string, replace: string, matchCase: boolean | undefined): string {
  if (find === '') return raw;
  if (matchCase) return raw.split(find).join(replace);
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return raw.replace(new RegExp(escaped, 'gi'), replace);
}

function getSelectedBodyRows(model: TableAreaDemoModel): number[] {
  const store = model.bodyRowSelectionStore;
  if (!store) return [];
  const n = Math.max(0, store.getBodyRowCount());
  const rows: number[] = [];
  for (let r = 0; r < n; r += 1) {
    if (store.getRow(r)) rows.push(r);
  }
  return rows;
}

function compareMaybeNumericText(aRaw: string, bRaw: string): number {
  const aNum = parseCellNumber(aRaw);
  const bNum = parseCellNumber(bRaw);
  if (aNum != null && bNum != null) return aNum - bNum;
  return aRaw.localeCompare(bRaw, 'zh-CN');
}

function rowSignature(model: TableAreaDemoModel, rowIndex: number, colIndices: number[]): string {
  return colIndices
    .map((c) => model.valueByCell[bodyKey(rowIndex, c)] ?? '')
    .join('\u001f');
}

/** 评估单列筛选条件是否满足 */
function evaluateFilterCondition(
  raw: string,
  operator: FilterOperator,
  value?: string,
  min?: number,
  max?: number,
  regex?: string
): boolean {
  switch (operator) {
    case 'eq':
      return raw === (value ?? '');
    case 'neq':
      return raw !== (value ?? '');
    case 'contains':
      return (value ?? '') !== '' && raw.includes(value ?? '');
    case 'not_contains':
      return !raw.includes(value ?? '');
    case 'starts_with':
      return raw.startsWith(value ?? '');
    case 'ends_with':
      return raw.endsWith(value ?? '');
    case 'regex':
      try {
        return new RegExp(regex ?? '').test(raw);
      } catch {
        return false;
      }
    case 'gt':
      const nGt = parseCellNumber(raw);
      return nGt != null && nGt > (min ?? 0);
    case 'lt':
      const nLt = parseCellNumber(raw);
      return nLt != null && nLt < (min ?? 0);
    case 'gte':
      const nGte = parseCellNumber(raw);
      return nGte != null && nGte >= (min ?? 0);
    case 'lte':
      const nLte = parseCellNumber(raw);
      return nLte != null && nLte <= (min ?? 0);
    case 'range':
      const nRange = parseCellNumber(raw);
      return nRange != null && min != null && max != null && nRange >= min && nRange <= max;
    case 'empty':
      return raw === '' || raw === undefined;
    case 'not_empty':
      return raw !== '' && raw !== undefined;
    default:
      return false;
  }
}

/** 评估多列组合条件是否满足 */
function evaluateMultiCondition(
  model: TableAreaDemoModel,
  rowIndex: number,
  conditions: SingleFilterCondition[],
  logic: 'and' | 'or'
): boolean {
  const results = conditions.map((cond) => {
    const raw = model.valueByCell[bodyKey(rowIndex, cond.colIndex)] ?? '';
    return evaluateFilterCondition(raw, cond.operator, cond.value, cond.min, cond.max, cond.regex);
  });
  return logic === 'and' ? results.every(Boolean) : results.some(Boolean);
}

/**
 * 连续的 delete_body_row / delete_column 若按升序执行会导致索引错位。
 * 将同类型相邻动作按索引降序执行，等价于一次性删除用户口中的多行/多列。
 */
function normalizeActionsForStableIndexDeletes(actions: TableAgentAction[]): TableAgentAction[] {
  const out: TableAgentAction[] = [];
  let i = 0;
  while (i < actions.length) {
    const a = actions[i];
    if (a.type === 'delete_body_row') {
      let j = i + 1;
      while (j < actions.length && actions[j].type === 'delete_body_row') j += 1;
      const chunk = actions.slice(i, j) as Array<Extract<TableAgentAction, { type: 'delete_body_row' }>>;
      chunk.sort((x, y) => y.rowIndex - x.rowIndex);
      out.push(...chunk);
      i = j;
    } else if (a.type === 'delete_column') {
      let j = i + 1;
      while (j < actions.length && actions[j].type === 'delete_column') j += 1;
      const chunk = actions.slice(i, j) as Array<Extract<TableAgentAction, { type: 'delete_column' }>>;
      chunk.sort((x, y) => y.colIndex - x.colIndex);
      out.push(...chunk);
      i = j;
    } else {
      out.push(a);
      i += 1;
    }
  }
  return out;
}

export type TableDimsRef = Readonly<{
  rowCountRef: MutableRefObject<number>;
  colCountRef: MutableRefObject<number>;
}>;

export type ApplyTableAgentReport = Readonly<{
  applied: number;
  skipped: number;
  notes: string[];
}>;

export type ApplyTableAgentOptions = Readonly<{
  /** 每个动作单独 flush，保证删行删列后 ref 与 vc-biz 状态一致 */
  runAfterUpdate?: (fn: () => void) => void;
}>;

/**
 * 顺序执行动作。含删行/删列/插行/插列时务必传入 runAfterUpdate: flushSync。
 */
export function applyTableAgentActions(
  model: TableAreaDemoModel,
  actions: TableAgentAction[],
  dims: TableDimsRef,
  options?: ApplyTableAgentOptions
): ApplyTableAgentReport {
  const run = options?.runAfterUpdate ?? ((fn) => fn());
  const notes: string[] = [];
  let applied = 0;
  let skipped = 0;

  const {
    setRowCount,
    setColCount,
    setValueByCell,
    deleteBodyRow,
    deleteColumn,
    setEnableColumnResize,
    setEnableVerticalCenter,
    setEnableFreezeFirstCol,
    setEnableFreezeLastCol,
    setEnableFreezeLastRow,
    setEnableBodyCellRightBorder,
    setEnableShowRowIndex,
    setEnableInsertRowCol,
    setEnableEditMode,
    setEnableRegularTableFont,
    setColumnHidden,
    setAllColumnsHidden,
  } = model;

  const normalizedActions = normalizeActionsForStableIndexDeletes(actions);

  for (const action of normalizedActions) {
    run(() => {
      const rowCount = dims.rowCountRef.current;
      const colCount = dims.colCountRef.current;
      const bodyRows = Math.max(0, rowCount - 1);

      switch (action.type) {
        case 'set_cells': {
          const entries = Object.entries(action.values).filter(([k]) => isValidCellKey(k));
          if (entries.length === 0) {
            skipped += 1;
            notes.push('set_cells 无有效键，已跳过');
            break;
          }
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const [k, v] of entries) {
              if (k.startsWith('header-')) {
                const c = Number(k.split('-')[1]);
                if (!Number.isNaN(c) && c >= 0 && c < colCount) next[k] = v;
              } else {
                const [rs, cs] = k.split('-');
                const r = Number(rs);
                const c = Number(cs);
                if (!Number.isNaN(r) && !Number.isNaN(c) && r >= 0 && r < bodyRows && c >= 0 && c < colCount) {
                  next[k] = v;
                }
              }
            }
            return next;
          });
          applied += 1;
          break;
        }
        case 'insert_rows': {
          const requested = Math.trunc(Number(action.count));
          const n = clampInsertRows(action.count, rowCount);
          if (n === 0) {
            skipped += 1;
            notes.push(
              !Number.isFinite(requested) || requested <= 0
                ? 'insert_rows count 无效'
                : 'insert_rows 已达行数上限，无法再追加'
            );
            break;
          }
          if (n > 0 && requested > n) {
            notes.push(`insert_rows 请求 ${requested} 行，受表格行数上限影响实际追加 ${n} 行`);
          }
          setRowCount((r) => Math.min(TABLE_GRID_MAX_ROW, r + n));
          applied += 1;
          break;
        }
        case 'insert_columns': {
          const requested = Math.trunc(Number(action.count));
          const n = clampInsertColumns(action.count, colCount);
          if (n === 0) {
            skipped += 1;
            notes.push(
              !Number.isFinite(requested) || requested <= 0
                ? 'insert_columns count 无效'
                : 'insert_columns 已达列数上限，无法再追加'
            );
            break;
          }
          if (n > 0 && requested > n) {
            notes.push(`insert_columns 请求 ${requested} 列，受表格列数上限影响实际追加 ${n} 列`);
          }
          setColCount((c) => Math.min(TABLE_GRID_MAX_COL, c + n));
          applied += 1;
          break;
        }
        case 'insert_rows_at': {
          const requested = Math.trunc(Number(action.count));
          const n = clampInsertRows(action.count, rowCount);
          const at = Math.trunc(action.index);
          if (n === 0) {
            skipped += 1;
            notes.push('insert_rows_at count 无效或已达行数上限');
            break;
          }
          if (at < 0 || at > bodyRows) {
            skipped += 1;
            notes.push(`insert_rows_at(${at}) 插入位置越界`);
            break;
          }
          if (requested > n) {
            notes.push(`insert_rows_at 请求 ${requested} 行，受上限影响实际插入 ${n} 行`);
          }
          setValueByCell((prev) => {
            const next: Record<string, string> = {};
            for (const [k, v] of Object.entries(prev)) {
              if (k.startsWith('header-')) {
                next[k] = v;
                continue;
              }
              const [rs, cs] = k.split('-');
              const r = Number(rs);
              const c = Number(cs);
              if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
              if (r >= at) next[bodyKey(r + n, c)] = v;
              else next[k] = v;
            }
            return next;
          });
          setRowCount((r) => Math.min(TABLE_GRID_MAX_ROW, r + n));
          applied += 1;
          break;
        }
        case 'insert_columns_at': {
          const requested = Math.trunc(Number(action.count));
          const n = clampInsertColumns(action.count, colCount);
          const at = Math.trunc(action.index);
          if (n === 0) {
            skipped += 1;
            notes.push('insert_columns_at count 无效或已达列数上限');
            break;
          }
          if (at < 0 || at > colCount) {
            skipped += 1;
            notes.push(`insert_columns_at(${at}) 插入位置越界`);
            break;
          }
          if (requested > n) {
            notes.push(`insert_columns_at 请求 ${requested} 列，受上限影响实际插入 ${n} 列`);
          }
          setValueByCell((prev) => {
            const next: Record<string, string> = {};
            for (const [k, v] of Object.entries(prev)) {
              if (k.startsWith('header-')) {
                const c = Number(k.slice('header-'.length));
                if (!Number.isInteger(c)) continue;
                next[headerKey(c >= at ? c + n : c)] = v;
                continue;
              }
              const [rs, cs] = k.split('-');
              const r = Number(rs);
              const c = Number(cs);
              if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
              next[bodyKey(r, c >= at ? c + n : c)] = v;
            }
            return next;
          });
          setColCount((c) => Math.min(TABLE_GRID_MAX_COL, c + n));
          applied += 1;
          break;
        }
        case 'swap_columns': {
          const a = Math.trunc(action.colAIndex);
          const b = Math.trunc(action.colBIndex);
          if (a < 0 || a >= colCount || b < 0 || b >= colCount) {
            skipped += 1;
            notes.push(`swap_columns(${a}, ${b}) 列号越界`);
            break;
          }
          if (a === b) {
            skipped += 1;
            notes.push('swap_columns 两列相同，无需交换');
            break;
          }
          setValueByCell((prev) => {
            const next = { ...prev };
            const ha = headerKey(a);
            const hb = headerKey(b);
            const headA = prev[ha];
            const headB = prev[hb];
            if (headA === undefined) delete next[hb];
            else next[hb] = headA;
            if (headB === undefined) delete next[ha];
            else next[ha] = headB;
            for (let r = 0; r < bodyRows; r += 1) {
              const ka = bodyKey(r, a);
              const kb = bodyKey(r, b);
              const va = prev[ka];
              const vb = prev[kb];
              if (va === undefined) delete next[kb];
              else next[kb] = va;
              if (vb === undefined) delete next[ka];
              else next[ka] = vb;
            }
            return next;
          });
          applied += 1;
          break;
        }
        case 'reorder_columns': {
          const order = action.order.map((x) => Math.trunc(x));
          if (order.length !== colCount) {
            skipped += 1;
            notes.push(`reorder_columns 长度 ${order.length} 与当前列数 ${colCount} 不一致`);
            break;
          }
          const uniq = new Set(order);
          const validRange = order.every((x) => x >= 0 && x < colCount);
          if (!validRange || uniq.size !== colCount) {
            skipped += 1;
            notes.push('reorder_columns 目标顺序非法（越界或重复）');
            break;
          }
          setValueByCell((prev) => {
            const next: Record<string, string> = {};
            for (let to = 0; to < colCount; to += 1) {
              const from = order[to];
              const hFrom = headerKey(from);
              const hTo = headerKey(to);
              if (prev[hFrom] !== undefined) next[hTo] = prev[hFrom];
              for (let r = 0; r < bodyRows; r += 1) {
                const bFrom = bodyKey(r, from);
                const bTo = bodyKey(r, to);
                if (prev[bFrom] !== undefined) next[bTo] = prev[bFrom];
              }
            }
            return next;
          });
          applied += 1;
          break;
        }
        case 'sort_body_rows': {
          const keys = action.keys.map((k) => ({
            colIndex: Math.trunc(k.colIndex),
            direction: k.direction,
          }));
          if (keys.length === 0) {
            skipped += 1;
            notes.push('sort_body_rows 缺少排序键');
            break;
          }
          const invalid = keys.some((k) => k.colIndex < 0 || k.colIndex >= colCount);
          if (invalid) {
            skipped += 1;
            notes.push('sort_body_rows 存在越界列');
            break;
          }
          const rows = Array.from({ length: bodyRows }, (_, i) => i);
          rows.sort((ra, rb) => {
            for (const key of keys) {
              const va = model.valueByCell[bodyKey(ra, key.colIndex)] ?? '';
              const vb = model.valueByCell[bodyKey(rb, key.colIndex)] ?? '';
              const cmp = compareMaybeNumericText(va, vb);
              if (cmp !== 0) return key.direction === 'asc' ? cmp : -cmp;
            }
            return ra - rb;
          });
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let to = 0; to < bodyRows; to += 1) {
              const from = rows[to];
              for (let c = 0; c < colCount; c += 1) {
                const fromKey = bodyKey(from, c);
                const toKey = bodyKey(to, c);
                const fromVal = prev[fromKey];
                if (fromVal === undefined) delete next[toKey];
                else next[toKey] = fromVal;
              }
            }
            return next;
          });
          applied += 1;
          break;
        }
        case 'keep_rows_by_column_condition': {
          const c0 = Math.trunc(action.colIndex);
          if (c0 < 0 || c0 >= colCount) {
            skipped += 1;
            notes.push('keep_rows_by_column_condition 列号越界');
            break;
          }
          const kept: number[] = [];
          for (let r = 0; r < bodyRows; r += 1) {
            const raw = model.valueByCell[bodyKey(r, c0)] ?? '';
            const pass = evaluateFilterCondition(raw, action.operator, action.value, action.min, action.max, action.regex);
            if (pass) kept.push(r);
          }
          const maxDeletable = Math.max(0, rowCount - TABLE_GRID_MIN);
          const toDelete: number[] = [];
          for (let r = bodyRows - 1; r >= 0; r -= 1) {
            if (!kept.includes(r)) toDelete.push(r);
          }
          if (toDelete.length > maxDeletable) {
            skipped += 1;
            notes.push('保留筛选结果会突破最小行数限制，已跳过');
            break;
          }
          for (const r of toDelete) deleteBodyRow(r);
          applied += 1;
          break;
        }
        case 'delete_rows_by_condition': {
          const c0 = Math.trunc(action.colIndex);
          if (c0 < 0 || c0 >= colCount) {
            skipped += 1;
            notes.push('delete_rows_by_condition 列号越界');
            break;
          }
          const toDelete: number[] = [];
          for (let r = 0; r < bodyRows; r += 1) {
            const raw = model.valueByCell[bodyKey(r, c0)] ?? '';
            const pass = evaluateFilterCondition(raw, action.operator, action.value, action.min, action.max, action.regex);
            if (pass) toDelete.push(r);
          }
          const maxDeletable = Math.max(0, rowCount - TABLE_GRID_MIN);
          if (toDelete.length > maxDeletable) {
            skipped += 1;
            notes.push('删除行数会突破最小行数限制，已跳过');
            break;
          }
          for (const r of toDelete.sort((a, b) => b - a)) deleteBodyRow(r);
          applied += 1;
          break;
        }
        case 'delete_rows_by_multi_condition': {
          if (action.conditions.length === 0) {
            skipped += 1;
            notes.push('delete_rows_by_multi_condition 缺少条件');
            break;
          }
          const toDelete: number[] = [];
          for (let r = 0; r < bodyRows; r += 1) {
            const pass = evaluateMultiCondition(model, r, action.conditions, action.logic);
            if (pass) toDelete.push(r);
          }
          const maxDeletable = Math.max(0, rowCount - TABLE_GRID_MIN);
          if (toDelete.length > maxDeletable) {
            skipped += 1;
            notes.push('删除行数会突破最小行数限制，已跳过');
            break;
          }
          for (const r of toDelete.sort((a, b) => b - a)) deleteBodyRow(r);
          applied += 1;
          break;
        }
        case 'clear_column_for_condition': {
          const filterColIndex = Math.trunc(action.filterColIndex);
          const targetColIndex = Math.trunc(action.targetColIndex);
          if (filterColIndex < 0 || filterColIndex >= colCount || targetColIndex < 0 || targetColIndex >= colCount) {
            skipped += 1;
            notes.push('clear_column_for_condition 列号越界');
            break;
          }
          const matchedRows: number[] = [];
          for (let r = 0; r < bodyRows; r += 1) {
            const raw = model.valueByCell[bodyKey(r, filterColIndex)] ?? '';
            const pass = evaluateFilterCondition(raw, action.filterOperator, action.filterValue, action.filterMin, action.filterMax, action.filterRegex);
            if (pass) matchedRows.push(r);
          }
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of matchedRows) delete next[bodyKey(r, targetColIndex)];
            return next;
          });
          applied += 1;
          break;
        }
        case 'numeric_transform_for_condition': {
          const filterColIndex = Math.trunc(action.filterColIndex);
          if (filterColIndex < 0 || filterColIndex >= colCount) {
            skipped += 1;
            notes.push('numeric_transform_for_condition 筛选列号越界');
            break;
          }
          const targetColIndex = action.targetColIndex != undefined ? Math.trunc(action.targetColIndex) : filterColIndex;
          if (targetColIndex < 0 || targetColIndex >= colCount) {
            skipped += 1;
            notes.push('numeric_transform_for_condition 目标列号越界');
            break;
          }
          const matchedRows: number[] = [];
          for (let r = 0; r < bodyRows; r += 1) {
            const raw = model.valueByCell[bodyKey(r, filterColIndex)] ?? '';
            const pass = evaluateFilterCondition(raw, action.filterOperator, action.filterValue, action.filterMin, action.filterMax, action.filterRegex);
            if (pass) matchedRows.push(r);
          }
          const decimals = clampDecimals(action.decimals);
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of matchedRows) {
              const k = bodyKey(r, targetColIndex);
              const raw = prev[k];
              const n = parseCellNumber(raw);
              if (n == null) continue;
              const out = action.op === 'multiply' ? n * action.value : n + action.value;
              next[k] = formatCellNumber(out, decimals);
            }
            return next;
          });
          applied += 1;
          break;
        }
        case 'replace_text_for_condition': {
          const filterColIndex = Math.trunc(action.filterColIndex);
          if (filterColIndex < 0 || filterColIndex >= colCount) {
            skipped += 1;
            notes.push('replace_text_for_condition 筛选列号越界');
            break;
          }
          const targetColIndex = action.targetColIndex != undefined ? Math.trunc(action.targetColIndex) : filterColIndex;
          if (targetColIndex < 0 || targetColIndex >= colCount) {
            skipped += 1;
            notes.push('replace_text_for_condition 目标列号越界');
            break;
          }
          const matchedRows: number[] = [];
          for (let r = 0; r < bodyRows; r += 1) {
            const raw = model.valueByCell[bodyKey(r, filterColIndex)] ?? '';
            const pass = evaluateFilterCondition(raw, action.filterOperator, action.filterValue, action.filterMin, action.filterMax, action.filterRegex);
            if (pass) matchedRows.push(r);
          }
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of matchedRows) {
              const k = bodyKey(r, targetColIndex);
              const raw = prev[k] ?? '';
              next[k] = replaceText(raw, action.find, action.replace, false);
            }
            return next;
          });
          applied += 1;
          break;
        }
        case 'clear_row_filter': {
          notes.push('clear_row_filter 当前无非破坏性筛选状态，跳过');
          applied += 1;
          break;
        }
        case 'dedupe_rows_by_columns': {
          const cols = action.colIndices.map((c) => Math.trunc(c));
          if (cols.length === 0) {
            skipped += 1;
            notes.push('dedupe_rows_by_columns 缺少列');
            break;
          }
          if (cols.some((c) => c < 0 || c >= colCount)) {
            skipped += 1;
            notes.push('dedupe_rows_by_columns 存在越界列');
            break;
          }
          const rows = Array.from({ length: bodyRows }, (_, i) => i);
          const keepSet = new Set<number>();
          if (action.keep === 'first') {
            const seen = new Set<string>();
            for (const r of rows) {
              const sig = rowSignature(model, r, cols);
              if (seen.has(sig)) continue;
              seen.add(sig);
              keepSet.add(r);
            }
          } else {
            const seen = new Set<string>();
            for (let i = rows.length - 1; i >= 0; i -= 1) {
              const r = rows[i];
              const sig = rowSignature(model, r, cols);
              if (seen.has(sig)) continue;
              seen.add(sig);
              keepSet.add(r);
            }
          }
          const maxDeletable = Math.max(0, rowCount - TABLE_GRID_MIN);
          const toDelete: number[] = [];
          for (let r = bodyRows - 1; r >= 0; r -= 1) {
            if (!keepSet.has(r)) toDelete.push(r);
          }
          if (toDelete.length > maxDeletable) {
            skipped += 1;
            notes.push('去重删除会突破最小行数限制，已跳过');
            break;
          }
          for (const r of toDelete) deleteBodyRow(r);
          applied += 1;
          break;
        }
        case 'delete_body_row': {
          const idx = action.rowIndex;
          if (idx < 0 || idx >= bodyRows) {
            skipped += 1;
            notes.push(`delete_body_row(${idx}) 行号越界`);
            break;
          }
          if (rowCount <= TABLE_GRID_MIN) {
            skipped += 1;
            notes.push('已达最小行数，无法删除表体行');
            break;
          }
          deleteBodyRow(idx);
          applied += 1;
          break;
        }
        case 'delete_column': {
          const idx = action.colIndex;
          if (idx < 0 || idx >= colCount) {
            skipped += 1;
            notes.push(`delete_column(${idx}) 列号越界`);
            break;
          }
          if (colCount <= TABLE_GRID_MIN) {
            skipped += 1;
            notes.push('已达最小列数，无法删列');
            break;
          }
          deleteColumn(idx);
          applied += 1;
          break;
        }
        case 'delete_selected_rows': {
          const selectedRows = getSelectedBodyRows(model).sort((a, b) => b - a);
          if (selectedRows.length === 0) {
            skipped += 1;
            notes.push('delete_selected_rows 未检测到已勾选行');
            break;
          }
          const maxDeletable = Math.max(0, rowCount - TABLE_GRID_MIN);
          if (maxDeletable <= 0) {
            skipped += 1;
            notes.push('已达最小行数，无法删除选中行');
            break;
          }
          let deleted = 0;
          for (const r of selectedRows) {
            if (deleted >= maxDeletable) break;
            deleteBodyRow(r);
            deleted += 1;
          }
          if (deleted < selectedRows.length) notes.push('部分选中行未删除：已达最小行数限制');
          applied += 1;
          break;
        }
        case 'delete_empty_rows': {
          // 找出所有空行（表体行中所有单元格都为空）
          const emptyRows: number[] = [];
          for (let r = 0; r < bodyRows; r += 1) {
            let isEmpty = true;
            for (let c = 0; c < colCount; c += 1) {
              const k = bodyKey(r, c);
              const v = model.valueByCell[k];
              if (v !== undefined && v !== '') {
                isEmpty = false;
                break;
              }
            }
            if (isEmpty) emptyRows.push(r);
          }
          if (emptyRows.length === 0) {
            notes.push('delete_empty_rows 未发现空行');
            applied += 1;
            break;
          }
          const maxDeletable = Math.max(0, rowCount - TABLE_GRID_MIN);
          if (maxDeletable <= 0) {
            skipped += 1;
            notes.push('已达最小行数，无法删除空行');
            break;
          }
          // 按降序删除，避免索引错位
          const toDelete = emptyRows.sort((a, b) => b - a).slice(0, maxDeletable);
          for (const r of toDelete) {
            deleteBodyRow(r);
          }
          if (toDelete.length < emptyRows.length) {
            notes.push(`发现 ${emptyRows.length} 个空行，受最小行数限制实际删除 ${toDelete.length} 个`);
          }
          applied += 1;
          break;
        }
        case 'delete_empty_columns': {
          // 找出所有空列（表头+表体所有单元格都为空）
          const emptyCols: number[] = [];
          for (let c = 0; c < colCount; c += 1) {
            const headerVal = model.valueByCell[headerKey(c)];
            if (headerVal !== undefined && headerVal !== '') continue;
            let isEmpty = true;
            for (let r = 0; r < bodyRows; r += 1) {
              const v = model.valueByCell[bodyKey(r, c)];
              if (v !== undefined && v !== '') {
                isEmpty = false;
                break;
              }
            }
            if (isEmpty) emptyCols.push(c);
          }
          if (emptyCols.length === 0) {
            notes.push('delete_empty_columns 未发现空列');
            applied += 1;
            break;
          }
          if (colCount <= TABLE_GRID_MIN) {
            skipped += 1;
            notes.push('已达最小列数，无法删除空列');
            break;
          }
          const maxDeletable = Math.max(0, colCount - TABLE_GRID_MIN);
          // 按降序删除，避免索引错位
          const toDelete = emptyCols.sort((a, b) => b - a).slice(0, maxDeletable);
          for (const c of toDelete) {
            deleteColumn(c);
          }
          if (toDelete.length < emptyCols.length) {
            notes.push(`发现 ${emptyCols.length} 个空列，受最小列数限制实际删除 ${toDelete.length} 个`);
          }
          applied += 1;
          break;
        }
        case 'clear_all_body': {
          setValueByCell((prev) => {
            const next: Record<string, string> = {};
            for (const [k, v] of Object.entries(prev)) {
              if (k.startsWith('header-')) next[k] = v;
            }
            return next;
          });
          applied += 1;
          break;
        }
        case 'clear_selected_rows': {
          const selectedRows = getSelectedBodyRows(model);
          if (selectedRows.length === 0) {
            skipped += 1;
            notes.push('clear_selected_rows 未检测到已勾选行');
            break;
          }
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of selectedRows) {
              for (let c = 0; c < colCount; c += 1) delete next[bodyKey(r, c)];
            }
            return next;
          });
          applied += 1;
          break;
        }
        case 'clear_row': {
          const r0 = Math.trunc(action.rowIndex);
          if (r0 < 0 || r0 >= bodyRows) {
            skipped += 1;
            notes.push(`clear_row(${r0}) 行号越界`);
            break;
          }
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let c = 0; c < colCount; c += 1) delete next[bodyKey(r0, c)];
            return next;
          });
          applied += 1;
          break;
        }
        case 'clear_column': {
          const c0 = Math.trunc(action.colIndex);
          if (c0 < 0 || c0 >= colCount) {
            skipped += 1;
            notes.push(`clear_column(${c0}) 列号越界`);
            break;
          }
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) delete next[bodyKey(r, c0)];
            if (action.includeHeader) delete next[headerKey(c0)];
            return next;
          });
          applied += 1;
          break;
        }
        case 'replace_text_in_all_body': {
          if (!action.find) {
            skipped += 1;
            notes.push('replace_text_in_all_body find 不能为空');
            break;
          }
          let changed = 0;
          const matcher = action.matchCase ? action.find : action.find.toLowerCase();
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (!raw) continue;
                const source = action.matchCase ? raw : raw.toLowerCase();
                if (!source.includes(matcher)) continue;
                next[k] = replaceText(raw, action.find, action.replace, action.matchCase);
                changed += 1;
              }
            }
            return next;
          });
          if (changed === 0) notes.push('replace_text_in_all_body 未命中可替换单元格');
          applied += 1;
          break;
        }
        case 'replace_text_in_column': {
          const c0 = Math.trunc(action.colIndex);
          if (c0 < 0 || c0 >= colCount) {
            skipped += 1;
            notes.push(`replace_text_in_column(${c0}) 列号越界`);
            break;
          }
          if (!action.find) {
            skipped += 1;
            notes.push('replace_text_in_column find 不能为空');
            break;
          }
          let changed = 0;
          const matcher = action.matchCase ? action.find : action.find.toLowerCase();
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              const k = bodyKey(r, c0);
              const raw = prev[k];
              if (!raw) continue;
              const source = action.matchCase ? raw : raw.toLowerCase();
              if (!source.includes(matcher)) continue;
              next[k] = replaceText(raw, action.find, action.replace, action.matchCase);
              changed += 1;
            }
            return next;
          });
          if (changed === 0) notes.push(`replace_text_in_column 列 ${c0} 未命中可替换单元格`);
          applied += 1;
          break;
        }
        case 'replace_text_in_selected_rows': {
          if (!action.find) {
            skipped += 1;
            notes.push('replace_text_in_selected_rows find 不能为空');
            break;
          }
          const selectedRows = getSelectedBodyRows(model);
          if (selectedRows.length === 0) {
            skipped += 1;
            notes.push('replace_text_in_selected_rows 未检测到已勾选行');
            break;
          }
          let changed = 0;
          const matcher = action.matchCase ? action.find : action.find.toLowerCase();
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of selectedRows) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (!raw) continue;
                const source = action.matchCase ? raw : raw.toLowerCase();
                if (!source.includes(matcher)) continue;
                next[k] = replaceText(raw, action.find, action.replace, action.matchCase);
                changed += 1;
              }
            }
            return next;
          });
          if (changed === 0) notes.push('replace_text_in_selected_rows 未命中可替换单元格');
          applied += 1;
          break;
        }
        case 'trim_whitespace_in_all_body': {
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (raw === undefined) continue;
                const trimmed = raw.trim();
                if (trimmed !== raw) {
                  next[k] = trimmed;
                  changed += 1;
                }
              }
            }
            return next;
          });
          if (changed === 0) notes.push('trim_whitespace_in_all_body 未命中需要修剪的单元格');
          applied += 1;
          break;
        }
        case 'trim_whitespace_in_column': {
          const c0 = Math.trunc(action.colIndex);
          if (c0 < 0 || c0 >= colCount) {
            skipped += 1;
            notes.push(`trim_whitespace_in_column(${c0}) 列号越界`);
            break;
          }
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              const k = bodyKey(r, c0);
              const raw = prev[k];
              if (raw === undefined) continue;
              const trimmed = raw.trim();
              if (trimmed !== raw) {
                next[k] = trimmed;
                changed += 1;
              }
            }
            return next;
          });
          if (changed === 0) notes.push(`trim_whitespace_in_column 列 ${c0} 未命中需要修剪的单元格`);
          applied += 1;
          break;
        }
        case 'trim_whitespace_in_selected_rows': {
          const selectedRows = getSelectedBodyRows(model);
          if (selectedRows.length === 0) {
            skipped += 1;
            notes.push('trim_whitespace_in_selected_rows 未检测到已勾选行');
            break;
          }
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of selectedRows) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (raw === undefined) continue;
                const trimmed = raw.trim();
                if (trimmed !== raw) {
                  next[k] = trimmed;
                  changed += 1;
                }
              }
            }
            return next;
          });
          if (changed === 0) notes.push('trim_whitespace_in_selected_rows 未命中需要修剪的单元格');
          applied += 1;
          break;
        }
        case 'normalize_case_in_all_body': {
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (raw === undefined) continue;
                const out = action.mode === 'upper' ? raw.toUpperCase() : raw.toLowerCase();
                if (out !== raw) {
                  next[k] = out;
                  changed += 1;
                }
              }
            }
            return next;
          });
          if (changed === 0) notes.push('normalize_case_in_all_body 未命中可转换单元格');
          applied += 1;
          break;
        }
        case 'normalize_case_in_column': {
          const c0 = Math.trunc(action.colIndex);
          if (c0 < 0 || c0 >= colCount) {
            skipped += 1;
            notes.push(`normalize_case_in_column(${c0}) 列号越界`);
            break;
          }
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              const k = bodyKey(r, c0);
              const raw = prev[k];
              if (raw === undefined) continue;
              const out = action.mode === 'upper' ? raw.toUpperCase() : raw.toLowerCase();
              if (out !== raw) {
                next[k] = out;
                changed += 1;
              }
            }
            return next;
          });
          if (changed === 0) notes.push(`normalize_case_in_column 列 ${c0} 未命中可转换单元格`);
          applied += 1;
          break;
        }
        case 'normalize_case_in_selected_rows': {
          const selectedRows = getSelectedBodyRows(model);
          if (selectedRows.length === 0) {
            skipped += 1;
            notes.push('normalize_case_in_selected_rows 未检测到已勾选行');
            break;
          }
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of selectedRows) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (raw === undefined) continue;
                const out = action.mode === 'upper' ? raw.toUpperCase() : raw.toLowerCase();
                if (out !== raw) {
                  next[k] = out;
                  changed += 1;
                }
              }
            }
            return next;
          });
          if (changed === 0) notes.push('normalize_case_in_selected_rows 未命中可转换单元格');
          applied += 1;
          break;
        }
        case 'fill_empty_in_all_body': {
          const fill = action.value;
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (raw === undefined || raw === '') {
                  next[k] = fill;
                  changed += 1;
                }
              }
            }
            return next;
          });
          if (changed === 0) notes.push('fill_empty_in_all_body 未命中空单元格');
          applied += 1;
          break;
        }
        case 'fill_empty_in_column': {
          const c0 = Math.trunc(action.colIndex);
          if (c0 < 0 || c0 >= colCount) {
            skipped += 1;
            notes.push(`fill_empty_in_column(${c0}) 列号越界`);
            break;
          }
          const fill = action.value;
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              const k = bodyKey(r, c0);
              const raw = prev[k];
              if (raw === undefined || raw === '') {
                next[k] = fill;
                changed += 1;
              }
            }
            return next;
          });
          if (changed === 0) notes.push(`fill_empty_in_column 列 ${c0} 未命中空单元格`);
          applied += 1;
          break;
        }
        case 'fill_empty_in_selected_rows': {
          const selectedRows = getSelectedBodyRows(model);
          if (selectedRows.length === 0) {
            skipped += 1;
            notes.push('fill_empty_in_selected_rows 未检测到已勾选行');
            break;
          }
          const fill = action.value;
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of selectedRows) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (raw === undefined || raw === '') {
                  next[k] = fill;
                  changed += 1;
                }
              }
            }
            return next;
          });
          if (changed === 0) notes.push('fill_empty_in_selected_rows 未命中空单元格');
          applied += 1;
          break;
        }
        case 'numeric_transform_in_selected_rows': {
          const selectedRows = getSelectedBodyRows(model);
          if (selectedRows.length === 0) {
            skipped += 1;
            notes.push('numeric_transform_in_selected_rows 未检测到已勾选行');
            break;
          }
          const dec = clampDecimals(action.decimals);
          const v = action.value;
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of selectedRows) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (raw === undefined || raw === '') continue;
                const n = parseCellNumber(raw);
                if (n === null) continue;
                const out = action.op === 'multiply' ? n * v : n + v;
                next[k] = formatCellNumber(out, dec);
                changed += 1;
              }
            }
            return next;
          });
          if (changed === 0) notes.push('numeric_transform_in_selected_rows 未命中可解析数字单元格');
          applied += 1;
          break;
        }
        case 'round_in_selected_rows': {
          const selectedRows = getSelectedBodyRows(model);
          if (selectedRows.length === 0) {
            skipped += 1;
            notes.push('round_in_selected_rows 未检测到已勾选行');
            break;
          }
          const dec = clampDecimals(action.decimals);
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (const r of selectedRows) {
              for (let c = 0; c < colCount; c += 1) {
                const k = bodyKey(r, c);
                const raw = prev[k];
                if (raw === undefined || raw === '') continue;
                const n = parseCellNumber(raw);
                if (n === null) continue;
                next[k] = formatCellNumber(n, dec);
                changed += 1;
              }
            }
            return next;
          });
          if (changed === 0) notes.push('round_in_selected_rows 未命中可解析数字单元格');
          applied += 1;
          break;
        }
        case 'column_numeric_transform': {
          const c = action.colIndex;
          if (c < 0 || c >= colCount) {
            skipped += 1;
            notes.push(`column_numeric_transform 列 ${c} 越界`);
            break;
          }
          const dec = clampDecimals(action.decimals);
          const v = action.value;
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              const k = `${r}-${c}`;
              const raw = prev[k];
              if (raw === undefined || raw === '') continue;
              const n = parseCellNumber(raw);
              if (n === null) continue;
              const out = action.op === 'multiply' ? n * v : n + v;
              next[k] = formatCellNumber(out, dec);
              changed += 1;
            }
            return next;
          });
          if (changed === 0) {
            notes.push(`列 ${c} 未找到可解析为数字的表体单元格`);
          }
          applied += 1;
          break;
        }
        case 'column_round': {
          const c = action.colIndex;
          if (c < 0 || c >= colCount) {
            skipped += 1;
            notes.push(`column_round 列 ${c} 越界`);
            break;
          }
          const dec = clampDecimals(action.decimals);
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              const k = bodyKey(r, c);
              const raw = prev[k];
              if (raw === undefined || raw === '') continue;
              const n = parseCellNumber(raw);
              if (n === null) continue;
              next[k] = formatCellNumber(n, dec);
              changed += 1;
            }
            return next;
          });
          if (changed === 0) notes.push(`列 ${c} 未找到可解析为数字的表体单元格`);
          applied += 1;
          break;
        }
        case 'convert_column_unit': {
          const c = action.colIndex;
          if (c < 0 || c >= colCount) {
            skipped += 1;
            notes.push(`convert_column_unit 列 ${c} 越界`);
            break;
          }
          if (!Number.isFinite(action.factor) || action.factor === 0) {
            skipped += 1;
            notes.push('convert_column_unit factor 非法');
            break;
          }
          const dec = clampDecimals(action.decimals);
          let changed = 0;
          setValueByCell((prev) => {
            const next = { ...prev };
            for (let r = 0; r < bodyRows; r += 1) {
              const k = bodyKey(r, c);
              const raw = prev[k];
              if (raw === undefined || raw === '') continue;
              const n = parseCellNumber(raw);
              if (n === null) continue;
              next[k] = formatCellNumber(n * action.factor, dec);
              changed += 1;
            }
            return next;
          });
          if (changed === 0) notes.push(`列 ${c} 未找到可解析为数字的表体单元格`);
          applied += 1;
          break;
        }
        case 'set_table_flags': {
          const f = action.flags;
          if (f.enableColumnResize !== undefined) setEnableColumnResize(f.enableColumnResize);
          if (f.enableVerticalCenter !== undefined) setEnableVerticalCenter(f.enableVerticalCenter);
          if (f.enableFreezeFirstCol !== undefined) setEnableFreezeFirstCol(f.enableFreezeFirstCol);
          if (f.enableFreezeLastCol !== undefined) setEnableFreezeLastCol(f.enableFreezeLastCol);
          if (f.enableFreezeLastRow !== undefined) setEnableFreezeLastRow(f.enableFreezeLastRow);
          if (f.enableBodyCellRightBorder !== undefined) {
            setEnableBodyCellRightBorder(f.enableBodyCellRightBorder);
          }
          if (f.enableShowRowIndex !== undefined) setEnableShowRowIndex(f.enableShowRowIndex);
          if (f.enableInsertRowCol !== undefined) setEnableInsertRowCol(f.enableInsertRowCol);
          if (f.enableEditMode !== undefined) setEnableEditMode(f.enableEditMode);
          if (f.enableRegularTableFont !== undefined) {
            setEnableRegularTableFont(f.enableRegularTableFont);
          }
          applied += 1;
          break;
        }
        case 'set_column_hidden': {
          if (typeof setColumnHidden !== 'function') {
            skipped += 1;
            notes.push('set_column_hidden：当前表格未暴露列隐藏能力');
            break;
          }
          const c0 = Math.trunc(action.colIndex);
          if (c0 < 0 || c0 >= colCount) {
            skipped += 1;
            notes.push(`set_column_hidden(${c0}) 列号越界`);
            break;
          }
          setColumnHidden(c0, action.hidden);
          applied += 1;
          break;
        }
        case 'clear_hidden_columns': {
          if (typeof setAllColumnsHidden !== 'function') {
            skipped += 1;
            notes.push('clear_hidden_columns：当前表格未暴露列隐藏能力');
            break;
          }
          setAllColumnsHidden(new Set());
          applied += 1;
          break;
        }
        default:
          skipped += 1;
      }
    });
  }

  return { applied, skipped, notes };
}
