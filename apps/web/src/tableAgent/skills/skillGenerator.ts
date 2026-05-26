/**
 * 技能生成器
 * 从操作历史生成可复用技能
 */

import type { SavedSkill, SkillParameter, SkillDefinition, SkillStep } from './types';
import type { TableAgentAction } from '../tableAgentTypes';
import { generateSkillId } from './skillLibrary';

/** 聚合类型中文映射 */
const AGG_TYPE_NAMES: Record<string, string> = {
  sum: '总和',
  avg: '平均值',
  max: '最大值',
  min: '最小值',
  count: '数量',
};

/** 从操作历史生成技能 */
export function generateSkillFromActions(
  actions: TableAgentAction[],
  options: {
    name?: string;
    description?: string;
    columnNames: string[];
    colCount: number;
  }
): SavedSkill | null {
  if (actions.length === 0) return null;

  // 分析可参数化的部分
  const parameters = analyzeParameterizableParts(actions, options.columnNames, options.colCount);

  // 构建步骤
  const steps: SkillStep[] = actions.map((action, index) => ({
    order: index + 1,
    action,
    // 标记需要参数化的字段
    paramRefs: findParamRefs(action, parameters),
  }));

  // 生成技能名称
  const name = options.name || generateSkillName(actions);

  // 生成技能描述
  const description = options.description || generateSkillDescription(actions);

  return {
    id: generateSkillId(),
    name,
    description,
    definition: {
      steps,
      parameters,
      requires: [],
    },
    createdAt: Date.now(),
    usageCount: 0,
    source: 'user',
  };
}

/** 分析可参数化的部分 */
function analyzeParameterizableParts(
  actions: TableAgentAction[],
  columnNames: string[],
  colCount: number
): SkillParameter[] {
  const params: SkillParameter[] = [];
  const seen = new Set<string>();

  for (const action of actions) {
    const actionParams = extractActionParams(action, columnNames, colCount);
    for (const p of actionParams) {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        params.push(p);
      }
    }
  }

  return params;
}

/** 从单个动作提取可参数化的部分 */
function extractActionParams(
  action: TableAgentAction,
  columnNames: string[],
  colCount: number
): SkillParameter[] {
  const params: SkillParameter[] = [];

  // 篩选条件值
  if (action.type === 'keep_rows_by_column_condition' || action.type === 'delete_rows_by_condition') {
    if (action.value !== undefined) {
      params.push({
        name: 'filterValue',
        displayName: '筛选值',
        type: 'string',
        defaultValue: action.value,
        required: true,
      });
    }
    if (action.colIndex !== undefined && colCount > 1) {
      params.push({
        name: 'filterColumn',
        displayName: '筛选列',
        type: 'column',
        defaultValue: columnNames[action.colIndex] || `第${action.colIndex + 1}列`,
        options: columnNames,
        required: true,
      });
    }
  }

  // 排序列
  if (action.type === 'sort_body_rows') {
    if (action.keys && action.keys.length > 0) {
      params.push({
        name: 'sortColumn',
        displayName: '排序列',
        type: 'column',
        defaultValue: columnNames[action.keys[0].colIndex] || `第${action.keys[0].colIndex + 1}列`,
        options: columnNames,
        required: true,
      });
    }
  }

  // 聚合列和类型
  if (action.type === 'aggregate_column') {
    if (colCount > 1) {
      params.push({
        name: 'aggColumn',
        displayName: '聚合列',
        type: 'column',
        defaultValue: columnNames[action.colIndex] || `第${action.colIndex + 1}列`,
        options: columnNames,
        required: true,
      });
    }
    params.push({
      name: 'aggType',
      displayName: '聚合类型',
      type: 'aggType',
      defaultValue: AGG_TYPE_NAMES[action.aggType] || action.aggType,
      options: ['总和', '平均值', '最大值', '最小值', '数量'],
      required: true,
    });
  }

  // 数值变换
  if (action.type === 'column_numeric_transform') {
    params.push({
      name: 'transformValue',
      displayName: '变换值',
      type: 'number',
      defaultValue: action.value,
      required: true,
    });
  }

  return params;
}

/** 找出动作中需要参数引用的字段 */
function findParamRefs(
  action: TableAgentAction,
  parameters: SkillParameter[]
): Record<string, string> | undefined {
  const refs: Record<string, string> = {};

  for (const param of parameters) {
    // 根据参数名匹配动作字段
    if (param.name === 'filterValue') {
      if ('value' in action && action.value !== undefined) {
        refs['value'] = 'filterValue';
      }
    }
    if (param.name === 'filterColumn') {
      if ('colIndex' in action) {
        refs['colIndex'] = 'filterColumn';
      }
    }
    if (param.name === 'sortColumn') {
      if ('keys' in action && action.keys && action.keys.length > 0) {
        refs['keys[0].colIndex'] = 'sortColumn';
      }
    }
    if (param.name === 'aggColumn') {
      if ('colIndex' in action) {
        refs['colIndex'] = 'aggColumn';
      }
    }
    if (param.name === 'aggType') {
      if ('aggType' in action) {
        refs['aggType'] = 'aggType';
      }
    }
    if (param.name === 'transformValue') {
      if ('value' in action) {
        refs['value'] = 'transformValue';
      }
    }
  }

  return Object.keys(refs).length > 0 ? refs : undefined;
}

/** 生成技能名称 */
function generateSkillName(actions: TableAgentAction[]): string {
  const types = actions.map(a => a.type);
  const mainType = types[0];

  const nameMap: Record<string, string> = {
    'aggregate_column': '列聚合',
    'aggregate_selected': '选中聚合',
    'sort_body_rows': '排序',
    'keep_rows_by_column_condition': '筛选保留',
    'delete_rows_by_condition': '筛选删除',
    'clear_row_filter': '清除筛选',
  };

  const baseName = nameMap[mainType] || '自定义操作';

  return `${baseName}${Date.now().toString().slice(-4)}`;
}

/** 生成技能描述 */
function generateSkillDescription(actions: TableAgentAction[]): string {
  const parts: string[] = [];

  for (const action of actions) {
    const desc = describeAction(action);
    if (desc) parts.push(desc);
  }

  return parts.join('，') || '自定义技能';
}

/** 描述单个动作 */
function describeAction(action: TableAgentAction): string {
  switch (action.type) {
    case 'aggregate_column':
      return `聚合计算（${AGG_TYPE_NAMES[action.aggType] || action.aggType}）`;
    case 'aggregate_selected':
      return `选中区域聚合`;
    case 'sort_body_rows':
      return '排序';
    case 'keep_rows_by_column_condition':
      return '筛选保留';
    case 'delete_rows_by_condition':
      return '筛选删除';
    case 'clear_row_filter':
      return '清除筛选';
    case 'delete_empty_rows':
      return '删除空行';
    case 'insert_rows':
      return `新增 ${action.count} 行`;
    case 'insert_columns':
      return `新增 ${action.count} 列`;
    default:
      return '';
  }
}