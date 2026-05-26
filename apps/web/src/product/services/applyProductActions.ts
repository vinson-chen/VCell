/**
 * 商品Action执行器
 * 处理商品专属Action（SKU展开、模板创建等）
 */

import type { ProductAgentAction } from '../types/productActions';
import { parseSpecValues } from './skuProcessor';
import { detectProductFields } from './productDetector';
import { getTemplateById, generateTableDataFromTemplate } from '../data/productTemplate';

/** Action执行结果 */
export interface ProductActionResult {
  applied: number;
  skipped: number;
  notes: string[];
  /** 需要UI处理的特殊结果 */
  uiAction?: {
    type: 'show_export_panel' | 'show_validation_report' | 'download_file';
    data?: unknown;
  };
}

/** 表格操作回调 */
export interface TableOperations {
  getRowCount: () => number;
  getColCount: () => number;
  getValueByCell: (key: string) => string | undefined;
  setValue: (key: string, value: string) => void;
  insertRowsAt: (index: number, count: number) => void;
  deleteBodyRow: (rowIndex: number) => void;
  getSelectedRowIndices: () => number[];
}

/** 表格数据结构 */
interface TableDataSnapshot {
  rowCount: number;
  colCount: number;
  valueByCell: Record<string, string>;
  headers: string[];
}

/**
 * 构建表格快照数据
 */
function buildTableSnapshot(ops: TableOperations): TableDataSnapshot {
  const valueByCell: Record<string, string> = {};
  const headers: string[] = [];

  for (let c = 0; c < ops.getColCount(); c++) {
    headers.push(ops.getValueByCell(`header-${c}`) ?? '');
  }

  for (let r = 0; r < ops.getRowCount(); r++) {
    for (let c = 0; c < ops.getColCount(); c++) {
      const key = `${r}-${c}`;
      valueByCell[key] = ops.getValueByCell(key) ?? '';
    }
  }

  return { rowCount: ops.getRowCount(), colCount: ops.getColCount(), valueByCell, headers };
}

/**
 * 执行商品Action
 */
export function applyProductActions(
  actions: ProductAgentAction[],
  _model: unknown, // 保留参数但标记未使用
  ops: TableOperations
): ProductActionResult {
  let applied = 0;
  let skipped = 0;
  const notes: string[] = [];
  let uiAction: ProductActionResult['uiAction'] | undefined;

  for (const action of actions) {
    // 处理商品专属Action
    switch (action.type) {
      case 'detect_product_columns': {
        // 检测结果已在L0规则中生成，此处仅记录
        notes.push(`检测到商品字段：${Object.entries(action.detectedMapping)
          .map(([col, field]) => `第${Number(col) + 1}列→${field}`)
          .join('、')}`);
        applied += 1;
        break;
      }
      case 'expand_sku_rows': {
        const { specColIndex, delimiter } = action;

        // 检查规格列是否存在
        if (specColIndex < 0 || specColIndex >= ops.getColCount()) {
          skipped += 1;
          notes.push('expand_sku_rows：规格列索引越界');
          break;
        }

        // 获取选中行或处理所有行
        const selectedRows = ops.getSelectedRowIndices();
        const rowsToProcess = selectedRows.length > 0 ? selectedRows :
          Array.from({ length: ops.getRowCount() }, (_, i) => i);

        let totalExpanded = 0;

        // 从后向前处理，避免索引错乱
        const sortedRows = [...rowsToProcess].sort((a, b) => b - a);

        for (const rowIndex of sortedRows) {
          const specValue = ops.getValueByCell(`${rowIndex}-${specColIndex}`) ?? '';
          const specValues = parseSpecValues(specValue, delimiter ?? ',');

          if (specValues.length <= 1) {
            // 单值或空值，无需展开
            continue;
          }

          // 展开SKU：在当前行后插入新行，并填充规格值
          ops.insertRowsAt(rowIndex + 1, specValues.length - 1);

          // 原行保留第一个规格值
          ops.setValue(`${rowIndex}-${specColIndex}`, specValues[0]);

          // 新行填充后续规格值
          for (let i = 1; i < specValues.length; i++) {
            const newRowIndex = rowIndex + i;
            // 复制原行其他列数据
            for (let c = 0; c < ops.getColCount(); c++) {
              const originalValue = ops.getValueByCell(`${rowIndex}-${c}`) ?? '';
              ops.setValue(`${newRowIndex}-${c}`, originalValue);
            }
            // 设置当前规格值
            ops.setValue(`${newRowIndex}-${specColIndex}`, specValues[i]);
          }

          totalExpanded += specValues.length;
        }

        applied += 1;
        notes.push(`SKU展开完成，共展开${totalExpanded}条SKU`);
        break;
      }
      case 'merge_sku_rows': {
        // 合暂不实现，后续扩展
        skipped += 1;
        notes.push('merge_sku_rows：暂不支持，请手动合并规格值');
        break;
      }
      case 'validate_for_platform': {
        const tableData = buildTableSnapshot(ops);
        const detection = detectProductFields(tableData);

        // 触发校验UI，包含检测结果
        uiAction = {
          type: 'show_validation_report',
          data: { platform: action.platform, level: action.level, detection },
        };

        applied += 1;
        notes.push(`已校验${action.platform}平台格式要求`);
        break;
      }
      case 'create_product_template': {
        const template = getTemplateById(action.templateType === 'basic' ? 'basic' : 'sku');
        if (!template) {
          skipped += 1;
          notes.push('create_product_template：未找到模板');
          break;
        }

        // 生成模板数据
        const templateData = generateTableDataFromTemplate(template);

        // 触发UI处理
        uiAction = {
          type: 'show_export_panel',
          data: { templateType: action.templateType, templateData },
        };

        applied += 1;
        notes.push(`已创建${template.name}`);
        break;
      }
      // 继承的TableAgentAction由主执行器处理
      default:
        skipped += 1;
        notes.push(`未处理的Action类型：${(action as { type: string }).type}`);
    }
  }

  return { applied, skipped, notes, uiAction };
}