/**
 * VCell 商品资料管理模块
 *
 * 提供电商商品数据的智能识别、批量编辑、多平台导出能力。
 *
 * ## 核心能力
 * - 商品字段智能识别（根据表头关键词自动映射）
 * - SKU展开/合并（单规格支持）
 * - 平台格式校验与导出（淘宝、抖店、微信小店）
 * - 商品模板创建
 *
 * ## 使用示例
 * ```ts
 * import { detectProductFields, exportToPlatform } from './product';
 *
 * // 检测商品字段
 * const detection = detectProductFields(tableData);
 *
 * // 导出淘宝CSV
 * const result = await exportToPlatform(tableData, detection, {
 *   platform: 'taobao',
 *   format: 'csv',
 * });
 * ```
 */

// 类型定义
export * from './types';

// 服务
export * from './services';

// 组件
export * from './components';

// L0规则
export { PRODUCT_QUICK_RULES, mergeProductRules } from './productQuickRules';