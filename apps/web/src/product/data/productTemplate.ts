/**
 * 商品模板数据
 * 用于快速创建标准商品表格
 */

import type { ProductTemplateConfig } from '../types/productActions';

/** 淘宝中文模板 - 中文表头，适合用户直接编辑 */
export const TAOBAO_CHINESE_TEMPLATE: ProductTemplateConfig = {
  name: '淘宝商品模板',
  headers: ['商品标题', '类目', '货号', '原价', '售价', '库存', '主图'],
  columnWidths: [200, 120, 100, 80, 80, 80, 200],
  sampleRows: [
    ['示例连衣裙', '女装/连衣裙', 'ABC001', '199.00', '99.00', '100', 'https://img.alicdn.com/example.jpg'],
  ],
};

/** 基础商品模板 - 最小化字段集 */
export const BASIC_PRODUCT_TEMPLATE: ProductTemplateConfig = {
  name: '基础商品模板',
  headers: ['商品标题', '类目', '货号', '售价', '库存', '主图'],
  columnWidths: [200, 120, 100, 80, 80, 200],
  sampleRows: [
    ['示例商品名称', '女装/连衣裙', 'ABC001', '99.00', '100', 'https://example.com/image.jpg'],
  ],
};

/** 带规格商品模板 - 包含单规格 */
export const SKU_PRODUCT_TEMPLATE: ProductTemplateConfig = {
  name: '带规格商品模板',
  headers: ['商品标题', '类目', '品牌', '货号', '原价', '售价', '库存', '规格名', '规格值', '主图', '状态'],
  columnWidths: [200, 120, 100, 100, 80, 80, 80, 80, 150, 200, 80],
  sampleRows: [
    ['示例连衣裙', '女装/连衣裙', '品牌A', 'ABC001', '199.00', '99.00', '300', '颜色', '红色,蓝色,绿色', 'https://example.com/image.jpg', '草稿'],
    ['示例T恤', '男装/T恤', '品牌B', 'DEF002', '89.00', '59.00', '200', '尺码', 'S,M,L,XL', 'https://example.com/image.jpg', '草稿'],
  ],
};

/** 淘宝专用模板 - 淘宝字段命名 */
export const TAOBAO_PRODUCT_TEMPLATE: ProductTemplateConfig = {
  name: '淘宝商品模板',
  headers: ['goods_name', 'cate_id', 'outer_id', 'reserve_price', 'price', 'num', 'pic_url'],
  columnWidths: [200, 120, 100, 80, 80, 80, 200],
  sampleRows: [
    ['淘宝商品名称', '类目ID', '外部编码', '199.00', '99.00', '100', '主图URL'],
  ],
};

/** 抖店专用模板 - 抖店字段命名 + 品牌必填 */
export const DOUYIN_PRODUCT_TEMPLATE: ProductTemplateConfig = {
  name: '抖店商品模板',
  headers: ['product_name', 'category_id', 'brand_id', 'out_product_id', 'market_price', 'price', 'stock_num', 'img_url'],
  columnWidths: [200, 120, 100, 100, 80, 80, 80, 200],
  sampleRows: [
    ['抖店商品名称', '类目ID', '品牌ID（必填）', '外部编码', '199.00', '99.00', '100', '主图URL'],
  ],
};

/** 微信小店专用模板 */
export const WECHAT_PRODUCT_TEMPLATE: ProductTemplateConfig = {
  name: '微信小店商品模板',
  headers: ['title', 'cats', 'brand_id', 'out_product_id', 'original_price', 'sale_price', 'stock', 'head_img'],
  columnWidths: [200, 120, 100, 100, 80, 80, 80, 200],
  sampleRows: [
    ['微信小店商品', '类目数组', '品牌ID', '外部编码', '199.00', '99.00', '100', '主图URL'],
  ],
};

/** 所有可用模板列表 */
export const PRODUCT_TEMPLATES: Array<ProductTemplateConfig & { id: string }> = [
  { id: 'basic', ...BASIC_PRODUCT_TEMPLATE },
  { id: 'sku', ...SKU_PRODUCT_TEMPLATE },
  { id: 'taobao', ...TAOBAO_PRODUCT_TEMPLATE },
  { id: 'taobao_chinese', ...TAOBAO_CHINESE_TEMPLATE },
  { id: 'douyin', ...DOUYIN_PRODUCT_TEMPLATE },
  { id: 'wechat', ...WECHAT_PRODUCT_TEMPLATE },
];

/**
 * 根据模板ID获取模板配置
 */
export function getTemplateById(templateId: string): ProductTemplateConfig | null {
  const template = PRODUCT_TEMPLATES.find(t => t.id === templateId);
  return template ?? null;
}

/**
 * 根据模板生成表格初始数据
 * 用于创建新表格时的数据填充
 */
export function generateTableDataFromTemplate(
  template: ProductTemplateConfig
): {
  rowCount: number;
  colCount: number;
  valueByCell: Record<string, string>;
} {
  const colCount = template.headers.length;
  const rowCount = template.sampleRows ? template.sampleRows.length + 1 : 1; // +1 for header

  const valueByCell: Record<string, string> = {};

  // 填充表头
  for (let col = 0; col < colCount; col++) {
    valueByCell[`header-${col}`] = template.headers[col];
  }

  // 填充示例数据
  if (template.sampleRows) {
    for (let row = 0; row < template.sampleRows.length; row++) {
      const sampleRow = template.sampleRows[row];
      for (let col = 0; col < colCount; col++) {
        valueByCell[`${row}-${col}`] = sampleRow[col] ?? '';
      }
    }
  }

  return { rowCount, colCount, valueByCell };
}

/**
 * 获取模板预览表格
 * 用于模板选择界面展示
 */
export function getTemplatePreview(template: ProductTemplateConfig): string[][] {
  const preview: string[][] = [];

  // 表头行
  preview.push(template.headers);

  // 示例数据行
  if (template.sampleRows) {
    preview.push(...template.sampleRows);
  }

  return preview;
}