/**
 * 技能执行器
 */

import type { SavedSkill, SkillExecutionParams, SkillExecutionResult, SkillRequirement } from './types';
import type { TableAgentAction } from '../tableAgentTypes';
import { incrementSkillUsage } from './skillLibrary';

/** 检查技能前置条件 */
export function checkSkillRequirements(
  skill: SavedSkill,
  context: {
    hasSelection: boolean;
    rowCount: number;
    colCount: number;
    columnNames: string[];
  }
): { passed: boolean; message?: string } {
  if (!skill.definition.requires || skill.definition.requires.length === 0) {
    return { passed: true };
  }

  for (const req of skill.definition.requires) {
    const result = checkSingleRequirement(req, context);
    if (!result.passed) {
      return result;
    }
  }

  return { passed: true };
}

function checkSingleRequirement(
  req: SkillRequirement,
  context: {
    hasSelection: boolean;
    rowCount: number;
    colCount: number;
    columnNames: string[];
  }
): { passed: boolean; message?: string } {
  switch (req.type) {
    case 'hasSelection':
      if (!context.hasSelection) {
        return { passed: false, message: '请先选择要操作的区域' };
      }
      break;
    case 'hasData':
      if (context.rowCount === 0) {
        return { passed: false, message: '表格中没有数据' };
      }
      break;
    case 'minRows':
      if (context.rowCount < (req.detail?.min || 1)) {
        return { passed: false, message: `至少需要 ${req.detail?.min || 1} 行数据` };
      }
      break;
    case 'columnExists':
      if (!context.columnNames.includes(req.detail?.name)) {
        return { passed: false, message: `列「${req.detail?.name}」不存在` };
      }
      break;
    case 'columnType':
      // 暂不实现类型检查
      break;
  }
  return { passed: true };
}

/** 执行技能 */
export function executeSkill(
  skill: SavedSkill,
  params: Record<string, any>,
  context: {
    colCount: number;
    columnNames: string[];
  }
): SkillExecutionResult {
  // 更新使用次数
  incrementSkillUsage(skill.id);

  // 解析参数并生成动作
  const actions: TableAgentAction[] = [];

  for (const step of skill.definition.steps) {
    const action = resolveStepAction(step, params, context);
    if (action) {
      actions.push(action);
    }
  }

  if (actions.length === 0) {
    return {
      success: false,
      actions: [],
      reply: '',
      error: '技能执行失败：无有效动作',
    };
  }

  return {
    success: true,
    actions,
    reply: `已执行技能「${skill.name}」`,
  };
}

/** 解析步骤动作（将参数引用替换为实际值） */
function resolveStepAction(
  step: any,
  params: Record<string, any>,
  context: { colCount: number; columnNames: string[] }
): TableAgentAction | null {
  // 复制动作
  const action = JSON.parse(JSON.stringify(step.action)) as TableAgentAction;

  // 如果有参数引用，替换为实际值
  if (step.paramRefs) {
    for (const [path, paramName] of Object.entries(step.paramRefs)) {
      const value = params[paramName];
      if (value !== undefined) {
        // 解析路径并设置值
        setNestedValue(action, path, value);
      }
    }
  }

  // 验证动作参数有效性
  if (!validateAction(action, context)) {
    return null;
  }

  return action;
}

/** 设置嵌套属性值 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(/[.\[\]]/).filter(k => k !== '');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

/** 验证动作参数 */
function validateAction(
  action: TableAgentAction,
  context: { colCount: number; columnNames: string[] }
): boolean {
  // 检查列索引越界
  const actionWithColIndex = action as any;
  if ('colIndex' in actionWithColIndex) {
    if (actionWithColIndex.colIndex < 0 || actionWithColIndex.colIndex >= context.colCount) {
      return false;
    }
  }
  return true;
}