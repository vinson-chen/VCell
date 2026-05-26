/**
 * 商品Agent专属动作类型
 * 扩展现有TableAgentAction，新增商品管理能力
 */

import type { PlatformType, ProductStatus } from './productModel';
import type { TableAgentAction } from '../../tableAgent/tableAgentTypes';

/** 商品字段识别关键词映射 */
export const PRODUCT_FIELD_KEYWORDS: Record<string, string[]> = {
  title: ['标题', '商品名', '名称', 'title', '商品标题', 'goods_name', 'product_name', '品名'],
  categoryPath: ['类目', '分类', 'category', 'cate', '品类'],
  brand: ['品牌', 'brand', '牌子'],
  productCode: ['货号', '编码', '编号', 'outer_id', 'product_code', 'sku_id'],
  marketPrice: ['原价', '市场价', '定价', 'reserve_price', 'original_price'],
  salePrice: ['价格', '售价', '单价', 'price', '卖价', '销售价', '现价'],
  costPrice: ['成本', '成本价', 'cost'],
  totalStock: ['库存', '数量', 'stock', '库存量', '总库存', 'num'],
  specName: ['颜色', '尺码', '尺寸', '规格', '型号', '款式', 'variant'],
  mainImage: ['图片', '主图', '封面', 'pic', 'img', 'image', '照片'],
  status: ['状态', '上架', '下架', 'status'],
  description: ['描述', '简介', '详情', 'desc', 'description'],
};

/** 商品Agent专属动作（扩展TableAgentAction） */
export type ProductAgentAction =
  // 继承所有表格基础操作
  | TableAgentAction
  // ===== 商品识别类 =====
  | {
      type: 'detect_product_columns';
      /** 检测到的商品字段映射 (colIndex -> fieldName) */
      detectedMapping: Record<number, string>;
      /** 规格列索引 */
      specColIndices: number[];
      /** 检测置信度 */
      confidence: number;
    }
  | {
      type: 'suggest_column_headers';
      /** 建议的表头命名 */
      suggestions: Array<{ colIndex: number; suggestedHeader: string; reason: string }>;
    }
  // ===== SKU处理类 =====
  | {
      type: 'expand_sku_rows';
      /** 规格列索引 */
      specColIndex: number;
      /** 规格值分隔符（默认逗号） */
      delimiter?: string;
      /** 价格列索引（可选，用于分配） */
      priceColIndex?: number;
      /** 库存列索引（可选，用于分配） */
      stockColIndex?: number;
    }
  | {
      type: 'merge_sku_rows';
      /** 规格列索引 */
      specColIndex: number;
      /** 合并时使用的分隔符 */
      delimiter?: string;
    }
  | {
      type: 'validate_sku_count';
      /** 目标平台 */
      platform: PlatformType;
      /** 当前SKU数量 */
      skuCount: number;
    }
  // ===== 平台导出类 =====
  | {
      type: 'export_to_platform';
      /** 目标平台 */
      platform: PlatformType;
      /** 导出格式 */
      format: 'csv' | 'json';
      /** 是否包含校验提示 */
      includeValidation?: boolean;
    }
  | {
      type: 'validate_for_platform';
      /** 目标平台 */
      platform: PlatformType;
      /** 校验级别 */
      level: 'strict' | 'loose';
    }
  // ===== 商品数据校验类 =====
  | {
      type: 'validate_product_fields';
      /** 校验规则 */
      rules: ProductValidationRule[];
    }
  | {
      type: 'fill_missing_fields';
      /** 缺失字段填充 */
      fills: Array<{ colIndex: number; value: string }>;
    }
  | {
      type: 'set_product_status';
      /** 状态列索引 */
      statusColIndex: number;
      /** 目标状态 */
      status: ProductStatus;
    }
  // ===== 商品模板类 =====
  | {
      type: 'create_product_template';
      /** 模板类型 */
      templateType: 'basic' | 'with_sku' | 'full';
      /** 目标平台（可选） */
      platform?: PlatformType;
    };

/** 商品校验规则 */
export interface ProductValidationRule {
  /** 字段路径 */
  fieldPath: string;
  /** 校验类型 */
  checkType: 'required' | 'maxLength' | 'minValue' | 'maxValue' | 'pattern' | 'urlFormat' | 'positiveNumber';
  /** 校验参数 */
  params?: Record<string, unknown>;
  /** 错误提示文案 */
  errorMessage: string;
}

/** 商品Agent执行结果 */
export interface ProductAgentResult {
  reply: string;
  actions: ProductAgentAction[];
  /** 商品检测结果（可选） */
  detection?: {
    isProductTable: boolean;
    confidence: number;
    detectedFields: Record<number, string>;
  };
}

/** 商品模板配置 */
export interface ProductTemplateConfig {
  /** 模板名称 */
  name: string;
  /** 列头列表 */
  headers: string[];
  /** 默认列宽 */
  columnWidths?: number[];
  /** 示例数据行 */
  sampleRows?: string[][];
}

/** 基础商品模板 */
export const BASIC_PRODUCT_TEMPLATE: ProductTemplateConfig = {
  name: '基础商品模板',
  headers: ['商品标题', '类目', '品牌', '货号', '原价', '售价', '库存', '主图', '状态'],
  columnWidths: [200, 120, 100, 100, 80, 80, 80, 200, 80],
  sampleRows: [
    ['示例商品', '女装/连衣裙', '示例品牌', 'ABC001', '199', '99', '100', 'https://example.com/image.jpg', '草稿'],
  ],
};

/** 带规格的商品模板 */
export const SKU_PRODUCT_TEMPLATE: ProductTemplateConfig = {
  name: '带规格商品模板',
  headers: ['商品标题', '类目', '品牌', '货号', '原价', '售价', '库存', '规格名', '规格值', '主图', '状态'],
  columnWidths: [200, 120, 100, 100, 80, 80, 80, 80, 150, 200, 80],
  sampleRows: [
    ['示例商品', '女装/连衣裙', '示例品牌', 'ABC001', '199', '99', '300', '颜色', '红色,蓝色,绿色', 'https://example.com/image.jpg', '草稿'],
  ],
};

/** 获取商品模板 */
export function getProductTemplate(templateType: 'basic' | 'with_sku' | 'full'): ProductTemplateConfig {
  switch (templateType) {
    case 'basic':
      return BASIC_PRODUCT_TEMPLATE;
    case 'with_sku':
      return SKU_PRODUCT_TEMPLATE;
    case 'full':
      return SKU_PRODUCT_TEMPLATE; // full暂时与with_sku相同
  }
}