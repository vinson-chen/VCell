/**
 * 商品数据模型定义
 * 用于电商多平台商品资料管理
 */

/** 支持的电商平台类型 */
export type PlatformType = 'taobao' | 'douyin' | 'wechat';

/** 商品状态 */
export type ProductStatus = 'on_sale' | 'off_sale' | 'draft';

/** 商品基础信息 */
export interface ProductBaseInfo {
  /** 商品标题（淘宝60字、抖店100字、微信60字） */
  title: string;
  /** 商品类目路径（如：女装/连衣裙） */
  categoryPath: string;
  /** 品牌名称（抖店必填） */
  brand?: string;
  /** 商品编码/货号 */
  productCode?: string;
  /** 商品简述（用于SEO） */
  description?: string;
}

/** 商品销售信息 */
export interface ProductSalesInfo {
  /** 市场价/原价 */
  marketPrice: number;
  /** 销售价（实际售价） */
  salePrice: number;
  /** 成本价（可选） */
  costPrice?: number;
  /** 库存总量 */
  totalStock: number;
  /** 商品状态 */
  status: ProductStatus;
}

/** 规格属性定义 */
export interface ProductSpecDefinition {
  /** 规格名（如：颜色、尺码） */
  specName: string;
  /** 规格值列表（如：['红色', '蓝色', '绿色']） */
  specValues: string[];
}

/** SKU变体信息 */
export interface ProductSKU {
  /** SKU唯一标识 */
  skuId: string;
  /** 规格组合（如：{ 颜色: '红色', 尺码: 'M' }） */
  specValues: Record<string, string>;
  /** SKU售价 */
  price: number;
  /** SKU库存 */
  stock: number;
  /** SKU编码 */
  skuCode?: string;
  /** SKU图片URL */
  imageUrl?: string;
}

/** 商品媒体资源 */
export interface ProductMedia {
  /** 主图URL列表（淘宝1-5张、抖店1-6张、微信1-9张） */
  mainImages: string[];
  /** 视频URL */
  videoUrl?: string;
  /** 详情图片列表 */
  detailImages?: string[];
  /** 规格图片映射（规格值 -> 图片URL） */
  specImages?: Record<string, string>;
}

/** 通用商品完整数据结构 */
export interface UniversalProduct {
  /** 商品唯一ID */
  productId: string;
  /** 基础信息 */
  base: ProductBaseInfo;
  /** 销售信息 */
  sales: ProductSalesInfo;
  /** 规格定义（单规格时只有一条） */
  specDefinitions: ProductSpecDefinition[];
  /** SKU列表 */
  skus: ProductSKU[];
  /** 媒体资源 */
  media: ProductMedia;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/** 平台SKU限制配置 */
export const PLATFORM_SKU_LIMITS: Record<PlatformType, number> = {
  taobao: 150,
  douyin: 100,
  wechat: 50,
};

/** 平台标题长度限制 */
export const PLATFORM_TITLE_LENGTH: Record<PlatformType, number> = {
  taobao: 60,
  douyin: 100,
  wechat: 60,
};

/** 平台主图数量限制 */
export const PLATFORM_MAIN_IMAGE_LIMITS: Record<PlatformType, { min: number; max: number }> = {
  taobao: { min: 1, max: 5 },
  douyin: { min: 1, max: 6 },
  wechat: { min: 1, max: 9 },
};

/** 平台品牌必填要求 */
export const PLATFORM_BRAND_REQUIRED: Record<PlatformType, boolean> = {
  taobao: false,
  douyin: true,
  wechat: false,
};