/**
 * 技能库管理
 * 使用 localStorage 持久化
 */

import type { SavedSkill, SkillLibrary } from './types';

const STORAGE_KEY = 'vcell-skills';
const STORAGE_VERSION = 1;

/** 加载技能库 */
export function loadSkillLibrary(): SkillLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { skills: [], version: STORAGE_VERSION };
    }
    const data = JSON.parse(raw) as SkillLibrary;
    // 版本兼容处理
    if (data.version !== STORAGE_VERSION) {
      return { skills: [], version: STORAGE_VERSION };
    }
    return data;
  } catch (e) {
    console.warn('[SkillLibrary] 加载失败', e);
    return { skills: [], version: STORAGE_VERSION };
  }
}

/** 保存技能库 */
export function saveSkillLibrary(library: SkillLibrary): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch (e) {
    console.warn('[SkillLibrary] 保存失败', e);
  }
}

/** 添加技能 */
export function addSkill(skill: SavedSkill): void {
  const library = loadSkillLibrary();
  // 检查重复名称
  const existing = library.skills.find(s => s.name === skill.name);
  if (existing) {
    // 更新已存在的技能
    existing.definition = skill.definition;
    existing.description = skill.description;
    existing.updatedAt = Date.now();
  } else {
    library.skills.push(skill);
  }
  saveSkillLibrary(library);
}

/** 删除技能 */
export function removeSkill(skillId: string): boolean {
  const library = loadSkillLibrary();
  const index = library.skills.findIndex(s => s.id === skillId);
  if (index === -1) return false;
  library.skills.splice(index, 1);
  saveSkillLibrary(library);
  return true;
}

/** 更新技能使用次数 */
export function incrementSkillUsage(skillId: string): void {
  const library = loadSkillLibrary();
  const skill = library.skills.find(s => s.id === skillId);
  if (skill) {
    skill.usageCount += 1;
    skill.lastUsedAt = Date.now();
    saveSkillLibrary(library);
  }
}

/** 获取技能 */
export function getSkill(skillId: string): SavedSkill | null {
  const library = loadSkillLibrary();
  return library.skills.find(s => s.id === skillId) || null;
}

/** 搜索技能 */
export function searchSkills(keyword: string): SavedSkill[] {
  const library = loadSkillLibrary();
  if (!keyword.trim()) return library.skills;
  const kw = keyword.toLowerCase();
  return library.skills.filter(s =>
    s.name.toLowerCase().includes(kw) ||
    s.description.toLowerCase().includes(kw)
  );
}

/** 获取所有技能 */
export function getAllSkills(): SavedSkill[] {
  return loadSkillLibrary().skills;
}

/** 生成唯一ID */
export function generateSkillId(): string {
  return `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}