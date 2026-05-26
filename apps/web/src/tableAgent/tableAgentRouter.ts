import { TableAreaDemoModel } from '@vinson.hx/vc-biz';
import { parseQuickCommand } from './quickCommandRules';
import { shouldAttemptFastCommands } from './runtimeRoutePolicy';
import { resolveOllamaModelForLlmValue } from '../data/llmOptions';
import { fetchTableAgent } from './fetchTableAgent';
import { parseTableAgentResult } from './parseTableAgentResult';
import { decideFastCommandsRoute } from './routingDecision';
import { TableAgentAction, TableAgentResult } from './tableAgentTypes';
import { parseProductQuickCommand } from '../product/productQuickRules';

export type AgentRoute = 'L0' | 'L1' | 'L2';

export interface AgentRouterResult extends TableAgentResult {
  route: AgentRoute;
  elapsedMs: number;
  reason?: string;
  confidence?: number;
}

export interface TableSnapshot {
  tableKey: string;
  tableLabel: string;
  valueByCell: Record<string, string>;
  rowCount: number;
  colCount: number;
  enableShowRowIndex: boolean;
  tableFlags: {
    enableColumnResize: boolean;
    enableVerticalCenter: boolean;
    enableFreezeFirstCol: boolean;
    enableFreezeLastCol: boolean;
    enableFreezeLastRow: boolean;
    enableBodyCellRightBorder: boolean;
    enableInsertRowCol: boolean;
    enableEditMode: boolean;
    enableRegularTableFont: boolean;
  };
}

const FAST_COMMANDS_CONFIDENCE_THRESHOLD = 0.8;

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export async function dispatchTableAgent(
  text: string,
  history: ChatMessage[],
  model: TableAreaDemoModel,
  snapshot: TableSnapshot,
  currentLlm: string,
  abortSignal?: AbortSignal
): Promise<AgentRouterResult> {
  const startedAt = performance.now();

  // L0: 商品规则优先匹配（商品专属能力）
  const productQuick = parseProductQuickCommand(text, model);
  if (productQuick.matched) {
    return {
      route: 'L0',
      reply: productQuick.reply,
      actions: productQuick.actions,
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  }

  // L0: 通用预设规则匹配
  const quick = parseQuickCommand(text, model);
  if (quick.matched) {
    return {
      route: 'L0',
      reply: quick.reply,
      actions: quick.actions,
      elapsedMs: Math.round(performance.now() - startedAt),
    };
  }

  // 检查是否已取消
  if (abortSignal?.aborted) {
    throw new Error('请求已取消');
  }

  // L1: 快速技能路由
  if (shouldAttemptFastCommands(false, currentLlm)) {
    const fastModel = resolveOllamaModelForLlmValue('qwen');
    if (fastModel) {
      try {
        const fastRes = await fetchTableAgent(history.slice(-2), snapshot, fastModel, 'fast_commands', 30000, abortSignal);
        if (!('error' in fastRes)) {
          const parsedFast = parseTableAgentResult(fastRes.result);
          const fastConfidence = fastRes.confidence ?? 0;
          const decision = decideFastCommandsRoute({
            hasActions: Boolean(parsedFast && parsedFast.actions.length > 0),
            confidence: fastConfidence,
            threshold: FAST_COMMANDS_CONFIDENCE_THRESHOLD,
          });

          if (decision.route === 'L1' && parsedFast) {
            return {
              route: 'L1',
              reply: parsedFast.reply,
              actions: parsedFast.actions,
              confidence: fastConfidence,
              elapsedMs: Math.round(performance.now() - startedAt),
            };
          }
        }
      } catch (e) {
        console.warn('[Router] L1 bypass due to error', e);
      }
    }
  }

  // L2: LLM fallback
  let effectiveLlm = currentLlm === 'automation_rules' ? 'qwen' : currentLlm;
  const ollamaModel = resolveOllamaModelForLlmValue(effectiveLlm);

  if (!ollamaModel) {
    throw new Error(`未配置模型路由: ${effectiveLlm}`);
  }

  const res = await fetchTableAgent(history, snapshot, ollamaModel, undefined, 30000, abortSignal);
  if ('error' in res) {
    throw new Error(res.error);
  }

  const parsed = parseTableAgentResult(res.result);
  if (!parsed) {
    throw new Error('模型返回格式无法解析');
  }

  return {
    route: 'L2',
    ...parsed,
    elapsedMs: Math.round(performance.now() - startedAt),
    reason: currentLlm === 'automation_rules' ? '未命中预设规则自动切换' : undefined,
  };
}
