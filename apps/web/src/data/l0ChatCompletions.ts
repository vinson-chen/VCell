import type { TableAreaDemoModel } from '@vinson.hx/vc-biz';

/** VTell L0 补全项类型 */
export interface L0CompletionItem {
  key: string;
  label: string;
  /** 指令分类：筛选(不依赖选中)、操作(依赖选中)、特殊(不依赖选中)、统计(聚合计算) */
  category: 'filter' | 'operation' | 'special' | 'aggregate';
  /** 同义词列表（用于模糊匹配，用户输入同义词时也能显示此选项） */
  synonyms?: string[];
}

/**
 * L0 预设规则分类
 * - filter: 筛选指令，不依赖选中，匹配单元格内容
 * - operation: 操作指令，依赖选中，对选中单元格生效
 * - special: 特殊指令，不依赖选中（新增、清除筛选等）
 */

/**
 * 补全池显示的指令（精简版，每个功能只保留一个选项）
 * 同义词通过 synonyms 字段配置，用于模糊匹配
 */
const DISPLAY_PHRASES_WITH_SYNONYMS: readonly Array<{ label: string; synonyms?: string[] }> = [
  // 筛选类（只显示一个代表）
  { label: '查找关键词', synonyms: ['筛选', '搜索', '找出', '查询', '提炼', '仅显示', '只显示'] },
  { label: '清除筛选', synonyms: ['显示全部', '取消筛选', '重置'] },
  // 操作类（依赖选中）
  { label: '清空', synonyms: ['删除内容', '去除'] },
  { label: '删除行' },
  { label: '删除列' },
  { label: '填充', synonyms: ['填充为', '设为', '改为'] },
  { label: '替换', synonyms: ['把', '替换为'] },
  { label: '排序', synonyms: ['升序', '降序'] },
  { label: '打折' },
  { label: '上调百分比', synonyms: ['上调', '提高', '增加'] },
  { label: '下调百分比', synonyms: ['下调', '降低', '减少'] },
  // 特殊类（不依赖选中）
  { label: '新增行', synonyms: ['增加行', '添加行', '插入行'] },
  { label: '新增列', synonyms: ['增加列', '添加列', '插入列'] },
  // 统计类
  { label: '计算总和', synonyms: ['求和', '总和'] },
  { label: '计算平均值', synonyms: ['求平均', '平均'] },
  { label: '计算最大值', synonyms: ['最大', '最高'] },
  { label: '计算最小值', synonyms: ['最小', '最低'] },
  { label: '统计数量', synonyms: ['计数', '数量'] },
  { label: '计算选中总和' },
  { label: '计算选中平均' },
];

/** 高频 Spotlight 子集 */
const SPOTLIGHT_PHRASES: readonly string[] = [
  '查找关键词',
  '清空',
  '删除行',
  '新增行',
  '排序',
  '替换',
  '清除筛选',
  '填充',
];

/** 去重保序 */
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

/**
 * 判断短语所属分类
 */
function categorizePhrase(phrase: string): L0CompletionItem['category'] {
  const filterTriggers = ['筛选', '查找', '搜索', '找出', '仅显示', '只显示', '显示', '查询', '提炼', '清除筛选', '取消筛选'];
  const specialPhrases = ['新增行', '新增列', '清除筛选', '显示全部', '取消筛选'];
  const aggregateTriggers = ['计算', '求', '统计', '总和', '平均', '最大', '最小', '计数', '数量'];

  // 特殊指令优先判断
  if (specialPhrases.includes(phrase)) return 'special';

  // 统计类指令
  for (const trigger of aggregateTriggers) {
    if (phrase.includes(trigger)) return 'aggregate';
  }

  // 筛选指令
  for (const trigger of filterTriggers) {
    if (phrase.startsWith(trigger)) return 'filter';
  }

  // 其他为操作指令
  return 'operation';
}

/** 构建完整指令项（精简版补全池，包含同义词） */
export function buildL0CompletionPool(): L0CompletionItem[] {
  return DISPLAY_PHRASES_WITH_SYNONYMS.map((item, idx) => ({
    key: `l0-${idx}`,
    label: item.label,
    category: categorizePhrase(item.label),
    synonyms: item.synonyms,
  }));
}

/** 获取高频 Spotlight 子集 */
export function getL0Spotlight(): L0CompletionItem[] {
  return SPOTLIGHT_PHRASES.map((label, idx) => ({
    key: `spotlight-${idx}`,
    label,
    category: categorizePhrase(label),
  }));
}

/** 筛选指令触发词（按长度降序排列，优先匹配长触发词） */
export const FILTER_TRIGGERS: readonly string[] = [
  '筛选出', '查找出', '搜出',
  '仅显示', '只显示',
  '筛选', '查找', '搜索', '找出', '显示', '查询', '提炼',
];

/** 操作指令触发词 */
export const OPERATION_TRIGGERS: readonly string[] = [
  '清空', '删除内容', '去除',
  '删除行', '删除列',
  '填充', '设为', '改为',
  '替换', '把',
  '加', '减', '乘', '除以', '打', '上调', '下调',
  '升序', '降序', '排序',
  '去除首尾空格', '转大写', '转小写',
  '元转分', 'g转kg',
];

/** 特殊指令（不依赖选中） */
export const SPECIAL_TRIGGERS: readonly string[] = [
  '新增行', '新增列', '清除筛选', '显示全部', '取消筛选',
  '增加行', '增加列', '添加行', '添加列', '加行', '加列',
  '插入行', '插入列', '新增', '增加', '添加',
];

/** 判断是否为筛选指令 */
export function isFilterCommand(text: string): boolean {
  const trimmed = text.trim();
  for (const trigger of FILTER_TRIGGERS) {
    if (trimmed.startsWith(trigger)) return true;
  }
  return false;
}

/** 判断是否为操作指令（需要选中） */
export function isOperationCommand(text: string): boolean {
  const trimmed = text.trim();
  // 先排除筛选和特殊指令（特殊指令优先判断）
  if (isFilterCommand(trimmed)) return false;
  if (isSpecialCommand(trimmed)) return false;
  // 排除统计类指令
  const aggregateTriggers = ['计算', '求', '统计', '总和', '平均', '最大', '最小', '计数', '数量'];
  for (const trigger of aggregateTriggers) {
    if (trimmed.includes(trigger)) return false;
  }
  // 检查操作指令触发词
  for (const trigger of OPERATION_TRIGGERS) {
    if (trimmed.startsWith(trigger) || trimmed.includes(trigger)) return true;
  }
  return false;
}

/** 判断是否为特殊指令（不依赖选中） */
export function isSpecialCommand(text: string): boolean {
  const trimmed = text.trim();
  // 匹配新增/增加/添加类指令（如"增加5行"、"新增3列"）
  if (/^(?:新增|增加|添加|插入)\s*\d+\s*(?:行|列)/.test(trimmed)) return true;
  if (/^(?:新增|增加|添加|插入)(?:行|列)/.test(trimmed)) return true;
  // 匹配其他特殊指令
  for (const trigger of SPECIAL_TRIGGERS) {
    if (trimmed === trigger || trimmed.startsWith(trigger)) return true;
  }
  return false;
}

/** 从筛选指令中提取关键词 */
export function extractFilterKeyword(text: string): string {
  const trimmed = text.trim();
  for (const trigger of FILTER_TRIGGERS) {
    if (trimmed.startsWith(trigger)) {
      let keyword = trimmed.slice(trigger.length).trim();
      // 处理"关键词"前缀（如"查找关键词新款" -> "新款"）
      if (keyword.startsWith('关键词')) {
        keyword = keyword.slice(3).trim();
      }
      return keyword;
    }
  }
  return trimmed;
}