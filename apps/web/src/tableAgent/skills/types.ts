/**
 * 技能模块类型定义
 */

import type { TableAgentAction } from '../tableAgentTypes';

/** 技能参数类型 */
export type SkillParamType = 'column' | 'number' | 'string' | 'operator' | 'aggType';

/** 技能参数定义 */
export interface SkillParameter {
  name: string;
  displayName: string;
  type: SkillParamType;
  defaultValue: any;
  options?: string[];
  required: boolean;
}

/** 技能步骤 */
export interface SkillStep {
  order: number;
  action: TableAgentAction;
  /** 参数引用（指向 SkillParameter） */
  paramRefs?: Record<string, string>;
}

/** 技能定义 */
export interface SkillDefinition {
  steps: SkillStep[];
  parameters: SkillParameter[];
  /** 执行前需要满足的条件 */
  requires?: SkillRequirement[];
}

/** 执行前条件 */
export interface SkillRequirement {
  type: 'hasSelection' | 'hasData' | 'minRows' | 'columnExists' | 'columnType';
  detail?: any;
}

/** 已保存的技能 */
export interface SavedSkill {
  id: string;
  name: string;
  description: string;
  definition: SkillDefinition;
  createdAt: number;
  updatedAt?: number;
  lastUsedAt?: number;
  usageCount: number;
  /** 来源：preset=预设，user=用户创建 */
  source: 'preset' | 'user';
}

/** 技能库 */
export interface SkillLibrary {
  skills: SavedSkill[];
  version: number;
}

/** 技能执行参数 */
export interface SkillExecutionParams {
  skillId: string;
  /** 用户指定的参数值 */
  params: Record<string, any>;
}

/** 技能执行结果 */
export interface SkillExecutionResult {
  success: boolean;
  actions: TableAgentAction[];
  reply: string;
  error?: string;
}