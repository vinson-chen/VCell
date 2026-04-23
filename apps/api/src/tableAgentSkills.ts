/**
 * 表对话「技能」：用轻量规则聚焦推理范围（非 Cursor Agent Skill）。
 * auto 时根据用户最后一轮话语文本选择；也可由请求体 skill 强制指定。
 */
export type TableAgentSkill =
  | 'fast_commands'
  | 'structure'
  | 'batch_values'
  | 'single_edit'
  | 'general';

export type TableAgentSkillMode = 'auto' | TableAgentSkill;

export function detectTableAgentSkill(userText: string): TableAgentSkill {
  const t = userText.trim();
  if (!t) return 'general';

  const structureRe =
    /删(除)?\s*[行列]|去掉\s*[行列]|删\s*\d|删第|删去|删掉|删光|全删|都删|加\s*(一)?\s*[行列]|插(入)?\s*[行列]|增(加)?\s*[行列]|末尾.*(加|增|插).*行|新增\s*[行列]|去掉这行|去掉该行|删行|删列|增行|增列|插行|插列/;
  if (structureRe.test(t)) return 'structure';

  /** 避免单独「全部/所有」与删行语义冲突（如「全部删掉」走 structure） */
  const batchRe =
    /统一|每一|整列|每行|各行|打折|(?:\d+(?:\.\d+)?|[一二三四五六七八九十两]+)\s*折|批量|都改成|全都改|一并|一起改|通通|全改|列.*都|全部.*(?:改|换|设为|变成|打)|所有.*(?:改|换|打)/;
  if (batchRe.test(t)) return 'batch_values';

  const singleRe = /第[0-9一二三四五六七八九十两]+行|只改|仅改|单改|这一行|那一行|把这个|该格|本行|本格/;
  if (singleRe.test(t)) return 'single_edit';

  return 'general';
}

export function resolveTableAgentSkill(
  mode: TableAgentSkillMode | undefined,
  lastUserText: string
): TableAgentSkill {
  if (mode && mode !== 'auto') return mode;
  return detectTableAgentSkill(lastUserText);
}

/** 插在 system 前部，压缩模型在该轮的任务空间 */
export function getSkillFocusBlock(skill: TableAgentSkill): string {
  switch (skill) {
    case 'fast_commands':
      return `【技能：快速命令容错】
- 本轮目标是将用户口语/词序颠倒/轻微错别字，归一为少量确定性动作。
- 仅允许使用：insert_rows、insert_columns、delete_body_row、delete_column、column_numeric_transform、set_table_flags、set_column_hidden、clear_hidden_columns。
- 不要使用 set_cells；除非用户明确是改单元格内容，否则不要生成其它动作。
- 若语义仍不确定，请返回 actions: []，并在 reply 中简短说明无法确定参数。
- 结果 JSON 增加 confidence（0~1 浮点数）：越确定越接近 1。`;
    case 'structure':
      return `【技能：结构调整】本轮以增删行列为主。
- 优先使用 insert_rows、insert_columns、delete_body_row、delete_column。
- 除非用户明确要求改文案，否则不要用 set_cells；不要用 set_cells 代替删行/删列。
- 若连续删除多行或多列，注意删除后索引变化；可按从大到小行号/列号顺序列出 delete 动作。`;
    case 'batch_values':
      return `【技能：批量改值】本轮以改单元格内容为主。
- **整列数字运算（打折、统一加减价）优先用 column_numeric_transform**（multiply + value=折扣系数，如九折用 0.9），不要用大量 set_cells 手算。
- 非数字文案或逐格不同内容时用 set_cells；禁止无故 insert/delete 行列。
- 「统一、全部、每一行、整列、所有商品」若必须逐格改字：必须覆盖表体行 0 到 bodyRowCount-1，一行不漏。
- 表体第 1 行对应键 0-*，不要用 1-* 表示第 1 行。`;
    case 'single_edit':
      return `【技能：单点/局部改值】
- 尽量只用少量、精确的 set_cells；键名与行号严格按坐标约定（第 n 行表体 → 行索引 n-1）。
- 仅在用户明确要求增删行列时才用 insert/delete。`;
    default:
      return `【技能：通用】
- 可同时使用 set_cells 与行列增删；优先满足用户表述。
- 若用户要求整列或统一修改，须覆盖所有表体行 0…bodyRowCount-1。`;
  }
}
