import type { TableAreaDemoModel } from 'vc-biz';

/** 与 L0 冲突样例 / 回归测试对齐的常用句式，用于对话区补全 */
const L0_COMPLETION_BASE_PHRASES: readonly string[] = [
  '清空所有表体',
  '把表体都清空',
  '清空选中行内容',
  '删除选中行',
  '删除最后3行',
  '删除末尾2列',
  '新增2行',
  '新增1列',
  '在第3行前插入2行',
  '在第3行后插入2行',
  '在第2列左侧插入1列',
  '在第2列右侧插入1列',
  '首列后增加1列',
  '删除第5行',
  '删除第2列',
  '删除第1行到第3行',
  '清空首列',
  '清空第3列',
  '清空第5行',
  '把第2列“旧”替换为“新”',
  '把全表“旧”替换为“新”',
  '把第2列“旧”替换为空',
  '把选中行“旧”替换为“新”',
  '去除第2列首尾空格',
  '清理全表首尾空格',
  '把第2列转成大写',
  '全表统一转换为小写',
  '把第3列空单元格填充为“未配置”',
  '全表空单元格设为"—"',
  '第2列除以2',
  '价格列除以2',
  '第2列保留2位小数',
  '第2列四舍五入到整数',
  '把选中行都除以2',
  '把选中行打8折',
  '把选中行上调10%',
  '把选中行加5',
  '按第2列升序排序',
  '按第3列降序',
  '按第1列升序第3列降序排序',
  '仅显示第2列等于"首页"的行',
  '仅显示第2列包含"首页"的行',
  '仅保留第4列在10到20之间的行并删除其余行',
  '清除筛选',
  '按第1列和第3列去重并保留首条',
  '按第2列去重并保留末条',
  '把第4列单位从元转分',
  '把第4列单位从g到kg',
  '隐藏第2列',
  '显示所有列',
  '交换第1列和第3列',
  '按第3列 第1列 第4列 第2列顺序重排列',
  '把第2列表头改为“导航名”',
  '开启冻结首列',
  '关闭最后一列冻结',
  '开启行号显示',
  '开启垂直居中',
];

/** 无输入时快捷键展开的「高频」子集 */
const L0_COMPLETION_SPOTLIGHT: readonly string[] = [
  '清空所有表体',
  '清空选中行内容',
  '删除选中行',
  '新增1行',
  '按第2列升序排序',
  '把全表“旧”替换为“新”',
  '隐藏第2列',
  '清除筛选',
];

function uniqPreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    const t = s.trim();
    if (t === '' || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function headerBasedPhrases(model: TableAreaDemoModel): string[] {
  const out: string[] = [];
  const n = Math.max(0, model.colCount);
  for (let c = 0; c < n; c += 1) {
    const h = (model.valueByCell[`header-${c}`] ?? '').trim();
    if (h.length === 0 || h.length > 24) continue;
    if (/^\d+$/.test(h)) continue;
    if (/[\r\n\t]/.test(h)) continue;
    out.push(`清空${h}列`);
    out.push(`隐藏${h}列`);
    out.push(`显示${h}列`);
  }
  return out;
}

export function buildL0CompletionPool(model: TableAreaDemoModel | null): string[] {
  const base = [...L0_COMPLETION_BASE_PHRASES];
  if (model) base.push(...headerBasedPhrases(model));
  return uniqPreserveOrder(base);
}

export function filterL0Completions(
  pool: readonly string[],
  query: string,
  limit: number,
  opts?: Readonly<{ emptyShowSpotlight?: boolean }>
): string[] {
  const q = query.trim().toLowerCase();
  if (q === '') {
    if (opts?.emptyShowSpotlight) {
      return L0_COMPLETION_SPOTLIGHT.slice(0, limit);
    }
    return [];
  }
  const scored = pool
    .map((s) => {
      const lower = s.toLowerCase();
      let score = 0;
      if (lower.startsWith(q)) score = 100 + Math.min(20, q.length);
      else if (lower.includes(q)) score = 50;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.length - b.s.length);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const { s } of scored) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
