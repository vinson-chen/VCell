import type { TableAgentTableFlags } from './tableAgentTypes';

export type ChatTurn = Readonly<{ role: 'user' | 'assistant'; content: string }>;

export type TableSnapshot = Readonly<{
  /** 当前被选中的表格标识，仅用于上下文说明 */
  tableKey?: string;
  /** 当前被选中的表格名称，仅用于上下文说明 */
  tableLabel?: string;
  valueByCell: Record<string, string>;
  rowCount: number;
  colCount: number;
  /** 与 vc-biz 一致：首列是否显示表体行序号（1 起，与 body rowIndex+1 一致） */
  enableShowRowIndex?: boolean;
  /** 当前表壳开关，便于模型用 set_table_flags 做增量修改 */
  tableFlags?: TableAgentTableFlags;
}>;

export type TableAgentApiOk = Readonly<{
  model: string;
  result: unknown;
  /** 后端实际采用的 skill */
  skillUsed?: string;
  /** 仅 fast_commands 等规范化技能可选返回，取值 [0,1] */
  confidence?: number;
  /** 后端处理耗时（ms） */
  durationMs?: number;
  /** Ollama 对 R1 等模型在 think 开启时的推理轨迹 */
  thinking?: string;
}>;

export type TableAgentApiErr = Readonly<{
  error: string;
  raw?: string;
}>;

export type TableAgentSkillMode =
  | 'auto'
  | 'fast_commands'
  | 'structure'
  | 'batch_values'
  | 'single_edit'
  | 'general';

function apiBase(): string {
  const b = import.meta.env.VITE_API_BASE?.trim();
  return b ? b.replace(/\/$/, '') : '';
}

function parseResponseBody(text: string, status: number): TableAgentApiErr | Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      error:
        status === 0 || status >= 502
          ? '未收到有效响应。请确认已在项目根运行 npm run dev（会同时启动 vcell-api），且本机 Ollama 已运行（可安装 Ollama 桌面端常驻后台）。'
          : `服务返回空内容（HTTP ${status}）。`,
    };
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return {
      error: `服务返回非 JSON（HTTP ${status}）。多为 BFF 未启动或代理失败；请在项目根执行 npm run dev。`,
      raw: trimmed.slice(0, 800),
    };
  }
}

export async function fetchTableAgent(
  messages: ChatTurn[],
  table: TableSnapshot,
  model?: string,
  skill?: TableAgentSkillMode
): Promise<TableAgentApiOk | TableAgentApiErr> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}/api/chat/table-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        table,
        ...(model ? { model } : {}),
        ...(skill ? { skill } : {}),
      }),
    });
  } catch (e) {
    return {
      error: `网络错误：${e instanceof Error ? e.message : String(e)}。请检查 vcell-api 是否已启动、浏览器是否可访问本页同源 /api。`,
    };
  }

  const text = await res.text();
  const parsed = parseResponseBody(text, res.status);
  if ('error' in parsed && typeof parsed.error === 'string') {
    return {
      error: parsed.error,
      raw: typeof parsed.raw === 'string' ? parsed.raw : undefined,
    };
  }
  const data = parsed as Record<string, unknown>;

  if (!res.ok) {
    return {
      error: typeof data.error === 'string' ? data.error : `请求失败（HTTP ${res.status}）`,
      raw: typeof data.raw === 'string' ? data.raw : undefined,
    };
  }

  const thinking =
    typeof data.thinking === 'string' && data.thinking.trim() ? data.thinking.trim() : undefined;
  const confidence =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.max(0, Math.min(1, data.confidence))
      : undefined;
  const durationMs =
    typeof data.durationMs === 'number' && Number.isFinite(data.durationMs)
      ? Math.max(0, Math.trunc(data.durationMs))
      : undefined;
  const skillUsed = typeof data.skillUsed === 'string' && data.skillUsed ? data.skillUsed : undefined;

  return {
    model: typeof data.model === 'string' ? data.model : 'unknown',
    result: data.result,
    ...(skillUsed ? { skillUsed } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(thinking ? { thinking } : {}),
  };
}
