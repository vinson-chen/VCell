/**
 * 商品Agent L0规则
 * 支持商品字段识别、SKU展开、平台导出等快捷命令
 */

import type { ProductAgentAction } from './types/productActions';
import type { TableAreaDemoModel } from '@vinson.hx/vc-biz';
import { detectProductFields, checkExportReadiness } from './services/productDetector';

type QuickParseResult = Readonly<
  | { matched: true; reply: string; actions: ProductAgentAction[] }
  | { matched: false }
>;

type QuickRuleMatch = Readonly<{
  reply: string;
  actions: ProductAgentAction[];
}>;

type QuickRuleDef = Readonly<{
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

function findSpecColumn(model: TableAreaDemoModel): number | null {
  const keys = ['颜色', '尺码', '尺寸', '规格', '型号', '款式'];
  for (let c = 0; c < model.colCount; c += 1) {
    const h = model.valueByCell[`header-${c}`] ?? '';
    if (keys.some((k) => h.includes(k))) return c;
  }
  return null;
}

function findPriceColumn(model: TableAreaDemoModel): number | null {
  const keys = ['价格', '售价', '单价', 'price'];
  for (let c = 0; c < model.colCount; c += 1) {
    const h = model.valueByCell[`header-${c}`] ?? '';
    if (keys.some((k) => h.includes(k))) return c;
  }
  return null;
}

function findStockColumn(model: TableAreaDemoModel): number | null {
  const keys = ['库存', '数量', 'stock'];
  for (let c = 0; c < model.colCount; c += 1) {
    const h = model.valueByCell[`header-${c}`] ?? '';
    if (keys.some((k) => h.includes(k))) return c;
  }
  return null;
}

function normalizeQuickText(text: string): string {
  return text
    .replace(/[，,；;、]/g, ' ')
    .replace(/[。！？!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 解析商品专属快捷命令 */
export function parseProductQuickCommand(text: string, model: TableAreaDemoModel): QuickParseResult {
  const t = normalizeQuickText(text);
  if (!t) return { matched: false };

  const rules = [...PRODUCT_QUICK_RULES].sort((a, b) => b.priority - a.priority);
  for (const rule of rules) {
    for (const re of rule.patterns) {
      const m = t.match(re);
      if (!m) continue;
      const out = rule.run(t, model, m);
      if (out) {
        return { matched: true, reply: out.reply, actions: out.actions };
      }
    }
  }

  return { matched: false };
}

/** 商品L0规则定义 */
export const PRODUCT_QUICK_RULES: QuickRuleDef[] = [
  // ===== 商品字段识别 =====
  {
    id: 'detect_product_fields',
    intent: 'detect_product_columns',
    priority: 500, // 高优先级，商品专属能力
    patterns: [
      /^(?:请)?识别(?:商品|本表|表格)(?:字段|列类型)$/,
      /^(?:请)?检测(?:商品|本表|表格)(?:字段|列类型)$/,
      /^(?:请)?分析(?:商品|本表|表格)(?:字段|列类型)$/,
      /^(?:请)?识别商品(?:信息|资料)?$/,
      /^(?:请)?这是什么(?:类型)?表$/,
      /^(?:请)?帮我识别(?:下)?(?:这)?(?:张)?表$/,
    ],
    run: (_text, model) => {
      const table = {
        rowCount: model.rowCount,
        colCount: model.colCount,
        valueByCell: model.valueByCell,
      };
      const detection = detectProductFields(table);

      if (!detection.isProductTable) {
        return {
          reply: '当前表格未检测到商品字段特征，建议添加商品标题、价格、库存等列。',
          actions: [],
        };
      }

      const detectedCols = detection.columns
        .filter(c => c.detectedField)
        .map(c => `第${c.colIndex + 1}列(${model.valueByCell[`header-${c.colIndex}`] ?? ''}→${c.detectedField})`)
        .join('、');

      const specInfo = detection.specColumns.length > 0
        ? ` 检测到规格列：${detection.specColumns.map(s => s.headerText).join('、')}`
        : '';

      return {
        reply: `已识别为商品表格，置信度${Math.round(detection.overallConfidence * 100)}%。检测到字段：${detectedCols}${specInfo}`,
        actions: [{
          type: 'detect_product_columns',
          detectedMapping: detection.columns.reduce((acc, c) => {
            if (c.detectedField) acc[c.colIndex] = c.detectedField;
            return acc;
          }, {} as Record<number, string>),
          specColIndices: detection.specColumns.map(s => s.colIndex),
          confidence: detection.overallConfidence,
        }],
      };
    },
  },
  // ===== SKU展开 =====
  {
    id: 'expand_sku_by_spec_column',
    intent: 'expand_sku_rows',
    priority: 450,
    patterns: [
      /^(?:请)?(?:把)?(?:颜色|尺码|尺寸|规格|型号|款式)列(?:展开|拆分)(?:成多行)?$/,
      /^(?:请)?(?:把)?(?:颜色|尺码|尺寸|规格|型号|款式)(?:值)?(?:展开|拆分)(?:成多行)?$/,
      /^(?:请)?展开(?:规格|颜色|尺码)(?:列)?$/,
      /^(?:请)?(?:把)?第\s*(\d+)\s*列(?:的)?规格(?:值)?(?:展开|拆分)(?:成多行)?$/,
    ],
    run: (_text, model, m) => {
      let specColIndex = findSpecColumn(model);
      if (m[1]) {
        const col = parsePosInt(m[1]);
        if (col != null) specColIndex = col - 1;
      }
      if (specColIndex == null || specColIndex < 0 || specColIndex >= model.colCount) {
        return null;
      }

      const headerText = model.valueByCell[`header-${specColIndex}`] ?? '';
      const priceCol = findPriceColumn(model);
      const stockCol = findStockColumn(model);

      return {
        reply: `已识别规格列「${headerText}」（第${specColIndex + 1}列），将展开为多条SKU行。`,
        actions: [{
          type: 'expand_sku_rows',
          specColIndex,
          delimiter: ',',
          priceColIndex: priceCol ?? undefined,
          stockColIndex: stockCol ?? undefined,
        }],
      };
    },
  },
  // ===== SKU合并 =====
  {
    id: 'merge_sku_rows',
    intent: 'merge_sku_rows',
    priority: 449,
    patterns: [
      /^(?:请)?(?:把)?(?:多行)?(?:规格|颜色|尺码|尺寸)(?:值)?(?:合并|合并成一行)?$/,
      /^(?:请)?(?:把)?(?:选中)?(?:的)?(?:多行)?SKU(?:合并|合并成一行)?$/,
      /^(?:请)?合并(?:规格|颜色|尺码)(?:列)?(?:的值)?$/,
    ],
    run: (_text, model) => {
      const specColIndex = findSpecColumn(model);
      if (specColIndex == null) {
        return null;
      }
      const headerText = model.valueByCell[`header-${specColIndex}`] ?? '';
      return {
        reply: `已识别规格列「${headerText}」（第${specColIndex + 1}列），将合并规格值为一行。`,
        actions: [{
          type: 'merge_sku_rows',
          specColIndex,
          delimiter: ',',
        }],
      };
    },
  },
  // ===== 平台导出校验 =====
  {
    id: 'validate_for_taobao',
    intent: 'validate_for_platform',
    priority: 420,
    patterns: [
      /^(?:请)?(?:校验|检查|验证)淘宝(?:格式|导入)?(?:要求)?$/,
      /^(?:请)?(?:校验|检查|验证)(?:本表|表格)(?:能否)?导入淘宝$/,
      /^(?:请)?(?:校验|检查|验证)(?:能否)?导出淘宝$/,
    ],
    run: (_text, model) => {
      const table = {
        rowCount: model.rowCount,
        colCount: model.colCount,
        valueByCell: model.valueByCell,
      };
      const detection = detectProductFields(table);
      const readiness = checkExportReadiness(detection, 'taobao');

      if (readiness.ready) {
        return {
          reply: '当前表格符合淘宝导入要求，可以导出。',
          actions: [{ type: 'validate_for_platform', platform: 'taobao', level: 'strict' }],
        };
      }

      return {
        reply: `当前表格不符合淘宝导入要求：${readiness.issues.join('；')}`,
        actions: [{ type: 'validate_for_platform', platform: 'taobao', level: 'strict' }],
      };
    },
  },
  {
    id: 'validate_for_douyin',
    intent: 'validate_for_platform',
    priority: 419,
    patterns: [
      /^(?:请)?(?:校验|检查|验证)抖店(?:格式|导入)?(?:要求)?$/,
      /^(?:请)?(?:校验|检查|验证)(?:本表|表格)(?:能否)?导入抖店$/,
      /^(?:请)?(?:校验|检查|验证)(?:能否)?导出抖店$/,
    ],
    run: (_text, model) => {
      const table = {
        rowCount: model.rowCount,
        colCount: model.colCount,
        valueByCell: model.valueByCell,
      };
      const detection = detectProductFields(table);
      const readiness = checkExportReadiness(detection, 'douyin');

      if (readiness.ready) {
        return {
          reply: '当前表格符合抖店导入要求，可以导出。',
          actions: [{ type: 'validate_for_platform', platform: 'douyin', level: 'strict' }],
        };
      }

      return {
        reply: `当前表格不符合抖店导入要求：${readiness.issues.join('；')}`,
        actions: [{ type: 'validate_for_platform', platform: 'douyin', level: 'strict' }],
      };
    },
  },
  // ===== 商品模板创建 =====
  {
    id: 'create_basic_product_template',
    intent: 'create_product_template',
    priority: 410,
    patterns: [
      /^(?:请)?(?:创建|新建|生成)(?:一个)?(?:基础|简单)?(?:商品)?模板(?:表格)?$/,
      /^(?:请)?(?:创建|新建|生成)(?:一个)?商品模板(?:表)?$/,
    ],
    run: () => {
      return {
        reply: '已创建基础商品模板，包含商品标题、类目、货号、售价、库存、主图等列。',
        actions: [{ type: 'create_product_template', templateType: 'basic' }],
      };
    },
  },
  {
    id: 'create_sku_product_template',
    intent: 'create_product_template',
    priority: 409,
    patterns: [
      /^(?:请)?(?:创建|新建|生成)(?:一个)?(?:带规格|多规格|有SKU)?(?:商品)?模板(?:表格)?$/,
      /^(?:请)?(?:创建|新建|生成)(?:一个)?规格商品模板(?:表)?$/,
    ],
    run: () => {
      return {
        reply: '已创建带规格商品模板，包含商品标题、类目、品牌、货号、价格、库存、规格名、规格值、主图等列。',
        actions: [{ type: 'create_product_template', templateType: 'with_sku' }],
      };
    },
  },
  // ===== 商品批量编辑 =====
  {
    id: 'batch_price_discount',
    intent: 'column_numeric_transform',
    priority: 405,
    patterns: [
      /^(?:请)?(?:把)?(?:售价|价格)(?:列)?(?:全部|统一)?打\s*(\d+(?:\.\d+)?)\s*折$/,
      /^(?:请)?(?:售价|价格)(?:列)?(?:全部|统一)?打\s*(\d+(?:\.\d+)?)\s*折$/,
    ],
    run: (_text, model, m) => {
      const priceCol = findPriceColumn(model);
      if (priceCol == null) return null;

      const discount = Number.parseFloat(m[1] ?? '');
      if (!Number.isFinite(discount) || discount <= 0 || discount > 100) return null;
      const ratio = discount >= 1 ? discount / 10 : discount;

      return {
        reply: `已将价格列（第${priceCol + 1}列）统一打 ${m[1]} 折。`,
        actions: [{ type: 'column_numeric_transform', colIndex: priceCol, op: 'multiply', value: ratio, decimals: 2 }],
      };
    },
  },
  {
    id: 'batch_stock_fill',
    intent: 'fill_empty_in_column',
    priority: 400,
    patterns: [
      /^(?:请)?(?:把)?(?:库存|数量)(?:列)?(?:的)?空(?:单元格)?(?:填充为|填为|改为)\s*(\d+)$/,
      /^(?:请)?(?:库存|数量)(?:列)?空值(?:填充为|填为|改为)\s*(\d+)$/,
    ],
    run: (_text, model, m) => {
      const stockCol = findStockColumn(model);
      if (stockCol == null) return null;

      const value = m[1] ?? '';
      if (!value) return null;

      return {
        reply: `已将库存列（第${stockCol + 1}列）空单元格填充为 ${value}。`,
        actions: [{ type: 'fill_empty_in_column', colIndex: stockCol, value }],
      };
    },
  },
];

/** 合并商品规则到主规则列表 */
export function mergeProductRules(baseRules: QuickRuleDef[]): QuickRuleDef[] {
  return [...PRODUCT_QUICK_RULES, ...baseRules];
}