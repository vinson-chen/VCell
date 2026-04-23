import type { TableAreaDemoModel } from 'vc-biz';
import type { TableAgentAction, FilterOperator, SingleFilterCondition } from './tableAgentTypes';

export type QuickRuleMatch = Readonly<{
  reply: string;
  actions: TableAgentAction[];
}>;

export type QuickRuleDef = Readonly<{
  id: string;
  intent: string;
  priority: number;
  patterns: RegExp[];
  run: (text: string, model: TableAreaDemoModel, match: RegExpMatchArray) => QuickRuleMatch | null;
}>;

function parsePosInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function findColumnByHeaderKeyword(model: TableAreaDemoModel, kw: string): number | null {
  for (let c = 0; c < model.colCount; c += 1) {
    const h = model.valueByCell[`header-${c}`] ?? '';
    if (h.includes(kw)) return c;
  }
  return null;
}

function parseColumnIndexOrHeaderHint(text: string, model: TableAreaDemoModel): number | null {
  if (text.includes('首列')) return model.colCount > 0 ? 0 : null;
  if (text.includes('末列') || text.includes('最后一列')) return model.colCount > 0 ? model.colCount - 1 : null;
  const m = text.match(/第\s*(\d+)\s*列/);
  if (m) {
    const n = parsePosInt(m[1]);
    if (n == null) return null;
    const idx = n - 1;
    return idx >= 0 && idx < model.colCount ? idx : null;
  }
  const hints = ['价格', '售价', '单价', '金额'];
  for (const h of hints) {
    if (text.includes(h)) return findColumnByHeaderKeyword(model, h);
  }
  return null;
}

function parseBatchHeaderRenamePairs(text: string): Array<{ col: number; name: string }> {
  const out: Array<{ col: number; name: string }> = [];
  const re =
    /第\s*(\d+)\s*列(?:表头|标题)?(?:改为|改成|重命名为|命名为)(?:“([^”]+)”|"([^"]+)")/g;
  let m: RegExpExecArray | null;
  do {
    m = re.exec(text);
    if (!m) break;
    const col = parsePosInt(m[1]);
    const name = (m[2] ?? m[3] ?? '').trim();
    if (col == null || name === '') continue;
    out.push({ col, name });
  } while (m);
  return out;
}

function parseColumnOrderIndices(text: string): number[] {
  const out: number[] = [];
  const re = /第\s*(\d+)\s*列/g;
  let m: RegExpExecArray | null;
  do {
    m = re.exec(text);
    if (!m) break;
    const col = parsePosInt(m[1]);
    if (col == null) continue;
    out.push(col - 1);
  } while (m);
  return out;
}

function parseSortKeysFromText(text: string, colCount: number): Array<{ colIndex: number; direction: 'asc' | 'desc' }> {
  const keys: Array<{ colIndex: number; direction: 'asc' | 'desc' }> = [];
  const re = /第\s*(\d+)\s*列\s*(升序|降序)?/g;
  let m: RegExpExecArray | null;
  do {
    m = re.exec(text);
    if (!m) break;
    const col = parsePosInt(m[1]);
    if (col == null) continue;
    const colIndex = col - 1;
    if (colIndex < 0 || colIndex >= colCount) continue;
    keys.push({
      colIndex,
      direction: m[2] === '降序' ? 'desc' : 'asc',
    });
  } while (m);
  return keys;
}

function parseUnitConversion(text: string): { factor: number; from: string; to: string } | null {
  if (/元\s*(?:转|换成|到)\s*分/.test(text)) return { factor: 100, from: '元', to: '分' };
  if (/分\s*(?:转|换成|到)\s*元/.test(text)) return { factor: 0.01, from: '分', to: '元' };
  if (/kg\s*(?:转|换成|到)\s*g/i.test(text)) return { factor: 1000, from: 'kg', to: 'g' };
  if (/g\s*(?:转|换成|到)\s*kg/i.test(text)) return { factor: 0.001, from: 'g', to: 'kg' };
  return null;
}

const SELECTED_ROW_WORD = '(?:选中|已选中|勾选|已勾选|当前勾选)';

export const QUICK_RULE_SCHEMA: QuickRuleDef[] = [
  {
    id: 'delete_empty_rows',
    intent: 'delete_empty_rows',
    priority: 307,
    patterns: [
      /^(?:请)?(?:删除|删)空行$/,
      /^(?:请)?(?:删除|删)(?:所有|全部)空行$/,
      /^(?:请)?(?:把)?空行(?:删除|删掉|清除)$/,
      /^(?:请)?(?:清空|清除)空行$/,
    ],
    run: () => ({
      reply: '已按预设规则删除空行。',
      actions: [{ type: 'delete_empty_rows' }],
    }),
  },
  {
    id: 'delete_empty_columns',
    intent: 'delete_empty_columns',
    priority: 306,
    patterns: [
      /^(?:请)?(?:删除|删)空列$/,
      /^(?:请)?(?:删除|删)(?:所有|全部)空列$/,
      /^(?:请)?(?:把)?空列(?:删除|删掉|清除)$/,
      /^(?:请)?(?:清空|清除)空列$/,
    ],
    run: () => ({
      reply: '已按预设规则删除空列。',
      actions: [{ type: 'delete_empty_columns' }],
    }),
  },
  {
    id: 'delete_selected_rows',
    intent: 'delete_selected_rows',
    priority: 305,
    patterns: [
      new RegExp(`^(?:请)?(?:删除|删)${SELECTED_ROW_WORD}(?:的)?行$`),
      new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:删除|删掉)$`),
    ],
    run: () => ({
      reply: '已按预设规则删除选中行。',
      actions: [{ type: 'delete_selected_rows' }],
    }),
  },
  {
    id: 'delete_last_rows',
    intent: 'delete_body_row_tail',
    priority: 305,
    patterns: [/^(?:请)?(?:删除|删)(?:最后|末尾)\s*(\d+)\s*行$/],
    run: (_text, model, m) => {
      const count = parsePosInt(m[1]);
      if (count == null) return null;
      const bodyRows = Math.max(0, model.rowCount - 1);
      if (bodyRows <= 0) return null;
      const n = Math.min(count, bodyRows);
      const actions: TableAgentAction[] = [];
      for (let i = 0; i < n; i += 1) {
        actions.push({ type: 'delete_body_row', rowIndex: bodyRows - 1 - i });
      }
      return {
        reply: `已按预设规则删除最后 ${n} 行。`,
        actions,
      };
    },
  },
  {
    id: 'delete_last_columns',
    intent: 'delete_column_tail',
    priority: 304,
    patterns: [/^(?:请)?(?:删除|删)(?:最后|末尾)\s*(\d+)\s*列$/],
    run: (_text, model, m) => {
      const count = parsePosInt(m[1]);
      if (count == null) return null;
      const colCount = Math.max(0, model.colCount);
      if (colCount <= 0) return null;
      const n = Math.min(count, colCount);
      const actions: TableAgentAction[] = [];
      for (let i = 0; i < n; i += 1) {
        actions.push({ type: 'delete_column', colIndex: colCount - 1 - i });
      }
      return {
        reply: `已按预设规则删除最后 ${n} 列。`,
        actions,
      };
    },
  },
  {
    id: 'insert_rows_at_before_row',
    intent: 'insert_rows_at',
    priority: 300,
    patterns: [
      /^(?:请)?在第\s*(\d+)\s*行(?:前|之前|前面|上方)(?:插入|新增|增加|加)\s*(\d+)\s*行$/,
      /^(?:请)?(?:在)?第\s*(\d+)\s*行(?:前|之前|前面|上方)(?:插|加)\s*(\d+)\s*行$/,
      /^(?:请)?第\s*(\d+)\s*行(?:前|之前|前面|上方)(?:插入|新增|增加|加)\s*(\d+)\s*行$/,
    ],
    run: (_text, _model, m) => {
      const row = parsePosInt(m[1]);
      const count = parsePosInt(m[2]);
      if (row == null || count == null) return null;
      return {
        reply: `已按预设规则在第 ${row} 行前插入 ${count} 行。`,
        actions: [{ type: 'insert_rows_at', index: row - 1, count }],
      };
    },
  },
  {
    id: 'insert_columns_at_left_col',
    intent: 'insert_columns_at',
    priority: 295,
    patterns: [
      /^(?:请)?在第\s*(\d+)\s*列(?:左|左侧|左边|前面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
      /^(?:请)?(?:在)?第\s*(\d+)\s*列(?:左|左侧|左边|前面)(?:插|加)\s*(\d+)\s*列$/,
      /^(?:请)?第\s*(\d+)\s*列(?:左|左侧|左边|前面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
    ],
    run: (_text, _model, m) => {
      const col = parsePosInt(m[1]);
      const count = parsePosInt(m[2]);
      if (col == null || count == null) return null;
      return {
        reply: `已按预设规则在第 ${col} 列左侧插入 ${count} 列。`,
        actions: [{ type: 'insert_columns_at', index: col - 1, count }],
      };
    },
  },
  {
    id: 'insert_columns_at_left_first_col',
    intent: 'insert_columns_at',
    priority: 294,
    patterns: [
      /^(?:请)?在首列(?:左|左侧|左边|前|前面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
      /^(?:请)?首列(?:左|左侧|左边|前|前面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
    ],
    run: (_text, _model, m) => {
      const count = parsePosInt(m[1]);
      if (count == null) return null;
      return {
        reply: `已按预设规则在首列左侧插入 ${count} 列。`,
        actions: [{ type: 'insert_columns_at', index: 0, count }],
      };
    },
  },
  {
    id: 'insert_columns_at_left_last_col',
    intent: 'insert_columns_at',
    priority: 291,
    patterns: [
      /^(?:请)?在(?:末列|最后一列)(?:左|左侧|左边|前面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
      /^(?:请)?(?:末列|最后一列)(?:左|左侧|左边|前面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
      /^(?:请)?在(?:末列|最后一列)(?:左|左侧|左边|前面)(?:插|加)\s*(\d+)\s*列$/,
      /^(?:请)?(?:末列|最后一列)(?:左|左侧|左边|前面)(?:插|加)\s*(\d+)\s*列$/,
    ],
    run: (_text, model, m) => {
      const count = parsePosInt(m[1]);
      if (count == null || model.colCount < 1) return null;
      const index = model.colCount - 1;
      return {
        reply: `已按预设规则在最后一列左侧插入 ${count} 列。`,
        actions: [{ type: 'insert_columns_at', index, count }],
      };
    },
  },
  {
    id: 'insert_rows_at_after_row',
    intent: 'insert_rows_at',
    priority: 294,
    patterns: [
      /^(?:请)?在第\s*(\d+)\s*行(?:后|之后|后面|下方)(?:插入|新增|增加|加)\s*(\d+)\s*行$/,
      /^(?:请)?(?:在)?第\s*(\d+)\s*行(?:后|之后|后面|下方)(?:插|加)\s*(\d+)\s*行$/,
      /^(?:请)?第\s*(\d+)\s*行(?:后|之后|后面|下方)(?:插入|新增|增加|加)\s*(\d+)\s*行$/,
    ],
    run: (_text, _model, m) => {
      const row = parsePosInt(m[1]);
      const count = parsePosInt(m[2]);
      if (row == null || count == null) return null;
      return {
        reply: `已按预设规则在第 ${row} 行后插入 ${count} 行。`,
        actions: [{ type: 'insert_rows_at', index: row, count }],
      };
    },
  },
  {
    id: 'insert_columns_at_right_col',
    intent: 'insert_columns_at',
    priority: 293,
    patterns: [
      /^(?:请)?在第\s*(\d+)\s*列(?:右|右侧|右边|后面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
      /^(?:请)?(?:在)?第\s*(\d+)\s*列(?:右|右侧|右边|后面)(?:插|加)\s*(\d+)\s*列$/,
      /^(?:请)?第\s*(\d+)\s*列(?:右|右侧|右边|后面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
    ],
    run: (_text, _model, m) => {
      const col = parsePosInt(m[1]);
      const count = parsePosInt(m[2]);
      if (col == null || count == null) return null;
      return {
        reply: `已按预设规则在第 ${col} 列右侧插入 ${count} 列。`,
        actions: [{ type: 'insert_columns_at', index: col, count }],
      };
    },
  },
  {
    id: 'insert_columns_at_right_first_col',
    intent: 'insert_columns_at',
    priority: 292,
    patterns: [
      /^(?:请)?在首列(?:右|右侧|右边|后|后面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
      /^(?:请)?首列(?:右|右侧|右边|后|后面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
    ],
    run: (_text, _model, m) => {
      const count = parsePosInt(m[1]);
      if (count == null) return null;
      return {
        reply: `已按预设规则在首列右侧插入 ${count} 列。`,
        actions: [{ type: 'insert_columns_at', index: 1, count }],
      };
    },
  },
  {
    id: 'insert_columns_at_right_last_col',
    intent: 'insert_columns_at',
    priority: 290,
    patterns: [
      /^(?:请)?在(?:末列|最后一列)(?:右|右侧|右边|后面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
      /^(?:请)?(?:末列|最后一列)(?:右|右侧|右边|后面)(?:插入|新增|增加|加)\s*(\d+)\s*列$/,
      /^(?:请)?在(?:末列|最后一列)(?:右|右侧|右边|后面)(?:插|加)\s*(\d+)\s*列$/,
      /^(?:请)?(?:末列|最后一列)(?:右|右侧|右边|后面)(?:插|加)\s*(\d+)\s*列$/,
    ],
    run: (_text, model, m) => {
      const count = parsePosInt(m[1]);
      if (count == null || model.colCount < 1) return null;
      return {
        reply: `已按预设规则在最后一列右侧插入 ${count} 列。`,
        actions: [{ type: 'insert_columns_at', index: model.colCount, count }],
      };
    },
  },
  {
    id: 'clear_selected_rows',
    intent: 'clear_selected_rows',
    priority: 281,
    patterns: [
      new RegExp(`^(?:请)?(?:清空|清除)${SELECTED_ROW_WORD}(?:行|的行)(?:内容|数据|单元格)?$`),
      new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:行|的行)(?:内容|数据|单元格)?(?:清空|清除)$`),
      new RegExp(`^(?:请)?(?:帮我)?(?:把)?${SELECTED_ROW_WORD}(?:行|的行)(?:内容|数据|单元格)?清掉$`),
    ],
    run: () => ({
      reply: '已按预设规则清空选中行内容。',
      actions: [{ type: 'clear_selected_rows' }],
    }),
  },
  {
    id: 'clear_all_body',
    intent: 'clear_all_body',
    priority: 280,
    patterns: [
      /^(?:请)?(?:清空|清除)(?:全表|所有|全部)(?:内容)?(?:（?保留表头）?)?$/,
      /^(?:请)?(?:清空|清除)(?:所有|全部)?表体(?:内容)?(?:（?保留表头）?)?$/,
      /^(?:请)?(?:清空|清除)(?:全表体)(?:内容)?(?:（?保留表头）?)?$/,
      /^(?:请)?(?:把)?表体(?:全部|所有)?(?:内容)?(?:都)?(?:清空|清除)$/,
      /^(?:请)?(?:清空|清除)(?:全表体|所有表体|全部表体)(?:数据)?$/,
    ],
    run: () => ({
      reply: '已按预设规则清空全部表体内容（保留表头）。',
      actions: [{ type: 'clear_all_body' }],
    }),
  },
  {
    id: 'clear_first_column',
    intent: 'clear_column',
    priority: 276,
    patterns: [
      /^(?:请)?(?:清空|清除)首列(?:内容)?$/,
      /^(?:请)?(?:把)?首列(?:都)?(?:清空|清除)$/,
    ],
    run: () => ({
      reply: '已按预设规则清空首列内容。',
      actions: [{ type: 'clear_column', colIndex: 0 }],
    }),
  },
  {
    id: 'clear_last_column',
    intent: 'clear_column',
    priority: 275,
    patterns: [
      /^(?:请)?(?:清空|清除)(?:末列|最后一列)(?:内容)?$/,
      /^(?:请)?(?:把)?(?:末列|最后一列)(?:都)?(?:清空|清除)$/,
    ],
    run: (_text, model) => {
      if (model.colCount <= 0) return null;
      const colIndex = model.colCount - 1;
      return {
        reply: '已按预设规则清空末列内容。',
        actions: [{ type: 'clear_column', colIndex }],
      };
    },
  },
  {
    id: 'clear_column_by_index',
    intent: 'clear_column',
    priority: 275,
    patterns: [
      /^(?:请)?(?:清空|清除)第\s*(\d+)\s*列(?:内容)?$/,
      /^(?:请)?(?:清空|清除)第\s*(\d+)\s*列(?:的)?(?:数据|单元格)?$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:都)?(?:清空|清除)$/,
    ],
    run: (_text, _model, m) => {
      const col = parsePosInt(m[1]);
      if (col == null) return null;
      return {
        reply: `已按预设规则清空第 ${col} 列内容。`,
        actions: [{ type: 'clear_column', colIndex: col - 1 }],
      };
    },
  },
  {
    id: 'clear_column_by_header',
    intent: 'clear_column',
    priority: 270,
    patterns: [/^(?:请)?(?:清空|清除)(.+)列(?:内容)?$/],
    run: (_text, model, m) => {
      const kw = (m[1] ?? '').trim();
      if (!kw) return null;
      const c = findColumnByHeaderKeyword(model, kw);
      if (c == null) return null;
      return {
        reply: `已按预设规则清空「${kw}」列内容。`,
        actions: [{ type: 'clear_column', colIndex: c }],
      };
    },
  },
  {
    id: 'clear_row',
    intent: 'clear_row',
    priority: 265,
    patterns: [
      /^(?:请)?(?:清空|清除)第\s*(\d+)\s*行(?:内容)?$/,
      /^(?:请)?(?:清空|清除)第\s*(\d+)\s*行(?:的)?(?:数据|单元格)?$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*行(?:都)?(?:清空|清除)$/,
    ],
    run: (_text, _model, m) => {
      const row = parsePosInt(m[1]);
      if (row == null) return null;
      return {
        reply: `已按预设规则清空第 ${row} 行内容。`,
        actions: [{ type: 'clear_row', rowIndex: row - 1 }],
      };
    },
  },
  {
    id: 'swap_two_columns',
    intent: 'swap_columns',
    priority: 257,
    patterns: [
      /^(?:请)?(?:交换|互换)第\s*(\d+)\s*列(?:和|与)第\s*(\d+)\s*列$/,
      /^(?:请)?第\s*(\d+)\s*列(?:和|与)第\s*(\d+)\s*列(?:交换|互换)$/,
    ],
    run: (_text, model, m) => {
      const a = parsePosInt(m[1]);
      const b = parsePosInt(m[2]);
      if (a == null || b == null || a === b) return null;
      const aIdx = a - 1;
      const bIdx = b - 1;
      if (aIdx < 0 || aIdx >= model.colCount || bIdx < 0 || bIdx >= model.colCount) return null;
      return {
        reply: `已按预设规则交换第 ${a} 列与第 ${b} 列。`,
        actions: [{ type: 'swap_columns', colAIndex: aIdx, colBIndex: bIdx }],
      };
    },
  },
  {
    id: 'hide_column_by_index',
    intent: 'set_column_hidden',
    priority: 260,
    patterns: [
      /^(?:请)?隐藏第\s*(\d+)\s*列$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列隐藏$/,
      /^(?:请)?第\s*(\d+)\s*列(?:隐藏|不显示)$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      if (col == null) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已按预设规则隐藏第 ${col} 列。`,
        actions: [{ type: 'set_column_hidden', colIndex, hidden: true }],
      };
    },
  },
  {
    id: 'hide_column_by_alias',
    intent: 'set_column_hidden',
    priority: 259,
    patterns: [
      /^(?:请)?隐藏(?:首列|末列|最后一列)$/,
      /^(?:请)?(?:把)?(?:首列|末列|最后一列)隐藏$/,
      /^(?:请)?(?:首列|末列|最后一列)(?:隐藏|不显示)$/,
    ],
    run: (_text, model, m) => {
      const colIndex = parseColumnIndexOrHeaderHint(m[0] ?? '', model);
      if (colIndex == null) return null;
      return {
        reply: `已按预设规则隐藏第 ${colIndex + 1} 列。`,
        actions: [{ type: 'set_column_hidden', colIndex, hidden: true }],
      };
    },
  },
  {
    id: 'hide_column_by_header_keyword',
    intent: 'set_column_hidden',
    priority: 258,
    patterns: [/^(?:请)?隐藏(.+?)列$/],
    run: (_text, model, m) => {
      const kw = (m[1] ?? '').trim();
      if (!kw || /^第\s*\d+/.test(kw)) return null;
      const c = findColumnByHeaderKeyword(model, kw);
      if (c == null) return null;
      return {
        reply: `已按预设规则隐藏「${kw}」列。`,
        actions: [{ type: 'set_column_hidden', colIndex: c, hidden: true }],
      };
    },
  },
  {
    id: 'show_column_by_index',
    intent: 'set_column_hidden',
    priority: 260,
    patterns: [
      /^(?:请)?(?:显示|展示)第\s*(\d+)\s*列$/,
      /^(?:请)?(?:取消隐藏|取消\s*隐藏)第\s*(\d+)\s*列$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:显示|展示|取消隐藏)$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      if (col == null) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已按预设规则显示第 ${col} 列。`,
        actions: [{ type: 'set_column_hidden', colIndex, hidden: false }],
      };
    },
  },
  {
    id: 'show_column_by_alias',
    intent: 'set_column_hidden',
    priority: 259,
    patterns: [
      /^(?:请)?(?:显示|展示)(?:首列|末列|最后一列)$/,
      /^(?:请)?(?:取消隐藏|取消\s*隐藏)(?:首列|末列|最后一列)$/,
      /^(?:请)?(?:把)?(?:首列|末列|最后一列)(?:显示|展示|取消隐藏)$/,
    ],
    run: (_text, model, m) => {
      const colIndex = parseColumnIndexOrHeaderHint(m[0] ?? '', model);
      if (colIndex == null) return null;
      return {
        reply: `已按预设规则显示第 ${colIndex + 1} 列。`,
        actions: [{ type: 'set_column_hidden', colIndex, hidden: false }],
      };
    },
  },
  {
    id: 'show_column_by_header_keyword',
    intent: 'set_column_hidden',
    priority: 258,
    patterns: [/^(?:请)?(?:显示|展示)(.+?)列$/, /^(?:请)?(?:取消隐藏|取消\s*隐藏)(.+?)列$/],
    run: (_text, model, m) => {
      const kw = (m[1] ?? '').trim();
      if (!kw || /^第\s*\d+/.test(kw)) return null;
      const c = findColumnByHeaderKeyword(model, kw);
      if (c == null) return null;
      return {
        reply: `已按预设规则显示「${kw}」列。`,
        actions: [{ type: 'set_column_hidden', colIndex: c, hidden: false }],
      };
    },
  },
  {
    id: 'clear_all_hidden_columns',
    intent: 'clear_hidden_columns',
    priority: 257,
    patterns: [
      /^(?:请)?(?:显示|展示)所有列$/,
      /^(?:请)?(?:显示|展示)全部列$/,
      /^(?:请)?取消(?:全部|所有)隐藏(?:列)?$/,
      /^(?:请)?(?:显示|展示)全部隐藏列$/,
    ],
    run: () => ({
      reply: '已按预设规则显示全部列（已取消列隐藏）。',
      actions: [{ type: 'clear_hidden_columns' }],
    }),
  },
  {
    id: 'trim_whitespace_in_selected_rows',
    intent: 'trim_whitespace_in_selected_rows',
    priority: 256,
    patterns: [
      new RegExp(`^(?:请)?(?:去除|删除|清理)${SELECTED_ROW_WORD}(?:的)?行(?:的)?(?:首尾空格|两端空格|前后空格)$`),
      new RegExp(`^(?:请)?${SELECTED_ROW_WORD}(?:的)?行(?:去除|删除|清理)(?:首尾空格|两端空格|前后空格)$`),
    ],
    run: () => ({
      reply: '已按预设规则去除选中行首尾空格。',
      actions: [{ type: 'trim_whitespace_in_selected_rows' }],
    }),
  },
  {
    id: 'trim_whitespace_in_column',
    intent: 'trim_whitespace_in_column',
    priority: 255,
    patterns: [
      /^(?:请)?(?:去除|删除|清理)第\s*(\d+)\s*列(?:的)?(?:首尾空格|两端空格|前后空格)$/,
      /^(?:请)?第\s*(\d+)\s*列(?:去除|删除|清理)(?:首尾空格|两端空格|前后空格)$/,
      /^(?:请)?(?:去除|删除|清理)首列(?:的)?(?:首尾空格|两端空格|前后空格)$/,
      /^(?:请)?首列(?:去除|删除|清理)(?:首尾空格|两端空格|前后空格)$/,
      /^(?:请)?(?:去除|删除|清理)(?:末列|最后一列)(?:的)?(?:首尾空格|两端空格|前后空格)$/,
      /^(?:请)?(?:末列|最后一列)(?:去除|删除|清理)(?:首尾空格|两端空格|前后空格)$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const text = m[0] ?? '';
      const colIndex =
        col != null ? col - 1 : text.includes('首列') ? 0 : model.colCount - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已按预设规则去除第 ${colIndex + 1} 列首尾空格。`,
        actions: [{ type: 'trim_whitespace_in_column', colIndex }],
      };
    },
  },
  {
    id: 'trim_whitespace_in_all_body',
    intent: 'trim_whitespace_in_all_body',
    priority: 254,
    patterns: [
      /^(?:请)?(?:去除|删除|清理)(?:全表|所有|全部)(?:单元格)?(?:的)?(?:首尾空格|两端空格|前后空格)$/,
      /^(?:请)?(?:全表|所有|全部)(?:单元格)?(?:去除|删除|清理)(?:首尾空格|两端空格|前后空格)$/,
    ],
    run: () => ({
      reply: '已按预设规则去除全表体首尾空格。',
      actions: [{ type: 'trim_whitespace_in_all_body' }],
    }),
  },
  {
    id: 'normalize_case_in_selected_rows',
    intent: 'normalize_case_in_selected_rows',
    priority: 253,
    patterns: [
      new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:统一)?(?:转成|转换为|改为)(大写|小写)$`),
      new RegExp(`^(?:请)?${SELECTED_ROW_WORD}(?:的)?行(?:统一)?(?:大写化|小写化)$`),
    ],
    run: (_text, _model, m) => {
      const mode = (m[1] ?? '').includes('大写') || /大写/.test(m[0]) ? 'upper' : 'lower';
      return {
        reply: `已按预设规则将选中行统一转为${mode === 'upper' ? '大写' : '小写'}。`,
        actions: [{ type: 'normalize_case_in_selected_rows', mode }],
      };
    },
  },
  {
    id: 'normalize_case_in_column',
    intent: 'normalize_case_in_column',
    priority: 253,
    patterns: [
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:统一)?(?:转成|转换为|改为)(大写|小写)$/,
      /^(?:请)?第\s*(\d+)\s*列(?:统一)?(?:大写化|小写化)$/,
      /^(?:请)?(?:把)?首列(?:统一)?(?:转成|转换为|改为)(大写|小写)$/,
      /^(?:请)?首列(?:统一)?(?:大写化|小写化)$/,
      /^(?:请)?(?:把)?(?:末列|最后一列)(?:统一)?(?:转成|转换为|改为)(大写|小写)$/,
      /^(?:请)?(?:末列|最后一列)(?:统一)?(?:大写化|小写化)$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const text = m[0] ?? '';
      const colIndex =
        col != null ? col - 1 : text.includes('首列') ? 0 : model.colCount - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      const mode = (m[2] ?? '').includes('大写') || /大写/.test(m[0]) ? 'upper' : 'lower';
      return {
        reply: `已按预设规则将第 ${colIndex + 1} 列统一转为${mode === 'upper' ? '大写' : '小写'}。`,
        actions: [{ type: 'normalize_case_in_column', colIndex, mode }],
      };
    },
  },
  {
    id: 'normalize_case_in_all_body',
    intent: 'normalize_case_in_all_body',
    priority: 252,
    patterns: [
      /^(?:请)?(?:把)?(?:全表|全部|所有)(?:单元格)?(?:统一)?(?:转成|转换为|改为)(大写|小写)$/,
      /^(?:请)?(?:全表|全部|所有)(?:单元格)?(?:统一)?(?:大写化|小写化)$/,
    ],
    run: (_text, _model, m) => {
      const mode = (m[1] ?? '').includes('大写') || /大写/.test(m[0]) ? 'upper' : 'lower';
      return {
        reply: `已按预设规则将全表体统一转为${mode === 'upper' ? '大写' : '小写'}。`,
        actions: [{ type: 'normalize_case_in_all_body', mode }],
      };
    },
  },
  {
    id: 'reorder_columns_by_given_order',
    intent: 'reorder_columns',
    priority: 256,
    patterns: [
      /^(?:请)?(?:按|按照).*(?:列顺序|顺序).*(?:重排|重排列表头|重排列|重新排列|排列)$/,
      /^(?:请)?.*(?:列顺序|顺序).*(?:重排|重排列表头|重排列|重新排列|排列)$/,
    ],
    run: (text, model) => {
      const order = parseColumnOrderIndices(text);
      if (order.length < 2) return null;
      if (order.length !== model.colCount) return null;
      const uniq = new Set(order);
      if (uniq.size !== order.length) return null;
      if (order.some((x) => x < 0 || x >= model.colCount)) return null;
      const human = order.map((x) => `第${x + 1}列`).join('、');
      return {
        reply: `已按预设规则按 ${human} 的顺序重排列。`,
        actions: [{ type: 'reorder_columns', order }],
      };
    },
  },
  {
    id: 'selected_rows_divide',
    intent: 'numeric_transform_in_selected_rows',
    priority: 264,
    patterns: [new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:每个值)?(?:都)?除以\\s*(\\d+(?:\\.\\d+)?)$`)],
    run: (_text, _model, m) => {
      const divisor = Number.parseFloat(m[1] ?? '');
      if (!Number.isFinite(divisor) || divisor === 0) return null;
      return {
        reply: `已按预设规则将选中行数值全部除以 ${divisor}。`,
        actions: [{ type: 'numeric_transform_in_selected_rows', op: 'multiply', value: 1 / divisor }],
      };
    },
  },
  {
    id: 'selected_rows_discount',
    intent: 'numeric_transform_in_selected_rows',
    priority: 263,
    patterns: [new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:每个值)?(?:都)?打\\s*(\\d+(?:\\.\\d+)?)\\s*折$`)],
    run: (_text, _model, m) => {
      const n = Number.parseFloat(m[1] ?? '');
      if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
      const ratio = n >= 1 ? n / 10 : n;
      return {
        reply: `已按预设规则将选中行数值统一打 ${m[1]} 折。`,
        actions: [{ type: 'numeric_transform_in_selected_rows', op: 'multiply', value: ratio, decimals: 2 }],
      };
    },
  },
  {
    id: 'selected_rows_percent_adjust',
    intent: 'numeric_transform_in_selected_rows',
    priority: 262,
    patterns: [
      new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:每个值)?(?:都)?(上调|提高|增加|下调|降低|减少)\\s*(\\d+(?:\\.\\d+)?)\\s*%$`),
    ],
    run: (_text, _model, m) => {
      const pct = Number.parseFloat(m[2] ?? '');
      if (!Number.isFinite(pct) || pct < 0) return null;
      const up = m[1] === '上调' || m[1] === '提高' || m[1] === '增加';
      const value = up ? 1 + pct / 100 : 1 - pct / 100;
      return {
        reply: `已按预设规则将选中行数值${up ? '上调' : '下调'} ${pct}%。`,
        actions: [{ type: 'numeric_transform_in_selected_rows', op: 'multiply', value, decimals: 2 }],
      };
    },
  },
  {
    id: 'selected_rows_add_or_sub',
    intent: 'numeric_transform_in_selected_rows',
    priority: 261,
    patterns: [new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:每个值)?(?:都)?(加|减)\\s*(\\d+(?:\\.\\d+)?)$`)],
    run: (_text, _model, m) => {
      const num = Number.parseFloat(m[2] ?? '');
      if (!Number.isFinite(num)) return null;
      const delta = m[1] === '加' ? num : -num;
      return {
        reply: `已按预设规则对选中行数值${m[1]} ${num}。`,
        actions: [{ type: 'numeric_transform_in_selected_rows', op: 'add', value: delta, decimals: 2 }],
      };
    },
  },
  {
    id: 'selected_rows_round',
    intent: 'round_in_selected_rows',
    priority: 260,
    patterns: [
      new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:数值)?(?:统一)?保留\\s*(\\d+)\\s*位小数$`),
      new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:数值)?(?:统一)?(?:四舍五入到整数|四舍五入为整数|取整)$`),
    ],
    run: (_text, _model, m) => {
      if (m[1] != null) {
        const dec = Number.parseInt(m[1], 10);
        if (!Number.isFinite(dec)) return null;
        return {
          reply: `已按预设规则将选中行数值保留 ${dec} 位小数。`,
          actions: [{ type: 'round_in_selected_rows', decimals: dec }],
        };
      }
      return {
        reply: '已按预设规则将选中行数值四舍五入到整数。',
        actions: [{ type: 'round_in_selected_rows', decimals: 0 }],
      };
    },
  },
  {
    id: 'divide_column',
    intent: 'column_numeric_transform',
    priority: 260,
    patterns: [
      /^(?:请)?第\s*(\d+)\s*列(?:每个值)?(?:都)?除以\s*(\d+(?:\.\d+)?)$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:每个值)?(?:都)?除\s*(\d+(?:\.\d+)?)$/,
      /^(?:请)?(?:把)?首列(?:每个值)?(?:都)?除以\s*(\d+(?:\.\d+)?)$/,
      /^(?:请)?(?:把)?(?:末列|最后一列)(?:每个值)?(?:都)?除以\s*(\d+(?:\.\d+)?)$/,
      /^(?:请)?(?:价格列|售价列|单价列)(?:每个值)?(?:都)?除以\s*(\d+(?:\.\d+)?)$/,
    ],
    run: (text, model, m) => {
      const divisor = Number.parseFloat(m[2] ?? m[1] ?? '');
      const colIndex =
        m[1] && text.includes('第') ? parsePosInt(m[1])! - 1 : parseColumnIndexOrHeaderHint(text, model);
      if (!Number.isFinite(divisor) || divisor === 0) return null;
      if (colIndex == null || colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已按预设规则将第 ${colIndex + 1} 列全部除以 ${divisor}。`,
        actions: [{ type: 'column_numeric_transform', colIndex, op: 'multiply', value: 1 / divisor }],
      };
    },
  },
  {
    id: 'round_column_keep_decimals',
    intent: 'column_round',
    priority: 259,
    patterns: [
      /^(?:请)?第\s*(\d+)\s*列(?:保留|统一保留)\s*(\d+)\s*位小数$/,
      /^(?:请)?首列(?:保留|统一保留)\s*(\d+)\s*位小数$/,
      /^(?:请)?(?:末列|最后一列)(?:保留|统一保留)\s*(\d+)\s*位小数$/,
      /^(?:请)?(?:价格列|售价列|单价列)(?:保留|统一保留)\s*(\d+)\s*位小数$/,
    ],
    run: (text, model, m) => {
      const colIndex =
        m[1] && text.includes('第') ? parsePosInt(m[1])! - 1 : parseColumnIndexOrHeaderHint(text, model);
      const dec = Number.parseInt(m[m.length - 1] ?? '', 10);
      if (!Number.isFinite(dec)) return null;
      if (colIndex == null || colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已按预设规则将第 ${colIndex + 1} 列保留 ${dec} 位小数。`,
        actions: [{ type: 'column_round', colIndex, decimals: dec }],
      };
    },
  },
  {
    id: 'round_column_integer',
    intent: 'column_round',
    priority: 258,
    patterns: [
      /^(?:请)?第\s*(\d+)\s*列(?:四舍五入到整数|四舍五入为整数|取整)$/,
      /^(?:请)?首列(?:四舍五入到整数|四舍五入为整数|取整)$/,
      /^(?:请)?(?:末列|最后一列)(?:四舍五入到整数|四舍五入为整数|取整)$/,
      /^(?:请)?(?:价格列|售价列|单价列)(?:四舍五入到整数|四舍五入为整数|取整)$/,
    ],
    run: (text, model, m) => {
      const colIndex =
        m[1] && text.includes('第') ? parsePosInt(m[1])! - 1 : parseColumnIndexOrHeaderHint(text, model);
      if (colIndex == null || colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已按预设规则将第 ${colIndex + 1} 列四舍五入到整数。`,
        actions: [{ type: 'column_round', colIndex, decimals: 0 }],
      };
    },
  },
  {
    id: 'fill_empty_in_selected_rows',
    intent: 'fill_empty_in_selected_rows',
    priority: 251,
    patterns: [
      new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:中|里)?(?:的)?空单元格(?:填充为|填充|填为|设为|改为)(?:“([^”]+)”|"([^"]+)")$`),
      new RegExp(`^(?:请)?(?:把)?${SELECTED_ROW_WORD}(?:的)?行(?:中|里)?(?:的)?(?:空白|空值|空内容)(?:补成|补为|补到)(?:“([^”]+)”|"([^"]+)")$`),
    ],
    run: (_text, _model, m) => {
      const value = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').trim();
      if (value === '') return null;
      return {
        reply: `已按预设规则将选中行空单元格填充为「${value}」。`,
        actions: [{ type: 'fill_empty_in_selected_rows', value }],
      };
    },
  },
  {
    id: 'fill_empty_in_column',
    intent: 'fill_empty_in_column',
    priority: 251,
    patterns: [
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:中的|里)?空单元格(?:填充为|填充|填为|设为|改为)(?:“([^”]+)”|"([^"]+)")$/,
      /^(?:请)?第\s*(\d+)\s*列空单元格(?:填充为|填充|填为|设为|改为)(?:“([^”]+)”|"([^"]+)")$/,
      /^(?:请)?(?:把)?首列(?:中的|里)?空单元格(?:填充为|填充|填为|设为|改为)(?:“([^”]+)”|"([^"]+)")$/,
      /^(?:请)?(?:把)?(?:末列|最后一列)(?:中的|里)?空单元格(?:填充为|填充|填为|设为|改为)(?:“([^”]+)”|"([^"]+)")$/,
    ],
    run: (_text, model, m) => {
      let colIndex = 0;
      let value = '';
      const hasNumericCol = /第\s*\d+\s*列/.test(m[0] ?? '');
      if (hasNumericCol) {
        const col = parsePosInt(m[1]);
        if (col == null) return null;
        colIndex = col - 1;
        value = (m[2] ?? m[3] ?? '').trim();
      } else {
        const text = m[0] ?? '';
        colIndex = text.includes('首列') ? 0 : model.colCount - 1;
        value = (m[1] ?? m[2] ?? '').trim();
      }
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      if (value === '') return null;
      return {
        reply: `已按预设规则将第 ${colIndex + 1} 列空单元格填充为「${value}」。`,
        actions: [{ type: 'fill_empty_in_column', colIndex, value }],
      };
    },
  },
  {
    id: 'fill_empty_in_all_body',
    intent: 'fill_empty_in_all_body',
    priority: 250,
    patterns: [
      /^(?:请)?(?:把)?(?:全表|全部|所有)(?:单元格)?空单元格(?:填充为|填充|填为|设为|改为)(?:“([^”]+)”|"([^"]+)")$/,
      /^(?:请)?空单元格(?:统一)?(?:填充为|填充|填为|设为|改为)(?:“([^”]+)”|"([^"]+)")$/,
    ],
    run: (_text, _model, m) => {
      const value = (m[1] ?? m[2] ?? '').trim();
      if (value === '') return null;
      return {
        reply: `已按预设规则将全表体空单元格填充为「${value}」。`,
        actions: [{ type: 'fill_empty_in_all_body', value }],
      };
    },
  },
  {
    id: 'replace_text_in_selected_rows',
    intent: 'replace_text_in_selected_rows',
    priority: 250,
    patterns: [
      new RegExp(`^(?:请)?把${SELECTED_ROW_WORD}(?:的)?行(?:中|里)?“(.+)”替换为“(.*)”$`),
      new RegExp(`^(?:请)?将${SELECTED_ROW_WORD}(?:的)?行(?:中|里)?"(.+)"替换为"(.*)"$`),
      new RegExp(`^(?:请)?把${SELECTED_ROW_WORD}(?:的)?行(?:中|里)?“(.+)”改成“(.*)”$`),
      new RegExp(`^(?:请)?将${SELECTED_ROW_WORD}(?:的)?行(?:中|里)?\"(.+)\"改成\"(.*)\"$`),
    ],
    run: (_text, _model, m) => {
      const find = m[1] ?? '';
      const replace = m[2] ?? '';
      if (!find) return null;
      return {
        reply: '已按预设规则替换选中行文本。',
        actions: [{ type: 'replace_text_in_selected_rows', find, replace }],
      };
    },
  },
  {
    id: 'replace_text_in_selected_rows_empty',
    intent: 'replace_text_in_selected_rows',
    priority: 249,
    patterns: [
      new RegExp(`^(?:请)?把${SELECTED_ROW_WORD}(?:的)?行(?:中|里)?“(.+)”(?:替换为空|清空|删除)$`),
      new RegExp(`^(?:请)?将${SELECTED_ROW_WORD}(?:的)?行(?:中|里)?\"(.+)\"(?:替换为空|清空|删除)$`),
    ],
    run: (_text, _model, m) => {
      const find = m[1] ?? '';
      if (!find) return null;
      return {
        reply: '已按预设规则将选中行匹配文本清空。',
        actions: [{ type: 'replace_text_in_selected_rows', find, replace: '' }],
      };
    },
  },
  {
    id: 'replace_text_in_column',
    intent: 'replace_text_in_column',
    priority: 249,
    patterns: [
      /^(?:请)?把第\s*(\d+)\s*列(?:里|中的)?“(.+)”替换为“(.*)”$/,
      /^(?:请)?将第\s*(\d+)\s*列(?:里|中的)?"(.+)"替换为"(.*)"$/,
      /^(?:请)?把第\s*(\d+)\s*列(?:里|中的)?“(.+)”改成“(.*)”$/,
      /^(?:请)?将第\s*(\d+)\s*列(?:里|中的)?\"(.+)\"改成\"(.*)\"$/,
      /^(?:请)?把首列(?:里|中的)?“(.+)”替换为“(.*)”$/,
      /^(?:请)?将首列(?:里|中的)?"(.+)"替换为"(.*)"$/,
      /^(?:请)?把首列(?:里|中的)?“(.+)”改成“(.*)”$/,
      /^(?:请)?将首列(?:里|中的)?\"(.+)\"改成\"(.*)\"$/,
      /^(?:请)?把(?:末列|最后一列)(?:里|中的)?“(.+)”替换为“(.*)”$/,
      /^(?:请)?将(?:末列|最后一列)(?:里|中的)?"(.+)"替换为"(.*)"$/,
      /^(?:请)?把(?:末列|最后一列)(?:里|中的)?“(.+)”改成“(.*)”$/,
      /^(?:请)?将(?:末列|最后一列)(?:里|中的)?\"(.+)\"改成\"(.*)\"$/,
    ],
    run: (_text, model, m) => {
      const hasNumericCol = /第\s*\d+\s*列/.test(m[0] ?? '');
      const text = m[0] ?? '';
      const col = hasNumericCol ? parsePosInt(m[1]) : text.includes('首列') ? 1 : model.colCount;
      if (col == null || col <= 0) return null;
      const base = hasNumericCol ? 2 : 1;
      const find = m[base] ?? '';
      const replace = m[base + 1] ?? '';
      if (!find) return null;
      const colIndex = hasNumericCol ? col - 1 : text.includes('首列') ? 0 : model.colCount - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已按预设规则替换第 ${colIndex + 1} 列中的文本。`,
        actions: [{ type: 'replace_text_in_column', colIndex, find, replace }],
      };
    },
  },
  {
    id: 'replace_text_in_all_body',
    intent: 'replace_text_in_all_body',
    priority: 245,
    patterns: [
      /^(?:请)?把(?:全表|全部|所有)(?:单元格)?(?:里|中的)?“(.+)”替换为“(.*)”$/,
      /^(?:请)?将(?:全表|全部|所有)(?:单元格)?(?:里|中的)?\"(.+)\"替换为\"(.*)\"$/,
      /^(?:请)?把(?:全表|全部|所有)(?:单元格)?(?:里|中的)?“(.+)”改成“(.*)”$/,
      /^(?:请)?将(?:全表|全部|所有)(?:单元格)?(?:里|中的)?\"(.+)\"改成\"(.*)\"$/,
    ],
    run: (_text, _model, m) => {
      const find = m[1] ?? '';
      const replace = m[2] ?? '';
      if (!find) return null;
      return {
        reply: '已按预设规则替换全表体文本。',
        actions: [{ type: 'replace_text_in_all_body', find, replace }],
      };
    },
  },
  {
    id: 'replace_text_in_column_empty',
    intent: 'replace_text_in_column',
    priority: 244,
    patterns: [
      /^(?:请)?把第\s*(\d+)\s*列(?:里|中的)?“(.+)”(?:替换为空|清空|删除)$/,
      /^(?:请)?将第\s*(\d+)\s*列(?:里|中的)?\"(.+)\"(?:替换为空|清空|删除)$/,
      /^(?:请)?把首列(?:里|中的)?“(.+)”(?:替换为空|清空|删除)$/,
      /^(?:请)?将首列(?:里|中的)?\"(.+)\"(?:替换为空|清空|删除)$/,
      /^(?:请)?把(?:末列|最后一列)(?:里|中的)?“(.+)”(?:替换为空|清空|删除)$/,
      /^(?:请)?将(?:末列|最后一列)(?:里|中的)?\"(.+)\"(?:替换为空|清空|删除)$/,
    ],
    run: (_text, model, m) => {
      const hasNumericCol = /第\s*\d+\s*列/.test(m[0] ?? '');
      const text = m[0] ?? '';
      const col = hasNumericCol ? parsePosInt(m[1]) : text.includes('首列') ? 1 : model.colCount;
      if (col == null) return null;
      const find = m[hasNumericCol ? 2 : 1] ?? '';
      if (!find) return null;
      return {
        reply: `已按预设规则清空第 ${col} 列中匹配文本。`,
        actions: [{ type: 'replace_text_in_column', colIndex: col - 1, find, replace: '' }],
      };
    },
  },
  {
    id: 'replace_text_in_all_body_empty',
    intent: 'replace_text_in_all_body',
    priority: 243,
    patterns: [
      /^(?:请)?把(?:全表|全部|所有)(?:单元格)?(?:里|中的)?“(.+)”(?:替换为空|清空|删除)$/,
      /^(?:请)?将(?:全表|全部|所有)(?:单元格)?(?:里|中的)?\"(.+)\"(?:替换为空|清空|删除)$/,
    ],
    run: (_text, _model, m) => {
      const find = m[1] ?? '';
      if (!find) return null;
      return {
        reply: '已按预设规则将全表体匹配文本清空。',
        actions: [{ type: 'replace_text_in_all_body', find, replace: '' }],
      };
    },
  },
  {
    id: 'sort_single_column',
    intent: 'sort_body_rows',
    priority: 242,
    patterns: [
      /^(?:请)?(?:按|按照)第\s*(\d+)\s*列\s*(升序|降序)\s*(?:排序)?$/,
      /^(?:请)?第\s*(\d+)\s*列\s*(升序|降序)\s*(?:排序)?$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      if (col == null) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      const direction = m[2] === '降序' ? 'desc' : 'asc';
      return {
        reply: `已按预设规则按第 ${col} 列${direction === 'asc' ? '升序' : '降序'}排序。`,
        actions: [{ type: 'sort_body_rows', keys: [{ colIndex, direction }] }],
      };
    },
  },
  {
    id: 'sort_multi_columns',
    intent: 'sort_body_rows',
    priority: 241,
    patterns: [/^(?:请)?(?:按|按照).*(?:列).*(?:排序)$/],
    run: (text, model) => {
      const keys = parseSortKeysFromText(text, model.colCount);
      if (keys.length < 2) return null;
      const uniq = new Set(keys.map((k) => k.colIndex));
      if (uniq.size !== keys.length) return null;
      const human = keys.map((k) => `第${k.colIndex + 1}列${k.direction === 'asc' ? '升序' : '降序'}`).join('，');
      return {
        reply: `已按预设规则执行多列排序：${human}。`,
        actions: [{ type: 'sort_body_rows', keys }],
      };
    },
  },
  {
    id: 'filter_equals_keep_rows',
    intent: 'keep_rows_by_column_condition',
    priority: 240,
    patterns: [
      /^(?:请)?(?:仅显示|只显示|仅保留|只保留)第\s*(\d+)\s*列(?:等于|为)(?:“([^”]+)”|"([^"]+)")的?行(?:并删除其余行)?$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const value = (m[2] ?? m[3] ?? '').trim();
      if (col == null || value === '') return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已按预设规则仅保留第 ${col} 列等于「${value}」的行。`,
        actions: [{ type: 'keep_rows_by_column_condition', colIndex, operator: 'eq', value }],
      };
    },
  },
  {
    id: 'filter_contains_keep_rows',
    intent: 'keep_rows_by_column_condition',
    priority: 239,
    patterns: [
      /^(?:请)?(?:仅显示|只显示|仅保留|只保留)第\s*(\d+)\s*列(?:包含)(?:“([^”]+)”|"([^"]+)")的?行(?:并删除其余行)?$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const value = (m[2] ?? m[3] ?? '').trim();
      if (col == null || value === '') return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已按预设规则仅保留第 ${col} 列包含「${value}」的行。`,
        actions: [{ type: 'keep_rows_by_column_condition', colIndex, operator: 'contains', value }],
      };
    },
  },
  {
    id: 'filter_range_keep_rows',
    intent: 'keep_rows_by_column_condition',
    priority: 238,
    patterns: [
      /^(?:请)?(?:仅显示|只显示|仅保留|只保留)第\s*(\d+)\s*列(?:在)?\s*(\d+(?:\.\d+)?)\s*(?:到|\-|~|～)\s*(\d+(?:\.\d+)?)\s*(?:之间)?的?行(?:并删除其余行)?$/,
      /^(?:请)?(?:仅显示|只显示|仅保留|只保留)第\s*(\d+)\s*列\s*>=\s*(\d+(?:\.\d+)?)\s*(?:且|并且|并)\s*<=\s*(\d+(?:\.\d+)?)\s*的?行(?:并删除其余行)?$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const a = Number.parseFloat(m[2] ?? '');
      const b = Number.parseFloat(m[3] ?? '');
      if (col == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      return {
        reply: `已按预设规则仅保留第 ${col} 列在 [${min}, ${max}] 区间的行。`,
        actions: [{ type: 'keep_rows_by_column_condition', colIndex, operator: 'range', min, max }],
      };
    },
  },
  {
    id: 'clear_filter',
    intent: 'clear_row_filter',
    priority: 237,
    patterns: [/^(?:请)?(?:清除|取消)筛选$/, /^(?:请)?恢复全量(?:数据|行)?$/],
    run: () => ({
      reply: '已按预设规则清除筛选。',
      actions: [{ type: 'clear_row_filter' }],
    }),
  },
  {
    id: 'dedupe_by_columns',
    intent: 'dedupe_rows_by_columns',
    priority: 236,
    patterns: [
      /^(?:请)?(?:按|按照)(第\s*\d+\s*列(?:和第\s*\d+\s*列)*)去重(?:并保留(首条|末条))?$/,
      /^(?:请)?(?:对)?(?:全表|所有行)?按(第\s*\d+\s*列(?:和第\s*\d+\s*列)*)去重(?:并保留(首条|末条))?$/,
    ],
    run: (_text, model, m) => {
      const colsText = m[1] ?? '';
      const keep = m[2] === '末条' ? 'last' : 'first';
      const colIndices = parseColumnOrderIndices(colsText);
      if (colIndices.length === 0) return null;
      const uniq = Array.from(new Set(colIndices));
      if (uniq.some((c) => c < 0 || c >= model.colCount)) return null;
      const human = uniq.map((c) => `第${c + 1}列`).join('、');
      return {
        reply: `已按预设规则按${human}去重并保留${keep === 'first' ? '首条' : '末条'}。`,
        actions: [{ type: 'dedupe_rows_by_columns', colIndices: uniq, keep }],
      };
    },
  },
  {
    id: 'convert_column_unit',
    intent: 'convert_column_unit',
    priority: 235,
    patterns: [/^(?:请)?把第\s*(\d+)\s*列(?:统一)?(?:单位)?(?:从)?(.+?)(?:转|换成|到)(.+?)$/i],
    run: (text, model, m) => {
      const col = parsePosInt(m[1]);
      if (col == null) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      const conv = parseUnitConversion(text);
      if (!conv) return null;
      return {
        reply: `已按预设规则将第 ${col} 列单位从 ${conv.from} 转为 ${conv.to}。`,
        actions: [{ type: 'convert_column_unit', colIndex, factor: conv.factor, decimals: 2 }],
      };
    },
  },
  {
    id: 'rename_header_by_index',
    intent: 'set_cells',
    priority: 242,
    patterns: [
      /^(?:请)?(?:把|将)第\s*(\d+)\s*列(?:表头|标题)?(?:改为|改成|重命名为|命名为)“(.+)”$/,
      /^(?:请)?(?:把|将)第\s*(\d+)\s*列(?:表头|标题)?(?:改为|改成|重命名为|命名为)\"(.+)\"$/,
      /^(?:请)?第\s*(\d+)\s*列(?:表头|标题)?(?:改为|改成|重命名为|命名为)“(.+)”$/,
      /^(?:请)?第\s*(\d+)\s*列(?:表头|标题)?(?:改为|改成|重命名为|命名为)\"(.+)\"$/,
    ],
    run: (_text, _model, m) => {
      const col = parsePosInt(m[1]);
      const name = (m[2] ?? '').trim();
      if (col == null || name === '') return null;
      return {
        reply: `已按预设规则将第 ${col} 列表头改为「${name}」。`,
        actions: [{ type: 'set_cells', values: { [`header-${col - 1}`]: name } }],
      };
    },
  },
  {
    id: 'rename_header_batch',
    intent: 'set_cells',
    priority: 241,
    patterns: [
      /^(?:请)?(?:把|将)?第\s*\d+\s*列(?:表头|标题)?.*第\s*\d+\s*列(?:表头|标题)?.*$/,
    ],
    run: (text) => {
      const pairs = parseBatchHeaderRenamePairs(text);
      if (pairs.length < 2) return null;
      const values: Record<string, string> = {};
      for (const p of pairs) values[`header-${p.col - 1}`] = p.name;
      const human = pairs.map((p) => `第${p.col}列→${p.name}`).join('，');
      return {
        reply: `已按预设规则批量重命名表头：${human}。`,
        actions: [{ type: 'set_cells', values }],
      };
    },
  },
  // === 筛选条件批量操作（L0 核心能力）===
  {
    id: 'delete_rows_by_contains',
    intent: 'delete_rows_by_condition',
    priority: 400, // 高优先级，核心筛选能力
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列包含(?:“([^”]+)”|"([^"]+)")(?:的)?(?:所有)?行$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列包含(?:“([^”]+)”|"([^"]+)")(?:的)?行(?:都)?删除$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const value = (m[2] ?? m[3] ?? '').trim();
      if (col == null || value === '') return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已删除第 ${col} 列包含「${value}」的所有行。`,
        actions: [{ type: 'delete_rows_by_condition', colIndex, operator: 'contains', value }],
      };
    },
  },
  {
    id: 'delete_rows_by_eq',
    intent: 'delete_rows_by_condition',
    priority: 399,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:等于|为)(?:“([^”]+)”|"([^"]+)")(?:的)?(?:所有)?行$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:等于|为)(?:“([^”]+)”|"([^"]+)")(?:的)?行(?:都)?删除$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const value = (m[2] ?? m[3] ?? '').trim();
      if (col == null || value === '') return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已删除第 ${col} 列等于「${value}」的所有行。`,
        actions: [{ type: 'delete_rows_by_condition', colIndex, operator: 'eq', value }],
      };
    },
  },
  {
    id: 'delete_rows_by_numeric_gt',
    intent: 'delete_rows_by_condition',
    priority: 398,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:数值)?大于\s*(\d+(?:\.\d+)?)(?:的)?(?:所有)?行$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:数值)?大于\s*(\d+(?:\.\d+)?)(?:的)?行(?:都)?删除$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const threshold = Number.parseFloat(m[2] ?? '');
      if (col == null || !Number.isFinite(threshold)) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已删除第 ${col} 列数值大于 ${threshold} 的所有行。`,
        actions: [{ type: 'delete_rows_by_condition', colIndex, operator: 'gt', min: threshold }],
      };
    },
  },
  {
    id: 'delete_rows_by_numeric_lt',
    intent: 'delete_rows_by_condition',
    priority: 397,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:数值)?小于\s*(\d+(?:\.\d+)?)(?:的)?(?:所有)?行$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:数值)?小于\s*(\d+(?:\.\d+)?)(?:的)?行(?:都)?删除$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const threshold = Number.parseFloat(m[2] ?? '');
      if (col == null || !Number.isFinite(threshold)) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已删除第 ${col} 列数值小于 ${threshold} 的所有行。`,
        actions: [{ type: 'delete_rows_by_condition', colIndex, operator: 'lt', min: threshold }],
      };
    },
  },
  {
    id: 'delete_rows_by_numeric_gte',
    intent: 'delete_rows_by_condition',
    priority: 396,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:数值)?大于等于\s*(\d+(?:\.\d+)?)(?:的)?(?:所有)?行$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:数值)?大于等于\s*(\d+(?:\.\d+)?)(?:的)?行(?:都)?删除$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const threshold = Number.parseFloat(m[2] ?? '');
      if (col == null || !Number.isFinite(threshold)) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已删除第 ${col} 列数值大于等于 ${threshold} 的所有行。`,
        actions: [{ type: 'delete_rows_by_condition', colIndex, operator: 'gte', min: threshold }],
      };
    },
  },
  {
    id: 'delete_rows_by_numeric_lte',
    intent: 'delete_rows_by_condition',
    priority: 395,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:数值)?小于等于\s*(\d+(?:\.\d+)?)(?:的)?(?:所有)?行$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:数值)?小于等于\s*(\d+(?:\.\d+)?)(?:的)?行(?:都)?删除$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const threshold = Number.parseFloat(m[2] ?? '');
      if (col == null || !Number.isFinite(threshold)) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已删除第 ${col} 列数值小于等于 ${threshold} 的所有行。`,
        actions: [{ type: 'delete_rows_by_condition', colIndex, operator: 'lte', min: threshold }],
      };
    },
  },
  {
    id: 'delete_rows_by_regex',
    intent: 'delete_rows_by_condition',
    priority: 394,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:匹配|符合)(?:“([^”]+)”|"([^"]+)")(?:的)?(?:所有)?行$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:匹配|符合)(?:“([^”]+)”|"([^"]+)")(?:的)?行(?:都)?删除$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      const regex = (m[2] ?? m[3] ?? '').trim();
      if (col == null || regex === '') return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      // 验证正则是否有效
      try {
        new RegExp(regex);
      } catch {
        return null;
      }
      return {
        reply: `已删除第 ${col} 列匹配正则「${regex}」的所有行。`,
        actions: [{ type: 'delete_rows_by_condition', colIndex, operator: 'regex', regex }],
      };
    },
  },
  {
    id: 'delete_rows_by_empty',
    intent: 'delete_rows_by_condition',
    priority: 393,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:为空|是空|空值)(?:的)?(?:所有)?行$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:为空|是空|空值)(?:的)?行(?:都)?删除$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      if (col == null) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已删除第 ${col} 列为空的所有行。`,
        actions: [{ type: 'delete_rows_by_condition', colIndex, operator: 'empty' }],
      };
    },
  },
  {
    id: 'delete_rows_by_not_empty',
    intent: 'delete_rows_by_condition',
    priority: 392,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:非空|不为空|有值)(?:的)?(?:所有)?行$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:非空|不为空|有值)(?:的)?行(?:都)?删除$/,
    ],
    run: (_text, model, m) => {
      const col = parsePosInt(m[1]);
      if (col == null) return null;
      const colIndex = col - 1;
      if (colIndex < 0 || colIndex >= model.colCount) return null;
      return {
        reply: `已删除第 ${col} 列非空的所有行。`,
        actions: [{ type: 'delete_rows_by_condition', colIndex, operator: 'not_empty' }],
      };
    },
  },
  {
    id: 'delete_rows_by_multi_condition_and',
    intent: 'delete_rows_by_multi_condition',
    priority: 380,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:等于|包含)(?:“([^”]+)”|"([^"]+)")(?:且|并且)第\s*(\d+)\s*列(?:等于|包含)(?:“([^”]+)”|"([^"]+)")(?:的)?行$/,
    ],
    run: (_text, model, m) => {
      const col1 = parsePosInt(m[1]);
      const value1 = (m[2] ?? m[3] ?? '').trim();
      const col2 = parsePosInt(m[4]);
      const value2 = (m[5] ?? m[6] ?? '').trim();
      if (col1 == null || value1 === '' || col2 == null || value2 === '') return null;
      const col1Index = col1 - 1;
      const col2Index = col2 - 1;
      if (col1Index < 0 || col1Index >= model.colCount) return null;
      if (col2Index < 0 || col2Index >= model.colCount) return null;
      const op1 = m[0]?.includes('等于') ? 'eq' : 'contains';
      const op2 = m[0]?.slice(m[0]?.indexOf('且') + 1).includes('等于') ? 'eq' : 'contains';
      return {
        reply: `已删除第 ${col1} 列${op1 === 'eq' ? '等于' : '包含'}「${value1}」且第 ${col2} 列${op2 === 'eq' ? '等于' : '包含'}「${value2}」的行。`,
        actions: [
          {
            type: 'delete_rows_by_multi_condition',
            conditions: [
              { colIndex: col1Index, operator: op1, value: value1 },
              { colIndex: col2Index, operator: op2, value: value2 },
            ],
            logic: 'and',
          },
        ],
      };
    },
  },
  {
    id: 'delete_rows_by_multi_condition_or',
    intent: 'delete_rows_by_multi_condition',
    priority: 379,
    patterns: [
      /^(?:请)?删除第\s*(\d+)\s*列(?:等于|包含)(?:“([^”]+)”|"([^"]+)")(?:或|或者)第\s*(\d+)\s*列(?:等于|包含)(?:“([^”]+)”|"([^"]+)")(?:的)?行$/,
    ],
    run: (_text, model, m) => {
      const col1 = parsePosInt(m[1]);
      const value1 = (m[2] ?? m[3] ?? '').trim();
      const col2 = parsePosInt(m[4]);
      const value2 = (m[5] ?? m[6] ?? '').trim();
      if (col1 == null || value1 === '' || col2 == null || value2 === '') return null;
      const col1Index = col1 - 1;
      const col2Index = col2 - 1;
      if (col1Index < 0 || col1Index >= model.colCount) return null;
      if (col2Index < 0 || col2Index >= model.colCount) return null;
      const text = m[0] ?? '';
      const firstOp = text.includes('等于') && text.indexOf('等于') < text.indexOf('或') ? 'eq' : 'contains';
      const secondOp = text.slice(text.indexOf('或') + 1).includes('等于') ? 'eq' : 'contains';
      return {
        reply: `已删除第 ${col1} 列${firstOp === 'eq' ? '等于' : '包含'}「${value1}」或第 ${col2} 列${secondOp === 'eq' ? '等于' : '包含'}「${value2}」的行。`,
        actions: [
          {
            type: 'delete_rows_by_multi_condition',
            conditions: [
              { colIndex: col1Index, operator: firstOp, value: value1 },
              { colIndex: col2Index, operator: secondOp, value: value2 },
            ],
            logic: 'or',
          },
        ],
      };
    },
  },
  {
    id: 'clear_column_for_condition_eq',
    intent: 'clear_column_for_condition',
    priority: 370,
    patterns: [
      /^(?:请)?清空第\s*(\d+)\s*列(?:等于|为)(?:“([^”]+)”|"([^"]+)")(?:的)?行的第\s*(\d+)\s*列(?:内容)?$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:等于|为)(?:“([^”]+)”|"([^"]+)")(?:的)?行的第\s*(\d+)\s*列(?:清空|清除)$/,
    ],
    run: (_text, model, m) => {
      const filterCol = parsePosInt(m[1]);
      const filterValue = (m[2] ?? m[3] ?? '').trim();
      const targetCol = parsePosInt(m[4]);
      if (filterCol == null || filterValue === '' || targetCol == null) return null;
      const filterColIndex = filterCol - 1;
      const targetColIndex = targetCol - 1;
      if (filterColIndex < 0 || filterColIndex >= model.colCount) return null;
      if (targetColIndex < 0 || targetColIndex >= model.colCount) return null;
      return {
        reply: `已清空第 ${filterCol} 列等于「${filterValue}」的行的第 ${targetCol} 列内容。`,
        actions: [
          {
            type: 'clear_column_for_condition',
            filterColIndex,
            filterOperator: 'eq',
            filterValue,
            targetColIndex,
          },
        ],
      };
    },
  },
  {
    id: 'clear_column_for_condition_contains',
    intent: 'clear_column_for_condition',
    priority: 369,
    patterns: [
      /^(?:请)?清空第\s*(\d+)\s*列包含(?:“([^”]+)”|"([^"]+)")(?:的)?行的第\s*(\d+)\s*列(?:内容)?$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列包含(?:“([^”]+)”|"([^"]+)")(?:的)?行的第\s*(\d+)\s*列(?:清空|清除)$/,
    ],
    run: (_text, model, m) => {
      const filterCol = parsePosInt(m[1]);
      const filterValue = (m[2] ?? m[3] ?? '').trim();
      const targetCol = parsePosInt(m[4]);
      if (filterCol == null || filterValue === '' || targetCol == null) return null;
      const filterColIndex = filterCol - 1;
      const targetColIndex = targetCol - 1;
      if (filterColIndex < 0 || filterColIndex >= model.colCount) return null;
      if (targetColIndex < 0 || targetColIndex >= model.colCount) return null;
      return {
        reply: `已清空第 ${filterCol} 列包含「${filterValue}」的行的第 ${targetCol} 列内容。`,
        actions: [
          {
            type: 'clear_column_for_condition',
            filterColIndex,
            filterOperator: 'contains',
            filterValue,
            targetColIndex,
          },
        ],
      };
    },
  },
  {
    id: 'numeric_transform_for_condition_gt_discount',
    intent: 'numeric_transform_for_condition',
    priority: 360,
    patterns: [
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:数值)?大于\s*(\d+(?:\.\d+)?)(?:的)?行(?:都)?打\s*(\d+(?:\.\d+)?)\s*折$/,
    ],
    run: (_text, model, m) => {
      const filterCol = parsePosInt(m[1]);
      const threshold = Number.parseFloat(m[2] ?? '');
      const discount = Number.parseFloat(m[3] ?? '');
      if (filterCol == null || !Number.isFinite(threshold) || !Number.isFinite(discount)) return null;
      const filterColIndex = filterCol - 1;
      if (filterColIndex < 0 || filterColIndex >= model.colCount) return null;
      const ratio = discount >= 1 ? discount / 10 : discount;
      return {
        reply: `已将第 ${filterCol} 列数值大于 ${threshold} 的行打 ${m[3]} 折。`,
        actions: [
          {
            type: 'numeric_transform_for_condition',
            filterColIndex,
            filterOperator: 'gt',
            filterMin: threshold,
            op: 'multiply',
            value: ratio,
            decimals: 2,
          },
        ],
      };
    },
  },
  {
    id: 'numeric_transform_for_condition_eq_discount',
    intent: 'numeric_transform_for_condition',
    priority: 359,
    patterns: [
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:等于|为)(?:“([^”]+)”|"([^"]+)")(?:的)?行(?:都)?打\s*(\d+(?:\.\d+)?)\s*折$/,
    ],
    run: (_text, model, m) => {
      const filterCol = parsePosInt(m[1]);
      const filterValue = (m[2] ?? m[3] ?? '').trim();
      const discount = Number.parseFloat(m[4] ?? '');
      if (filterCol == null || filterValue === '' || !Number.isFinite(discount)) return null;
      const filterColIndex = filterCol - 1;
      if (filterColIndex < 0 || filterColIndex >= model.colCount) return null;
      const ratio = discount >= 1 ? discount / 10 : discount;
      return {
        reply: `已将第 ${filterCol} 列等于「${filterValue}」的行打 ${m[4]} 折。`,
        actions: [
          {
            type: 'numeric_transform_for_condition',
            filterColIndex,
            filterOperator: 'eq',
            filterValue,
            op: 'multiply',
            value: ratio,
            decimals: 2,
          },
        ],
      };
    },
  },
  {
    id: 'replace_text_for_condition_eq',
    intent: 'replace_text_for_condition',
    priority: 350,
    patterns: [
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:等于|为)(?:“([^”]+)”|"([^"]+)")(?:的)?行(?:中|里的)?(?:“([^”]+)”|"([^"]+)")(?:替换为|改成|替换成)(?:“([^”]*)”|"([^"]*)")$/,
    ],
    run: (_text, model, m) => {
      const filterCol = parsePosInt(m[1]);
      const filterValue = (m[2] ?? m[3] ?? '').trim();
      const find = (m[4] ?? m[5] ?? '').trim();
      const replace = (m[6] ?? m[7] ?? '');
      if (filterCol == null || filterValue === '' || find === '') return null;
      const filterColIndex = filterCol - 1;
      if (filterColIndex < 0 || filterColIndex >= model.colCount) return null;
      return {
        reply: `已将第 ${filterCol} 列等于「${filterValue}」的行中的「${find}」替换为「${replace}」。`,
        actions: [
          {
            type: 'replace_text_for_condition',
            filterColIndex,
            filterOperator: 'eq',
            filterValue,
            find,
            replace,
          },
        ],
      };
    },
  },
];
