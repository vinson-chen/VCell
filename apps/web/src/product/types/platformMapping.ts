/**
 * 平台字段映射配置
 * 定义通用商品模型与各平台字段的映射关系
 */

import type { PlatformType } from './productModel';

/** 通用字段名 */
export type UniversalFieldName =
  | 'title'
  | 'categoryPath'
  | 'brand'
  | 'productCode'
  | 'marketPrice'
  | 'salePrice'
  | 'costPrice'
  | 'totalStock'
  | 'status'
  | 'specName'
  | 'specValues'
  | 'skuPrice'
  | 'skuStock'
  | 'skuCode'
  | 'mainImage'
  | 'detailImage'
  | 'videoUrl'
  | 'description';

/** 平台字段映射配置 */
export interface PlatformFieldMapping {
  /** 平台字段名 */
  platformField: string;
  /** 是否必填 */
  required: boolean;
  /** 字段类型 */
  type: 'string' | 'number' | 'array' | 'object';
  /** 格式说明 */
  formatNote?: string;
}

/** 淘宝字段映射 */
export const TAOBAO_FIELD_MAPPING: Record<UniversalFieldName, PlatformFieldMapping> = {
  title: { platformField: 'goods_name', required: true, type: 'string', formatNote: '最长60字符' },
  categoryPath: { platformField: 'cate_id', required: true, type: 'string', formatNote: '淘宝类目ID' },
  brand: { platformField: 'brand_id', required: false, type: 'string', formatNote: '品牌ID' },
  productCode: { platformField: 'outer_id', required: false, type: 'string', formatNote: '外部编码' },
  marketPrice: { platformField: 'reserve_price', required: true, type: 'number', formatNote: '一口价' },
  salePrice: { platformField: 'price', required: true, type: 'number', formatNote: '实际售价' },
  costPrice: { platformField: '', required: false, type: 'number' },
  totalStock: { platformField: 'num', required: true, type: 'number', formatNote: '库存量' },
  status: { platformField: 'approve_status', required: false, type: 'string', formatNote: 'onsale/instock' },
  specName: { platformField: 'prop_name', required: false, type: 'string', formatNote: '规格属性名' },
  specValues: { platformField: 'value_name', required: false, type: 'array', formatNote: '规格值列表' },
  skuPrice: { platformField: 'sku_price', required: false, type: 'number' },
  skuStock: { platformField: 'sku_num', required: false, type: 'number' },
  skuCode: { platformField: 'sku_outer_id', required: false, type: 'string' },
  mainImage: { platformField: 'pic_url', required: true, type: 'string', formatNote: '主图URL' },
  detailImage: { platformField: 'desc_img', required: false, type: 'array' },
  videoUrl: { platformField: 'video_url', required: false, type: 'string' },
  description: { platformField: 'desc', required: false, type: 'string', formatNote: '详情描述' },
};

/** 抖店字段映射 */
export const DOUYIN_FIELD_MAPPING: Record<UniversalFieldName, PlatformFieldMapping> = {
  title: { platformField: 'product_name', required: true, type: 'string', formatNote: '最长100字符' },
  categoryPath: { platformField: 'category_id', required: true, type: 'string', formatNote: '抖店类目ID' },
  brand: { platformField: 'brand_id', required: true, type: 'string', formatNote: '品牌ID（必填！）' },
  productCode: { platformField: 'out_product_id', required: false, type: 'string', formatNote: '外部商品ID' },
  marketPrice: { platformField: 'market_price', required: false, type: 'number', formatNote: '市场价' },
  salePrice: { platformField: 'price', required: true, type: 'number', formatNote: '售价' },
  costPrice: { platformField: '', required: false, type: 'number' },
  totalStock: { platformField: 'stock_num', required: true, type: 'number', formatNote: '库存量' },
  status: { platformField: 'status', required: false, type: 'number', formatNote: '1上架0下架' },
  specName: { platformField: 'spec_name', required: false, type: 'string' },
  specValues: { platformField: 'spec_value', required: false, type: 'array' },
  skuPrice: { platformField: 'sku_price', required: false, type: 'number' },
  skuStock: { platformField: 'sku_stock', required: false, type: 'number' },
  skuCode: { platformField: 'out_sku_id', required: false, type: 'string' },
  mainImage: { platformField: 'img_url', required: true, type: 'string', formatNote: '主图URL' },
  detailImage: { platformField: 'detail_img', required: false, type: 'array', formatNote: '最多20张' },
  videoUrl: { platformField: 'video_id', required: false, type: 'string', formatNote: '视频ID' },
  description: { platformField: 'detail', required: false, type: 'string', formatNote: '商品详情' },
};

/** 微信小店字段映射 */
export const WECHAT_FIELD_MAPPING: Record<UniversalFieldName, PlatformFieldMapping> = {
  title: { platformField: 'title', required: true, type: 'string', formatNote: '最长60字符' },
  categoryPath: { platformField: 'cats', required: true, type: 'array', formatNote: '类目数组' },
  brand: { platformField: 'brand_id', required: false, type: 'string', formatNote: '品牌ID' },
  productCode: { platformField: 'out_product_id', required: false, type: 'string' },
  marketPrice: { platformField: 'original_price', required: false, type: 'number', formatNote: '原价' },
  salePrice: { platformField: 'sale_price', required: true, type: 'number', formatNote: '售价' },
  costPrice: { platformField: '', required: false, type: 'number' },
  totalStock: { platformField: 'stock', required: true, type: 'number', formatNote: '库存量' },
  status: { platformField: 'status', required: false, type: 'number', formatNote: '1上架0下架' },
  specName: { platformField: 'attr_key', required: false, type: 'string', formatNote: '规格属性名' },
  specValues: { platformField: 'attr_val', required: false, type: 'array', formatNote: '规格值列表' },
  skuPrice: { platformField: 'sku_sale_price', required: false, type: 'number' },
  skuStock: { platformField: 'sku_stock', required: false, type: 'number' },
  skuCode: { platformField: 'out_sku_id', required: false, type: 'string' },
  mainImage: { platformField: 'head_img', required: true, type: 'string', formatNote: '主图URL' },
  detailImage: { platformField: 'desc_img', required: false, type: 'array', formatNote: '最多20张' },
  videoUrl: { platformField: 'video_id', required: false, type: 'string' },
  description: { platformField: 'desc_info', required: false, type: 'object', formatNote: '详情对象' },
};

/** 获取平台映射配置 */
export function getPlatformMapping(platform: PlatformType): Record<UniversalFieldName, PlatformFieldMapping> {
  switch (platform) {
    case 'taobao':
      return TAOBAO_FIELD_MAPPING;
    case 'douyin':
      return DOUYIN_FIELD_MAPPING;
    case 'wechat':
      return WECHAT_FIELD_MAPPING;
  }
}

/** 淘宝CSV导出列顺序 */
export const TAOBAO_CSV_COLUMNS = [
  'goods_name',
  'cate_id',
  'brand_id',
  'outer_id',
  'reserve_price',
  'price',
  'num',
  'prop_name',
  'value_name',
  'pic_url',
  'approve_status',
] as const;

/** 抖店CSV导出列顺序 */
export const DOUYIN_CSV_COLUMNS = [
  'product_name',
  'category_id',
  'brand_id',
  'out_product_id',
  'market_price',
  'price',
  'stock_num',
  'spec_name',
  'spec_value',
  'img_url',
  'status',
] as const;

/** 微信小店CSV导出列顺序 */
export const WECHAT_CSV_COLUMNS = [
  'title',
  'cats',
  'brand_id',
  'out_product_id',
  'original_price',
  'sale_price',
  'stock',
  'attr_key',
  'attr_val',
  'head_img',
  'status',
] as const;

/** 获取平台CSV列顺序 */
export function getPlatformCsvColumns(platform: PlatformType): readonly string[] {
  switch (platform) {
    case 'taobao':
      return TAOBAO_CSV_COLUMNS;
    case 'douyin':
      return DOUYIN_CSV_COLUMNS;
    case 'wechat':
      return WECHAT_CSV_COLUMNS;
  }
}