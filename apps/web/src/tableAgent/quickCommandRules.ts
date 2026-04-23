import type { TableAreaDemoModel } from 'vc-biz';
import type { TableAgentAction, TableAgentTableFlags } from './tableAgentTypes';
import { QUICK_RULE_SCHEMA } from './quickRuleSchema';

type QuickCommandResult = Readonly<{
  matched: true;
  reply: string;
  actions: TableAgentAction[];
}>;

type QuickNoMatch = Readonly<{ matched: false }>;

type QuickParseResult = QuickCommandResult | QuickNoMatch;

function parseIntSafe(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseDiscount(raw: string): number | null {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 100) return null;
  return n >= 1 ? n / 10 : n;
}

function parsePercent(raw: string): number | null {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n / 100;
}

function findPriceColumn(model: TableAreaDemoModel): number | null {
  const keys = ['价格', '售价', '单价', 'price', 'Price', 'PRICE'];
  for (let c = 0; c < model.colCount; c += 1) {
    const h = model.valueByCell[`header-${c}`] ?? '';
    if (keys.some((k) => h.includes(k))) return c;
  }
  return null;
}

function parseColumnIndex(text: string, model: TableAreaDemoModel): number | null {
  const m = text.match(/第\s*(\d+)\s*列/);
  if (m) {
    const n = parseIntSafe(m[1]);
    if (n == null) return null;
    const idx = n - 1;
    return idx >= 0 && idx < model.colCount ? idx : null;
  }
  if (/价格列|售价列|单价列|price/i.test(text)) {
    return findPriceColumn(model);
  }
  return null;
}

function asMatched(reply: string, actions: TableAgentAction[]): QuickCommandResult {
  return { matched: true, reply, actions };
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

function isOnIntent(text: string): boolean {
  return hasAny(text, ['开启', '打开', '启用']);
}

function isOffIntent(text: string): boolean {
  return hasAny(text, ['关闭', '禁用', '取消', '解除']);
}

/**
 * 剥离「未成对」的首尾引号杂字符，避免 `首列后增加1列”` 这类多打的引号导致 L0 miss；
 * 不碰 `填充为“未配置”` 这种成对引号（末尾 ” 前有 “）。
 */
function stripEdgeQuoteNoise(raw: string): string {
  let t = raw.trim();
  for (let i = 0; i < 8; i += 1) {
    const prev = t;
    // 中文弯引号：仅当与另一侧不成对时才剥（避免拆掉语义引号对）
    if (t.endsWith('\u201d') && !t.slice(0, -1).includes('\u201c')) {
      t = t.slice(0, -1).trim();
    } else if (t.startsWith('\u201c') && !t.slice(1).includes('\u201d')) {
      t = t.slice(1).trim();
    }
    // ASCII 双引号：同上（成对 "..." 保留）
    else if (t.endsWith('"') && !t.slice(0, -1).includes('"')) {
      t = t.slice(0, -1).trim();
    } else if (t.startsWith('"') && !t.slice(1).includes('"')) {
      t = t.slice(1).trim();
    }
    // 单引号（英/弯）
    else if (t.endsWith("'") && !t.slice(0, -1).includes("'")) {
      t = t.slice(0, -1).trim();
    } else if (t.startsWith("'") && !t.slice(1).includes("'")) {
      t = t.slice(1).trim();
    } else if (t.endsWith('\u2019') && !t.slice(0, -1).includes('\u2018')) {
      t = t.slice(0, -1).trim();
    } else if (t.startsWith('\u2018') && !t.slice(1).includes('\u2019')) {
      t = t.slice(1).trim();
    }
    if (t === prev) break;
  }
  return t;
}

function normalizeQuickText(text: string): string {
  return stripEdgeQuoteNoise(text)
    .replace(/[，,；;、]/g, ' ')
    .replace(/[。！？!?]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function parseQuickCommand(text: string, model: TableAreaDemoModel): QuickParseResult {
  const t = normalizeQuickText(text);
  if (!t) return { matched: false };

  const schemaRules = [...QUICK_RULE_SCHEMA].sort((a, b) => b.priority - a.priority);
  for (const rule of schemaRules) {
    for (const re of rule.patterns) {
      const m = t.match(re);
      if (!m) continue;
      const out = rule.run(t, model, m);
      if (out) return asMatched(out.reply, out.actions);
    }
  }

  let m = t.match(/^(?:请)?(?:再)?(?:新增|增加|添加|加)\s*(\d+)\s*行$/);
  if (m) {
    const n = parseIntSafe(m[1]);
    if (n != null) return asMatched(`已按预设规则新增 ${n} 行。`, [{ type: 'insert_rows', count: n }]);
  }

  m = t.match(/^(?:请)?(?:再)?(?:新增|增加|添加|加)\s*(\d+)\s*列$/);
  if (m) {
    const n = parseIntSafe(m[1]);
    if (n != null) {
      return asMatched(`已按预设规则新增 ${n} 列。`, [{ type: 'insert_columns', count: n }]);
    }
  }

  m = t.match(/^(?:请)?(?:删除|删)\s*第?\s*(\d+)\s*(?:到|\-|~|～)\s*第?\s*(\d+)\s*行$/);
  if (m) {
    const a = parseIntSafe(m[1]);
    const b = parseIntSafe(m[2]);
    if (a != null && b != null) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const actions: TableAgentAction[] = [];
      for (let n = hi; n >= lo; n -= 1) actions.push({ type: 'delete_body_row', rowIndex: n - 1 });
      return asMatched(`已按预设规则删除第 ${lo}-${hi} 行。`, actions);
    }
  }

  m = t.match(/^(?:请)?(?:删除|删)\s*第?\s*(\d+)\s*行$/);
  if (m) {
    const n = parseIntSafe(m[1]);
    if (n != null) return asMatched(`已按预设规则删除第 ${n} 行。`, [{ type: 'delete_body_row', rowIndex: n - 1 }]);
  }

  m = t.match(/^(?:请)?(?:删除|删)\s*第?\s*(\d+)\s*(?:到|\-|~|～)\s*第?\s*(\d+)\s*列$/);
  if (m) {
    const a = parseIntSafe(m[1]);
    const b = parseIntSafe(m[2]);
    if (a != null && b != null) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const actions: TableAgentAction[] = [];
      for (let n = hi; n >= lo; n -= 1) actions.push({ type: 'delete_column', colIndex: n - 1 });
      return asMatched(`已按预设规则删除第 ${lo}-${hi} 列。`, actions);
    }
  }

  m = t.match(/^(?:请)?(?:删除|删)\s*第?\s*(\d+)\s*列$/);
  if (m) {
    const n = parseIntSafe(m[1]);
    if (n != null) return asMatched(`已按预设规则删除第 ${n} 列。`, [{ type: 'delete_column', colIndex: n - 1 }]);
  }

  m = t.match(/打\s*(\d+(?:\.\d+)?)\s*折/);
  if (m) {
    const colIndex = parseColumnIndex(t, model);
    const ratio = parseDiscount(m[1]);
    if (colIndex != null && ratio != null) {
      return asMatched(`已按预设规则将第 ${colIndex + 1} 列打 ${m[1]} 折。`, [
        { type: 'column_numeric_transform', colIndex, op: 'multiply', value: ratio, decimals: 2 },
      ]);
    }
  }

  m = t.match(/(上调|提高|增加|下调|降低|减少)\s*(\d+(?:\.\d+)?)\s*%/);
  if (m) {
    const colIndex = parseColumnIndex(t, model);
    const pct = parsePercent(m[2]);
    if (colIndex != null && pct != null) {
      const up = m[1] === '上调' || m[1] === '提高' || m[1] === '增加';
      const value = up ? 1 + pct : 1 - pct;
      return asMatched(`已按预设规则${up ? '上调' : '下调'}第 ${colIndex + 1} 列 ${m[2]}%。`, [
        { type: 'column_numeric_transform', colIndex, op: 'multiply', value, decimals: 2 },
      ]);
    }
  }

  m = t.match(/(加|减)\s*(\d+(?:\.\d+)?)/);
  if (m && /列/.test(t)) {
    const colIndex = parseColumnIndex(t, model);
    const num = Number.parseFloat(m[2]);
    if (colIndex != null && Number.isFinite(num)) {
      const delta = m[1] === '加' ? num : -num;
      return asMatched(`已按预设规则对第 ${colIndex + 1} 列${m[1]} ${m[2]}。`, [
        { type: 'column_numeric_transform', colIndex, op: 'add', value: delta, decimals: 2 },
      ]);
    }
  }

  const flagRules: Array<[RegExp, TableAgentTableFlags, string]> = [
    [/(显示|开启).*(行号)/, { enableShowRowIndex: true }, '已按预设规则开启行号显示。'],
    [/(隐藏|关闭).*(行号)/, { enableShowRowIndex: false }, '已按预设规则关闭行号显示。'],
    [/(开启|打开).*(编辑)/, { enableEditMode: true }, '已按预设规则开启编辑模式。'],
    [/(关闭|禁用).*(编辑)/, { enableEditMode: false }, '已按预设规则关闭编辑模式。'],
    [/(开启|打开).*(列宽).*(拖拽|调整)/, { enableColumnResize: true }, '已按预设规则开启列宽拖拽。'],
    [/(关闭|禁用).*(列宽).*(拖拽|调整)/, { enableColumnResize: false }, '已按预设规则关闭列宽拖拽。'],
    [/(开启|打开).*(首列).*(冻结)/, { enableFreezeFirstCol: true }, '已按预设规则开启首列冻结。'],
    [/(关闭|取消|解除).*(首列).*(冻结)/, { enableFreezeFirstCol: false }, '已按预设规则关闭首列冻结。'],
    [/(开启|打开).*(末列|最后一列).*(冻结)/, { enableFreezeLastCol: true }, '已按预设规则开启末列冻结。'],
    [/(关闭|取消|解除).*(末列|最后一列).*(冻结)/, { enableFreezeLastCol: false }, '已按预设规则关闭末列冻结。'],
    [/(开启|打开).*(末行|最后一行).*(冻结)/, { enableFreezeLastRow: true }, '已按预设规则开启末行冻结。'],
    [/(关闭|取消|解除).*(末行|最后一行).*(冻结)/, { enableFreezeLastRow: false }, '已按预设规则关闭末行冻结。'],
    [/(开启|打开).*(插入).*(行列)/, { enableInsertRowCol: true }, '已按预设规则开启插入行列。'],
    [/(关闭|禁用).*(插入).*(行列)/, { enableInsertRowCol: false }, '已按预设规则关闭插入行列。'],
    [/(开启|打开).*(常规字体|普通字体)/, { enableRegularTableFont: true }, '已按预设规则开启常规字体。'],
    [/(关闭|禁用).*(常规字体|普通字体)/, { enableRegularTableFont: false }, '已按预设规则关闭常规字体。'],
    [/(开启|打开).*(垂直居中)/, { enableVerticalCenter: true }, '已按预设规则开启垂直居中。'],
    [/(关闭|禁用).*(垂直居中)/, { enableVerticalCenter: false }, '已按预设规则关闭垂直居中。'],
    [/(开启|打开).*(右边框|右侧边框|单元格右边框)/, { enableBodyCellRightBorder: true }, '已按预设规则开启单元格右边框。'],
    [/(关闭|禁用).*(右边框|右侧边框|单元格右边框)/, { enableBodyCellRightBorder: false }, '已按预设规则关闭单元格右边框。'],
  ];
  for (const [re, flags, reply] of flagRules) {
    if (re.test(t)) return asMatched(reply, [{ type: 'set_table_flags', flags }]);
  }

  const on = isOnIntent(t);
  const off = isOffIntent(t);
  if (on || off) {
    const next = on ? true : false;
    const onOff = next ? '开启' : '关闭';

    if (hasAny(t, ['首列']) && hasAny(t, ['冻结'])) {
      return asMatched(`已按预设规则${onOff}首列冻结。`, [
        { type: 'set_table_flags', flags: { enableFreezeFirstCol: next } },
      ]);
    }
    if (hasAny(t, ['末列', '最后一列']) && hasAny(t, ['冻结'])) {
      return asMatched(`已按预设规则${onOff}末列冻结。`, [
        { type: 'set_table_flags', flags: { enableFreezeLastCol: next } },
      ]);
    }
    if (hasAny(t, ['末行', '最后一行']) && hasAny(t, ['冻结'])) {
      return asMatched(`已按预设规则${onOff}末行冻结。`, [
        { type: 'set_table_flags', flags: { enableFreezeLastRow: next } },
      ]);
    }
    if (hasAny(t, ['插入']) && hasAny(t, ['行列'])) {
      return asMatched(`已按预设规则${onOff}插入行列。`, [
        { type: 'set_table_flags', flags: { enableInsertRowCol: next } },
      ]);
    }
    if (hasAny(t, ['常规字体', '普通字体'])) {
      return asMatched(`已按预设规则${onOff}常规字体。`, [
        { type: 'set_table_flags', flags: { enableRegularTableFont: next } },
      ]);
    }
    if (hasAny(t, ['垂直居中'])) {
      return asMatched(`已按预设规则${onOff}垂直居中。`, [
        { type: 'set_table_flags', flags: { enableVerticalCenter: next } },
      ]);
    }
    if (hasAny(t, ['右边框', '右侧边框', '单元格右边框'])) {
      return asMatched(`已按预设规则${onOff}单元格右边框。`, [
        { type: 'set_table_flags', flags: { enableBodyCellRightBorder: next } },
      ]);
    }
  }

  return { matched: false };
}
