/**
 * SKU处理服务
 * 实现单规格SKU的展开和合并功能
 */

import type { PlatformType } from '../types/productModel';

/** SKU展开选项 */
export interface SKUExpansionOptions {
  /** 规格列索引 */
  specColIndex: number;
  /** 规格值分隔符 */
  delimiter: string;
  /** 价格列索引（可选，用于平均分配） */
  priceColIndex?: number;
  /** 库存列索引（可选，用于平均分配） */
  stockColIndex?: number;
  /** 目标平台（用于SKU数量限制检查） */
  platform?: PlatformType;
}

/** SKU展开结果 */
export interface SKUExpansionResult {
  /** 生成的SKU行数据 */
  skuRows: Array<Record<string, string>>;
  /** SKU数量 */
  skuCount: number;
  /** 是否超出平台限制 */
  exceedsLimit: boolean;
  /** 超限警告 */
  limitWarning?: string;
  /** 原行索引 */
  sourceRowIndex: number;
}

/** SKU合并选项 */
export interface SKUMergeOptions {
  /** 规格列索引 */
  specColIndex: number;
  /** 合并时使用的分隔符 */
  delimiter: string;
}

/** SKU合并结果 */
export interface SKUMergeResult {
  /** 合并后的行数据 */
  mergedRow: Record<string, string>;
  /** 合并的SKU数量 */
  mergedCount: number;
  /** 原行索引列表 */
  sourceRowIndices: number[];
}

/** 平台SKU限制 */
const SKU_LIMITS: Record<PlatformType, number> = {
  taobao: 150,
  douyin: 100,
  wechat: 50,
};

/**
 * 解析规格值字符串
 * 如 "红色,蓝色,绿色" -> ["红色", "蓝色", "绿色"]
 */
export function parseSpecValues(value: string, delimiter: string = ','): string[] {
  const normalizedDelimiter = delimiter === ',' ? /[,，;；]/ : new RegExp(delimiter);
  return value
    .split(normalizedDelimiter)
    .map(v => v.trim())
    .filter(v => v.length > 0);
}

/**
 * 将单行商品展开为多行SKU
 * 用于将"颜色:红,蓝,绿"的一行展开为三行
 */
export function expandSKUFromRow(
  rowData: Record<string, string>,
  rowIndex: number,
  options: SKUExpansionOptions
): SKUExpansionResult {
  const { specColIndex, delimiter, priceColIndex, stockColIndex, platform } = options;

  // 获取规格列的值
  const specValueStr = rowData[specColIndex.toString()] ?? '';
  const specValues = parseSpecValues(specValueStr, delimiter);

  if (specValues.length === 0) {
    return {
      skuRows: [],
      skuCount: 0,
      exceedsLimit: false,
      sourceRowIndex: rowIndex,
    };
  }

  // 检查SKU数量限制
  const skuLimit = platform ? SKU_LIMITS[platform] : 150;
  const exceedsLimit = specValues.length > skuLimit;

  // 获取原价格和库存（用于分配）
  const originalPrice = priceColIndex ? parseFloat(rowData[priceColIndex.toString()] ?? '0') : 0;
  const originalStock = stockColIndex ? parseInt(rowData[stockColIndex.toString()] ?? '0', 10) : 0;

  // 平均分配价格和库存
  const pricePerSku = originalPrice > 0 ? originalPrice : 0;
  const stockPerSku = originalStock > 0 ? Math.floor(originalStock / specValues.length) : 0;
  const stockRemainder = originalStock > 0 ? originalStock % specValues.length : 0;

  // 生成SKU行
  const skuRows: Array<Record<string, string>> = specValues.map((specValue, idx) => {
    const newRow: Record<string, string> = { ...rowData };
    newRow[specColIndex.toString()] = specValue;

    // 分配价格
    if (priceColIndex && pricePerSku > 0) {
      newRow[priceColIndex.toString()] = pricePerSku.toFixed(2);
    }

    // 分配库存（余数分配给第一个SKU）
    if (stockColIndex && stockPerSku > 0) {
      const extraStock = idx === 0 ? stockRemainder : 0;
      newRow[stockColIndex.toString()] = (stockPerSku + extraStock).toString();
    }

    return newRow;
  });

  const limitWarning = exceedsLimit
    ? `SKU数量${specValues.length}超出${platform ?? 'taobao'}平台上限${skuLimit}`
    : undefined;

  return {
    skuRows,
    skuCount: specValues.length,
    exceedsLimit,
    limitWarning,
    sourceRowIndex: rowIndex,
  };
}

/**
 * 将多行SKU合并为单行
 * 用于将多行规格值合并为一行（如三行颜色值合并为"红,蓝,绿"）
 */
export function mergeSKUsToRow(
  rowsData: Array<Record<string, string>>,
  rowIndices: number[],
  options: SKUMergeOptions
): SKUMergeResult {
  const { specColIndex, delimiter } = options;

  if (rowsData.length === 0) {
    return {
      mergedRow: {},
      mergedCount: 0,
      sourceRowIndices: [],
    };
  }

  // 收集所有规格值
  const specValues: string[] = [];
  for (const row of rowsData) {
    const value = row[specColIndex.toString()] ?? '';
    if (value.trim()) {
      specValues.push(value.trim());
    }
  }

  // 合并后的行（以第一行为基础）
  const mergedRow: Record<string, string> = { ...rowsData[0] };
  mergedRow[specColIndex.toString()] = specValues.join(delimiter);

  return {
    mergedRow,
    mergedCount: specValues.length,
    sourceRowIndices: rowIndices,
  };
}

/**
 * 计算SKU展开后的总行数
 */
export function calculateExpandedRowCount(
  tableData: Record<string, string>,
  rowCount: number,
  specColIndex: number,
  delimiter: string = ','
): number {
  let expandedCount = 0;

  for (let row = 0; row < rowCount; row++) {
    const cellKey = `${row}-${specColIndex}`;
    const value = tableData[cellKey] ?? '';
    const specValues = parseSpecValues(value, delimiter);
    expandedCount += specValues.length > 0 ? specValues.length : 1;
  }

  return expandedCount;
}

/**
 * 检查SKU数量是否符合平台要求
 */
export function validateSKUCount(
  skuCount: number,
  platform: PlatformType
): { valid: boolean; message: string } {
  const limit = SKU_LIMITS[platform];

  if (skuCount > limit) {
    return {
      valid: false,
      message: `${platform}平台SKU上限为${limit}，当前${skuCount}个超限`,
    };
  }

  if (skuCount > limit * 0.8) {
    return {
      valid: true,
      message: `SKU数量接近${platform}上限（${limit}），当前${skuCount}个`,
    };
  }

  return {
    valid: true,
    message: '',
  };
}

/**
 * 智能分配库存到各SKU
 */
export function distributeStock(
  totalStock: number,
  skuCount: number,
  strategy: 'equal' | 'proportional' | 'custom',
  customDistribution?: number[]
): number[] {
  if (strategy === 'custom' && customDistribution) {
    return customDistribution;
  }

  if (strategy === 'equal') {
    const baseStock = Math.floor(totalStock / skuCount);
    const remainder = totalStock % skuCount;
    const distribution = Array(skuCount).fill(baseStock);
    distribution[0] += remainder; // 余数给第一个
    return distribution;
  }

  // proportional: 暂不支持，返回均分
  return distributeStock(totalStock, skuCount, 'equal');
}

/**
 * 智能分配价格到各SKU
 */
export function distributePrice(
  basePrice: number,
  skuCount: number,
  strategy: 'same' | 'range',
  priceRange?: { min: number; max: number }
): number[] {
  if (strategy === 'same') {
    return Array(skuCount).fill(basePrice);
  }

  if (strategy === 'range' && priceRange) {
    // 简单线性分布
    const step = (priceRange.max - priceRange.min) / (skuCount - 1);
    return Array.from({ length: skuCount }, (_, i) => priceRange.min + step * i);
  }

  return Array(skuCount).fill(basePrice);
}