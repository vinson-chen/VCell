/**
 * 技能模块测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSkillLibrary,
  saveSkillLibrary,
  addSkill,
  removeSkill,
  getAllSkills,
  generateSkillId,
} from './skillLibrary';
import { PRESET_SKILLS } from './presetSkills';
import { executeSkill, checkSkillRequirements } from './skillExecutor';
import { generateSkillFromActions } from './skillGenerator';
import type { SavedSkill, TableAgentAction } from './types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('skillLibrary', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('loadSkillLibrary', () => {
    it('应返回空技能库', () => {
      const library = loadSkillLibrary();
      expect(library.skills).toEqual([]);
      expect(library.version).toBe(1);
    });
  });

  describe('addSkill', () => {
    it('应添加技能到库', () => {
      const skill: SavedSkill = {
        id: generateSkillId(),
        name: '测试技能',
        description: '测试描述',
        definition: { steps: [], parameters: [] },
        createdAt: Date.now(),
        usageCount: 0,
        source: 'user',
      };

      addSkill(skill);
      const skills = getAllSkills();
      expect(skills.length).toBe(1);
      expect(skills[0].name).toBe('测试技能');
    });
  });

  describe('removeSkill', () => {
    it('应删除技能', () => {
      const skill: SavedSkill = {
        id: generateSkillId(),
        name: '待删除技能',
        description: '测试',
        definition: { steps: [], parameters: [] },
        createdAt: Date.now(),
        usageCount: 0,
        source: 'user',
      };

      addSkill(skill);
      expect(getAllSkills().length).toBe(1);

      removeSkill(skill.id);
      expect(getAllSkills().length).toBe(0);
    });

    it('删除不存在技能应返回false', () => {
      const result = removeSkill('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('generateSkillId', () => {
    it('应生成唯一ID', () => {
      const id1 = generateSkillId();
      const id2 = generateSkillId();
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('skill-')).toBe(true);
    });
  });
});

describe('presetSkills', () => {
  it('预设技能应包含快速求和', () => {
    const skills = PRESET_SKILLS;
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some(s => s.name === '快速求和')).toBe(true);
  });

  it('预设技能来源应为preset', () => {
    const skills = PRESET_SKILLS;
    for (const skill of skills) {
      expect(skill.source).toBe('preset');
    }
  });
});

describe('skillExecutor', () => {
  describe('checkSkillRequirements', () => {
    const skill: SavedSkill = {
      id: 'test-skill',
      name: '需要选区',
      description: '测试',
      definition: {
        steps: [],
        parameters: [],
        requires: [{ type: 'hasSelection' }],
      },
      createdAt: Date.now(),
      usageCount: 0,
      source: 'preset',
    };

    it('无选区时应失败', () => {
      const result = checkSkillRequirements(skill, {
        hasSelection: false,
        rowCount: 10,
        colCount: 5,
        columnNames: ['A', 'B', 'C'],
      });
      expect(result.passed).toBe(false);
      expect(result.message).toBe('请先选择要操作的区域');
    });

    it('有选区时应通过', () => {
      const result = checkSkillRequirements(skill, {
        hasSelection: true,
        rowCount: 10,
        colCount: 5,
        columnNames: ['A', 'B', 'C'],
      });
      expect(result.passed).toBe(true);
    });
  });
});

describe('skillGenerator', () => {
  it('应从动作生成技能', () => {
    const actions: TableAgentAction[] = [
      { type: 'aggregate_column', colIndex: 0, aggType: 'sum' },
    ];

    const skill = generateSkillFromActions(actions, {
      columnNames: ['销售额', '地区'],
      colCount: 2,
    });

    expect(skill).not.toBe(null);
    if (skill) {
      expect(skill.name).toContain('聚合');
      expect(skill.definition.steps.length).toBe(1);
    }
  });

  it('空动作应返回null', () => {
    const skill = generateSkillFromActions([], {
      columnNames: ['A'],
      colCount: 1,
    });
    expect(skill).toBe(null);
  });
});