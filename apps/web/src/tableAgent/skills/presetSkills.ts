/**
 * 预设技能
 */

import type { SavedSkill } from './types';

/** 预设技能列表 */
export const PRESET_SKILLS: SavedSkill[] = [
  {
    id: 'preset-quick-sum',
    name: '快速求和',
    description: '对选中区域或指定列快速求和',
    definition: {
      steps: [
        {
          order: 1,
          action: { type: 'aggregate_selected', aggType: 'sum' },
        },
      ],
      parameters: [],
      requires: [],
    },
    createdAt: Date.now(),
    usageCount: 0,
    source: 'preset',
  },
  {
    id: 'preset-quick-avg',
    name: '快速平均',
    description: '对选中区域或指定列计算平均值',
    definition: {
      steps: [
        {
          order: 1,
          action: { type: 'aggregate_selected', aggType: 'avg' },
        },
      ],
      parameters: [],
      requires: [],
    },
    createdAt: Date.now(),
    usageCount: 0,
    source: 'preset',
  },
  {
    id: 'preset-top-n',
    name: 'Top N 筛选',
    description: '筛选指定列的前 N 个最大值',
    definition: {
      steps: [
        {
          order: 1,
          action: { type: 'sort_body_rows', keys: [{ colIndex: 0, direction: 'desc' }] },
          paramRefs: { 'keys[0].colIndex': 'targetColumn' },
        },
      ],
      parameters: [
        {
          name: 'targetColumn',
          displayName: '目标列',
          type: 'column',
          defaultValue: 0,
          required: true,
        },
        {
          name: 'topN',
          displayName: '前N个',
          type: 'number',
          defaultValue: 10,
          required: true,
        },
      ],
      requires: [],
    },
    createdAt: Date.now(),
    usageCount: 0,
    source: 'preset',
  },
  {
    id: 'preset-clear-filter',
    name: '清除筛选',
    description: '清除当前表格的筛选条件',
    definition: {
      steps: [
        {
          order: 1,
          action: { type: 'clear_row_filter' },
        },
      ],
      parameters: [],
      requires: [],
    },
    createdAt: Date.now(),
    usageCount: 0,
    source: 'preset',
  },
];

/** 获取所有预设技能 */
export function getPresetSkills(): SavedSkill[] {
  return PRESET_SKILLS;
}

/** 初始化预设技能到技能库 */
export function initPresetSkills(): void {
  // 预设技能不需要持久化，每次启动时直接加载
}