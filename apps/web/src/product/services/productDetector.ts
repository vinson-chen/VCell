/**
 * 商品字段智能识别服务
 * 根据表头关键词自动识别商品字段类型
 */

import { PRODUCT_FIELD_KEYWORDS } from '../types/productActions';

/** 表格快照类型（与现有架构对齐） */
export interface TableSnapshot {
  rowCount: number;
  colCount: number;
  valueByCell: Record<string, string>;
}

/** 单列检测结果 */
export interface ColumnDetection {
  /** 列索引 */
  colIndex: number;
  /** 表头原文 */
  headerText: string;
  /** 检测到的字段名 */
  detectedField: string | null;
  /** 置信度 (0-1) */
  confidence: number;
  /** 匹配的关键词 */
  matchedKeywords: string[];
}

/** 规格列检测结果 */
export interface SpecColumnDetection {
  /** 列索引 */
  colIndex: number;
  /** 表头原文 */
  headerText: string;
  /** 检测到的规格名 */
  specName: string;
  /** 从表体提取的规格值列表 */
  detectedValues: string[];
}

/** 商品表格检测结果 */
export interface ProductDetectionResult {
  /** 是否为商品表格 */
  isProductTable: boolean;
  /** 各列检测结果 */
  columns: ColumnDetection[];
  /** 规格列检测结果 */
  specColumns: SpecColumnDetection[];
  /** 整体置信度 */
  overallConfidence: number;
  /** 检测到的商品字段数量 */
  detectedFieldCount: number;
  /** 必填字段覆盖情况 */
  requiredFieldCoverage: {
    title: boolean;
    price: boolean;
    stock: boolean;
    mainImage: boolean;
  };
  /** 建议操作 */
  suggestions: string[];
}

/** 规格相关字段 - 用于后续扩展 */
// 保留供后续双规格扩展使用

/**
 * 检测表格是否为商品表格并识别字段
 */
export function detectProductFields(table: TableSnapshot): ProductDetectionResult {
  const columns: ColumnDetection[] = [];
  const specColumns: SpecColumnDetection[] = [];
  let detectedFieldCount = 0;

  // 遍历所有列，检测表头
  for (let col = 0; col < table.colCount; col++) {
    const headerKey = `header-${col}`;
    const headerText = (table.valueByCell[headerKey] ?? '').trim().toLowerCase();

    const detection = detectSingleColumn(col, headerText);
    columns.push(detection);

    if (detection.detectedField) {
      detectedFieldCount++;
    }

    // 如果检测到规格列，提取规格值
    if (detection.detectedField === 'specName') {
      const values = extractSpecValues(table, col);
      specColumns.push({
        colIndex: col,
        headerText: table.valueByCell[headerKey] ?? '',
        specName: values.length > 0 ? detection.matchedKeywords[0] : '',
        detectedValues: values,
      });
    }
  }

  // 判断是否为商品表格
  const isProductTable = detectedFieldCount >= 3; // 至少识别出3个商品字段

  // 计算整体置信度
  const avgConfidence = columns.reduce((sum, c) => sum + c.confidence, 0) / columns.length;
  const overallConfidence = isProductTable ? avgConfidence * 1.2 : avgConfidence * 0.5;

  // 检查必填字段覆盖
  const detectedFieldsSet = new Set(columns.filter(c => c.detectedField).map(c => c.detectedField!));
  const requiredFieldCoverage = {
    title: detectedFieldsSet.has('title'),
    price: detectedFieldsSet.has('salePrice') || detectedFieldsSet.has('marketPrice'),
    stock: detectedFieldsSet.has('totalStock'),
    mainImage: detectedFieldsSet.has('mainImage'),
  };

  // 生成建议
  const suggestions = generateSuggestions(requiredFieldCoverage, detectedFieldsSet, specColumns);

  return {
    isProductTable,
    columns,
    specColumns,
    overallConfidence: Math.min(1, overallConfidence),
    detectedFieldCount,
    requiredFieldCoverage,
    suggestions,
  };
}

/**
 * 检测单个列的字段类型
 */
function detectSingleColumn(colIndex: number, headerText: string): ColumnDetection {
  let bestMatch: { field: string; confidence: number; keywords: string[] } | null = null;

  for (const [fieldName, keywords] of Object.entries(PRODUCT_FIELD_KEYWORDS)) {
    const matchedKeywords = keywords.filter(kw => headerText.includes(kw.toLowerCase()));

    if (matchedKeywords.length > 0) {
      // 精确匹配权重更高
      const exactMatch = matchedKeywords.some(kw => headerText === kw.toLowerCase());
      const confidence = exactMatch ? 0.95 : 0.6 + matchedKeywords.length * 0.1;

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { field: fieldName, confidence: Math.min(1, confidence), keywords: matchedKeywords };
      }
    }
  }

  return {
    colIndex,
    headerText,
    detectedField: bestMatch?.field ?? null,
    confidence: bestMatch?.confidence ?? 0,
    matchedKeywords: bestMatch?.keywords ?? [],
  };
}

/**
 * 从规格列提取规格值列表
 */
function extractSpecValues(table: TableSnapshot, specColIndex: number): string[] {
  const valuesSet = new Set<string>();

  for (let row = 0; row < table.rowCount; row++) {
    const cellKey = `${row}-${specColIndex}`;
    const cellValue = (table.valueByCell[cellKey] ?? '').trim();

    if (cellValue) {
      // 支持逗号分隔的多值
      const splitValues = cellValue.split(/[,，;；]/).filter(v => v.trim());
      splitValues.forEach(v => valuesSet.add(v.trim()));
    }
  }

  return Array.from(valuesSet);
}

/**
 * 生成检测建议
 */
function generateSuggestions(
  coverage: ProductDetectionResult['requiredFieldCoverage'],
  detectedFields: Set<string>,
  specColumns: SpecColumnDetection[]
): string[] {
  const suggestions: string[] = [];

  // 检查缺失必填字段
  if (!coverage.title) {
    suggestions.push('建议添加"商品标题"列');
  }
  if (!coverage.price) {
    suggestions.push('建议添加"售价"列');
  }
  if (!coverage.stock) {
    suggestions.push('建议添加"库存"列');
  }
  if (!coverage.mainImage) {
    suggestions.push('建议添加"主图"列');
  }

  // 检查规格列
  if (specColumns.length > 0) {
    const specCol = specColumns[0];
    if (specCol.detectedValues.length === 0) {
      suggestions.push('规格列未检测到规格值，请在表体填写规格值');
    } else if (specCol.detectedValues.length > 10) {
      suggestions.push(`检测到${specCol.detectedValues.length}个规格值，SKU数量可能超过平台限制`);
    }
  }

  // 检查是否有重复检测
  if (detectedFields.has('salePrice') && detectedFields.has('marketPrice')) {
    suggestions.push('检测到"售价"和"原价"两列，导出时会分别映射');
  }

  return suggestions;
}

/**
 * 根据检测结果生成字段映射
 * 用于导出时的列头转换
 */
export function generateFieldMappingFromDetection(
  detection: ProductDetectionResult
): Record<number, string> {
  const mapping: Record<number, string> = {};

  for (const col of detection.columns) {
    if (col.detectedField) {
      mapping[col.colIndex] = col.detectedField;
    }
  }

  return mapping;
}

/**
 * 检查表格是否适合导出到指定平台
 */
export function checkExportReadiness(
  detection: ProductDetectionResult,
  platform: 'taobao' | 'douyin' | 'wechat'
): { ready: boolean; issues: string[] } {
  const issues: string[] = [];

  // 基础必填检查
  if (!detection.requiredFieldCoverage.title) {
    issues.push('缺少商品标题（必填）');
  }
  if (!detection.requiredFieldCoverage.price) {
    issues.push('缺少售价（必填）');
  }
  if (!detection.requiredFieldCoverage.stock) {
    issues.push('缺少库存（必填）');
  }

  // 平台特定检查
  if (platform === 'douyin') {
    const hasBrand = detection.columns.some(c => c.detectedField === 'brand');
    if (!hasBrand) {
      issues.push('抖店要求品牌字段必填，请添加品牌列');
    }
  }

  // SKU数量检查
  const specCol = detection.specColumns[0];
  if (specCol && specCol.detectedValues.length > 0) {
    const skuLimits = { taobao: 150, douyin: 100, wechat: 50 };
    if (specCol.detectedValues.length > skuLimits[platform]) {
      issues.push(`${platform}平台SKU上限为${skuLimits[platform]}，当前规格值${specCol.detectedValues.length}个可能超限`);
    }
  }

  return {
    ready: issues.length === 0,
    issues,
  };
}