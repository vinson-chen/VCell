/**
 * 跨平台翻译服务
 * 将商品主数据转换为符合各平台规范的格式
 */

import {
  loadSkill,
  validateCompliance,
  translateFields,
  generateComplianceReport,
  type ComplianceResult,
  type TranslationResult,
  type PlatformRuleSkill,
} from '../skills';

/**
 * 批量翻译请求
 */
export interface BatchTranslateRequest {
  sourcePlatform: string;
  targetPlatform: string;
  rows: Array<Record<string, string>>;
}

/**
 * 批量翻译响应
 */
export interface BatchTranslateResponse {
  success: boolean;
  translatedRows: Array<Record<string, string>>;
  summary: {
    totalRows: number;
    successRows: number;
    failedRows: number;
  };
  complianceSummary: {
    validRows: number;
    invalidRows: number;
    violationsByType: Record<string, number>;
  };
  reports: Array<{
    rowIndex: number;
    complianceReport: string;
  }>;
  errors: Array<{
    rowIndex: number;
    error: string;
  }>;
}

/**
 * 平台转换规则
 */
interface TransformRule {
  field: string;
  action: 'truncate' | 'prefix' | 'suffix' | 'replace' | 'generate';
  params?: {
    maxLength?: number;
    prefix?: string;
    suffix?: string;
    pattern?: string;
    replacement?: string;
    generator?: string;
  };
}

/**
 * 执行批量翻译
 */
export function batchTranslate(request: BatchTranslateRequest): BatchTranslateResponse {
  const { sourcePlatform, targetPlatform, rows } = request;

  const targetSkill = loadSkill(targetPlatform);
  if (!targetSkill) {
    return {
      success: false,
      translatedRows: [],
      summary: { totalRows: rows.length, successRows: 0, failedRows: rows.length },
      complianceSummary: { validRows: 0, invalidRows: 0, violationsByType: {} },
      reports: [],
      errors: rows.map((_, i) => ({ rowIndex: i, error: `未知目标平台: ${targetPlatform}` })),
    };
  }

  const translatedRows: Array<Record<string, string>> = [];
  const reports: Array<{ rowIndex: number; complianceReport: string }> = [];
  const errors: Array<{ rowIndex: number; error: string }> = [];
  const violationsByType: Record<string, number> = {};

  let successRows = 0;
  let failedRows = 0;
  let validRows = 0;
  let invalidRows = 0;

  rows.forEach((row, index) => {
    try {
      // 1. 字段翻译
      const translation = translateFields(sourcePlatform, targetPlatform, row);

      // 2. 应用平台特定转换规则
      const transformed = applyTransformRules(translation.translatedData, targetSkill);

      // 3. 合规校验
      const compliance = validateCompliance(targetPlatform, transformed);

      translatedRows.push(transformed);
      reports.push({
        rowIndex: index,
        complianceReport: generateComplianceReport(compliance),
      });

      if (compliance.isValid) {
        validRows++;
        successRows++;
      } else {
        invalidRows++;
        successRows++; // 翻译成功但合规有问题

        // 统计违规类型
        compliance.violations.forEach((v) => {
          violationsByType[v.ruleName] = (violationsByType[v.ruleName] || 0) + 1;
        });
      }

      // 记录缺失字段
      if (translation.missingFields.length > 0) {
        reports[index].complianceReport += `\n\n缺失字段: ${translation.missingFields.join(', ')}`;
      }
    } catch (e) {
      failedRows++;
      errors.push({
        rowIndex: index,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  return {
    success: failedRows === 0,
    translatedRows,
    summary: { totalRows: rows.length, successRows, failedRows },
    complianceSummary: { validRows, invalidRows, violationsByType },
    reports,
    errors,
  };
}

/**
 * 应用转换规则
 */
function applyTransformRules(
  data: Record<string, string>,
  skill: PlatformRuleSkill
): Record<string, string> {
  const transformed = { ...data };

  // 标题长度处理
  const titleKey = findFieldKey(skill, ['商品标题', '商品名称', 'title', 'productName']);
  if (titleKey && transformed[titleKey]) {
    const maxLength = skill.platformRules.titleMaxLength;
    if (transformed[titleKey].length > maxLength) {
      // 智能截断：优先保留关键信息
      transformed[titleKey] = smartTruncate(transformed[titleKey], maxLength);
    }
  }

  // 价格格式化
  const priceKey = findFieldKey(skill, ['售价', '价格', 'price']);
  if (priceKey && transformed[priceKey]) {
    const price = parseFloat(transformed[priceKey]);
    if (!isNaN(price)) {
      transformed[priceKey] = price.toFixed(2);
    }
  }

  // 库存格式化
  const stockKey = findFieldKey(skill, ['库存', 'stock']);
  if (stockKey && transformed[stockKey]) {
    const stock = parseInt(transformed[stockKey], 10);
    if (!isNaN(stock)) {
      transformed[stockKey] = stock.toString();
    }
  }

  // 应用默认值
  for (const field of skill.fields) {
    if (field.defaultValue && !transformed[field.name]) {
      transformed[field.name] = field.defaultValue;
    }
  }

  return transformed;
}

/**
 * 查找字段键名
 */
function findFieldKey(
  skill: PlatformRuleSkill,
  possibleNames: string[]
): string | null {
  for (const name of possibleNames) {
    // 检查中文名
    if (skill.fields.some(f => f.name === name)) {
      return name;
    }
    // 检查平台键
    if (skill.fields.some(f => f.platformKey === name)) {
      return skill.fields.find(f => f.platformKey === name)?.name || name;
    }
  }
  return null;
}

/**
 * 智能截断：保留关键信息
 */
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // 优先保留：品牌、核心卖点
  const importantPatterns = [
    /[\d]+年新款/i,
    /新款/i,
    /[春夏秋冬]/i,
    /品牌\d+/i,
  ];

  let result = text;

  // 先尝试简单截断
  result = text.substring(0, maxLength);

  // 检查是否截断在关键位置
  if (result.endsWith('...') || result.endsWith('新')) {
    // 尝试从空格或分隔符截断
    const separators = [' ', ',', '，', '|', '｜', '-', '—', '/', '、'];
    for (const sep of separators) {
      const lastSepIndex = result.lastIndexOf(sep);
      if (lastSepIndex > maxLength * 0.7) {
        result = result.substring(0, lastSepIndex);
        break;
      }
    }
  }

  return result;
}

/**
 * 检测价格异常
 */
export function detectPriceAnomaly(
  prices: number[],
  threshold: { lowRatio?: number; highRatio?: number }
): Array<{ type: 'too_low' | 'too_high' | 'normal'; price: number; reason: string }> {
  if (prices.length === 0) return [];

  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const lowThreshold = avgPrice * (threshold.lowRatio ?? 0.5);
  const highThreshold = avgPrice * (threshold.highRatio ?? 2);

  return prices.map((price) => {
    if (price < lowThreshold) {
      return {
        type: 'too_low',
        price,
        reason: `价格${price}低于均价${avgPrice.toFixed(2)}的50%，可能为低价引流`,
      };
    }
    if (price > highThreshold) {
      return {
        type: 'too_high',
        price,
        reason: `价格${price}高于均价${avgPrice.toFixed(2)}的200%，需人工复核`,
      };
    }
    return { type: 'normal', price, reason: '价格正常' };
  });
}

/**
 * 检测SKU低价引流
 */
export function detectSKUPriceTrap(
  skuPrices: Array<{ name: string; price: number }>
): { hasTrap: boolean; trapItems: Array<{ name: string; price: number; reason: string }> } {
  if (skuPrices.length < 2) return { hasTrap: false, trapItems: [] };

  // 找出最低价SKU
  const sortedByPrice = [...skuPrices].sort((a, b) => a.price - b.price);
  const lowest = sortedByPrice[0];
  const secondLowest = sortedByPrice[1];

  // 如果最低价明显低于其他价格（配件引流）
  const trapItems: Array<{ name: string; price: number; reason: string }> = [];

  // 检测配件类关键词
  const accessoryKeywords = ['配件', '赠品', '包装', '说明书', '样品', '试用', '体验'];
  if (accessoryKeywords.some(kw => lowest.name.includes(kw))) {
    trapItems.push({
      name: lowest.name,
      price: lowest.price,
      reason: 'SKU名称包含配件/赠品关键词，可能为低价引流',
    });
  }

  // 检测价格差异过大
  if (lowest.price < secondLowest.price * 0.3) {
    trapItems.push({
      name: lowest.name,
      price: lowest.price,
      reason: `最低价SKU仅为第二低价的${((lowest.price / secondLowest.price) * 100).toFixed(0)}%，差异过大`,
    });
  }

  return {
    hasTrap: trapItems.length > 0,
    trapItems,
  };
}

/**
 * 生成跨平台导出预览
 */
export function generateExportPreview(
  sourceData: Array<Record<string, string>>,
  targetPlatform: string
): {
  previewRows: Array<{ original: Record<string, string>; transformed: Record<string, string>; issues: string[] }>;
  overallCompliance: ComplianceResult;
} {
  const skill = loadSkill(targetPlatform);
  if (!skill) {
    return {
      previewRows: [],
      overallCompliance: {
        isValid: false,
        violations: [],
        warnings: [`未知平台: ${targetPlatform}`],
        passedChecks: [],
      },
    };
  }

  const previewRows = sourceData.slice(0, 5).map((row) => {
    const translation = translateFields('unknown', targetPlatform, row);
    const transformed = applyTransformRules(translation.translatedData, skill);
    const compliance = validateCompliance(targetPlatform, transformed);

    return {
      original: row,
      transformed,
      issues: compliance.violations.map(v => v.message),
    };
  });

  // 整体合规统计
  const allViolations = previewRows.flatMap((r) =>
    validateCompliance(targetPlatform, r.transformed).violations
  );

  const overallCompliance: ComplianceResult = {
    isValid: allViolations.filter(v => v.severity === 'critical').length === 0,
    violations: allViolations,
    warnings: [],
    passedChecks: [],
  };

  return {
    previewRows,
    overallCompliance,
  };
}