import type { FastifyInstance } from 'fastify';
import { buildTableAgentSystemPrompt } from './tableAgentPrompt.js';
import {
  type TableAgentSkill,
  type TableAgentSkillMode,
  resolveTableAgentSkill,
} from './tableAgentSkills.js';

export type ChatTableAgentMessage = Readonly<{
  role: 'user' | 'assistant';
  content: string;
}>;

export type ChatTableAgentBody = Readonly<{
  messages: ChatTableAgentMessage[];
  table: Readonly<{
    /** 当前被选中的表格标识，仅用于提示词上下文 */
    tableKey?: string;
    /** 当前被选中的表格名称，仅用于提示词上下文 */
    tableLabel?: string;
    valueByCell: Record<string, string>;
    rowCount: number;
    colCount: number;
    enableShowRowIndex?: boolean;
    /** 与前端 tableFlags 一致，供 set_table_flags 对照当前状态 */
    tableFlags?: Readonly<Record<string, boolean>>;
  }>;
  /** 覆盖环境变量中的模型名，便于本机切换 */
  model?: string;
  /**
   * auto：根据用户最后一轮话自动选技能（聚焦提示，省 token、少跑题）。
   * 也可强制指定，便于调试或 UI 模式切换。
   */
  skill?: TableAgentSkillMode;
}>;

type OllamaChatResponse = {
  message?: { role?: string; content?: string; thinking?: string };
  error?: string;
};

/** Ollama 对 DeepSeek-R1 / Qwen3 等会在 message.thinking 中返回推理轨迹，需显式 think:true（部分版本默认开启） */
function ollamaSupportsThinking(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes('r1') ||
    m.includes('qwen3') ||
    m.includes('gpt-oss') ||
    m.includes('deepseek-v3.1') ||
    m.includes('deepseek-v3')
  );
}

function shouldEnableThinking(model: string, skill: TableAgentSkill): boolean {
  if (skill === 'fast_commands') return false;
  return ollamaSupportsThinking(model);
}

function extractJsonObject(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence) return fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

export async function registerChatTableAgentRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ChatTableAgentBody }>('/api/chat/table-agent', async (request, reply) => {
    const startedAt = Date.now();
    const body = request.body;
    if (!body?.messages?.length || !body.table) {
      return reply.status(400).send({ error: '缺少 messages 或 table' });
    }

    const base =
      process.env.OLLAMA_BASE_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:11434';
    const model = body.model?.trim() || process.env.OLLAMA_MODEL || 'qwen2.5:latest';

    const recent = body.messages.slice(body.skill === 'fast_commands' ? -4 : -12);
    let lastUser = '';
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      if (recent[i].role === 'user') {
        lastUser = recent[i].content;
        break;
      }
    }
    const skillUsed = resolveTableAgentSkill(body.skill, lastUser);
    request.log.info({ skillUsed, skillMode: body.skill ?? 'auto' });

    const system = buildTableAgentSystemPrompt(body.table, skillUsed);
    const ollamaMessages = [
      { role: 'system' as const, content: system },
      ...recent.map((m) => ({ role: m.role, content: m.content })),
    ];

    let res: Response;
    try {
      res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: false,
          format: 'json',
          ...(shouldEnableThinking(model, skillUsed) ? { think: true } : {}),
        }),
      });
    } catch (e) {
      request.log.error(e);
      return reply.status(502).send({
        error: `无法连接 Ollama（${base}）。请确认本机已启动 ollama serve 并已拉取模型。`,
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      request.log.warn({ status: res.status, errText });
      return reply.status(502).send({
        error: `Ollama 请求失败（HTTP ${res.status}）：${errText.slice(0, 500)}`,
      });
    }

    const data = (await res.json()) as OllamaChatResponse;
    if (data.error) {
      return reply.status(502).send({ error: data.error });
    }

    const raw = data.message?.content?.trim() ?? '';
    const thinking = data.message?.thinking?.trim();
    if (!raw) {
      return reply.status(502).send({ error: 'Ollama 返回空内容' });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonObject(raw));
    } catch (e) {
      request.log.warn({ raw: raw.slice(0, 800), e });
      return reply.status(502).send({
        error: '模型返回不是合法 JSON，请换模型或重试。',
        raw: raw.slice(0, 2000),
      });
    }

    const confidence =
      skillUsed === 'fast_commands' &&
      parsed != null &&
      typeof parsed === 'object' &&
      'confidence' in parsed &&
      typeof (parsed as Record<string, unknown>).confidence === 'number'
        ? Math.max(0, Math.min(1, (parsed as Record<string, number>).confidence))
        : undefined;
    const durationMs = Date.now() - startedAt;
    request.log.info({
      skillUsed,
      durationMs,
      hasThinking: Boolean(thinking),
      hasConfidence: confidence !== undefined,
    });

    return reply.send({
      model,
      skillUsed,
      result: parsed,
      raw,
      durationMs,
      ...(confidence !== undefined ? { confidence } : {}),
      ...(thinking ? { thinking } : {}),
    });
  });
}
