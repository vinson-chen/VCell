import {
  BizTable,
  CustomTabs,
  useTableAreaDemoState,
  useTableBodyScrollMaxHeight,
  useCustomTabsState,
  Vtell,
  uid,
  type CustomTabItem,
  type CustomTabsActiveTabFieldConfig,
  type TableAreaDemoModel,
  type TableAreaDemoOptions,
  type VtellMessage,
  type VtellAttachedFile,
} from '@vinson.hx/vc-biz';
import { Flex, Layout, vcTokens } from '@vinson.hx/vc-design';
import type { MutableRefObject, PointerEventHandler } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { applyTableAgentActions } from './tableAgent/applyTableAgentActions';
import { fetchTableAgent } from './tableAgent/fetchTableAgent';
import { parseTableAgentResult } from './tableAgent/parseTableAgentResult';
import { parseQuickCommand } from './tableAgent/quickCommandRules';
import { decideFastCommandsRoute } from './tableAgent/routingDecision';
import { shouldAttemptFastCommands } from './tableAgent/runtimeRoutePolicy';
import {
  CHAT_LLM_OPTIONS,
  DEFAULT_CHAT_LLM_VALUE,
  resolveOllamaModelForLlmValue,
} from './data/llmOptions';
import { buildL0CompletionPool } from './data/l0ChatCompletions';

const { Content } = Layout;

/**
 * 与 vc-biz `TableAreaDemoOptions` / vc-design BizTableDemo 能力面对齐。
 * - `bodyScrollMaxHeight` 不在此写死：由 `TableColumn` 内 `useTableBodyScrollMaxHeight` 量宿主后并入 `useTableAreaDemoState`（虚拟列表 + 表头 sticky + 随窗口缩放）。
 * - 其余行为由 BizTable → TableRows 内置：冻结列分割线、方向键换格、Delete/Backspace 清格、Enter 提交换行等（见 vc-biz `useTableGridEditing`）。
 */
const TABLE_OPTIONS: TableAreaDemoOptions = {
  initialRowCount: 2,
  initialColCount: 2,
  initialEnableColumnResize: true,
  initialEnableVerticalCenter: true,
  initialEnableFreezeFirstCol: true,
  initialEnableFreezeLastCol: false,
  initialEnableFreezeLastRow: true,
  initialEnableBodyCellRightBorder: true,
  initialEnableShowRowIndex: true,
  initialEnableInsertRowCol: true,
  initialEnableEditMode: true,
  initialValueByCell: {},
  /** 与 BizTableDemo 一致：不展示表下「编辑快捷键」区块（文案可从 vc-biz 导出 `BIZ_TABLE_EDIT_KEYBOARD_HINT_LINES` 自用） */
  showEditKeyboardHints: false,
};

type TableStateSnapshot = Readonly<{
  rowCount: number;
  colCount: number;
  valueByCell: Record<string, string>;
  enableShowRowIndex: boolean;
  tableFlags: Readonly<{
    enableColumnResize: boolean;
    enableVerticalCenter: boolean;
    enableFreezeFirstCol: boolean;
    enableFreezeLastCol: boolean;
    enableFreezeLastRow: boolean;
    enableBodyCellRightBorder: boolean;
    enableInsertRowCol: boolean;
    enableEditMode: boolean;
    enableRegularTableFont: boolean;
  }>;
}>;

function createInitialTableState(): TableStateSnapshot {
  return {
    rowCount: TABLE_OPTIONS.initialRowCount ?? 2,
    colCount: TABLE_OPTIONS.initialColCount ?? 2,
    valueByCell: {},
    enableShowRowIndex: TABLE_OPTIONS.initialEnableShowRowIndex ?? true,
    tableFlags: {
      enableColumnResize: TABLE_OPTIONS.initialEnableColumnResize ?? true,
      enableVerticalCenter: TABLE_OPTIONS.initialEnableVerticalCenter ?? true,
      enableFreezeFirstCol: TABLE_OPTIONS.initialEnableFreezeFirstCol ?? true,
      enableFreezeLastCol: TABLE_OPTIONS.initialEnableFreezeLastCol ?? false,
      enableFreezeLastRow: TABLE_OPTIONS.initialEnableFreezeLastRow ?? true,
      enableBodyCellRightBorder: TABLE_OPTIONS.initialEnableBodyCellRightBorder ?? true,
      enableInsertRowCol: TABLE_OPTIONS.initialEnableInsertRowCol ?? true,
      enableEditMode: TABLE_OPTIONS.initialEnableEditMode ?? true,
      enableRegularTableFont: TABLE_OPTIONS.initialEnableRegularTableFont ?? true,
    },
  };
}

function sameTabFieldConfig(
  a: CustomTabsActiveTabFieldConfig,
  b: CustomTabsActiveTabFieldConfig
): boolean {
  if (a.enableFreezeLastCol !== b.enableFreezeLastCol) return false;
  if (a.colCount !== b.colCount) return false;
  const ah = [...a.hiddenColSet].sort().join(',');
  const bh = [...b.hiddenColSet].sort().join(',');
  if (ah !== bh) return false;
  for (let c = 0; c < a.colCount; c++) {
    const k = `header-${c}`;
    if ((a.valueByCell[k] ?? '') !== (b.valueByCell[k] ?? '')) return false;
  }
  return true;
}

function snapshotFromModel(tm: TableAreaDemoModel): TableStateSnapshot {
  return {
    rowCount: tm.rowCount,
    colCount: tm.colCount,
    valueByCell: { ...tm.valueByCell },
    enableShowRowIndex: tm.enableShowRowIndex,
    tableFlags: {
      enableColumnResize: tm.enableColumnResize,
      enableVerticalCenter: tm.enableVerticalCenter,
      enableFreezeFirstCol: tm.enableFreezeFirstCol,
      enableFreezeLastCol: tm.enableFreezeLastCol,
      enableFreezeLastRow: tm.enableFreezeLastRow,
      enableBodyCellRightBorder: tm.enableBodyCellRightBorder,
      enableInsertRowCol: tm.enableInsertRowCol,
      enableEditMode: tm.enableEditMode,
      enableRegularTableFont: tm.enableRegularTableFont,
    },
  };
}

const FAST_COMMANDS_CONFIDENCE_THRESHOLD = 0.8;

/** 主区域：表格 / 对话 最小宽度；分割条热区总宽 3px，白底，中央为 1px 分割线 */
const MAIN_PANEL_MIN_WIDTH_PX = 280;
const MAIN_SPLITTER_HIT_PX = 3;

function clampChatPanelWidth(containerWidthPx: number, chatW: number): number {
  const inner = containerWidthPx - MAIN_SPLITTER_HIT_PX;
  const maxChat = inner - MAIN_PANEL_MIN_WIDTH_PX;
  const minChat = MAIN_PANEL_MIN_WIDTH_PX;
  if (maxChat < minChat) {
    return Math.max(0, Math.round(inner / 2));
  }
  return Math.min(Math.max(chatW, minChat), maxChat);
}

function defaultChatPanelWidthPx(): number {
  if (typeof globalThis === 'undefined' || !('innerWidth' in globalThis)) return 448;
  const w = (globalThis as Window).innerWidth;
  return Math.min(448, Math.round(w * 0.36));
}

function MainSplitter(props: Readonly<{
  lineActive: boolean;
  splitDragging: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
}>) {
  const {
    lineActive,
    splitDragging,
    onPointerEnter,
    onPointerLeave,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  } = props;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="拖拽调整表格与对话区宽度"
      tabIndex={0}
      onPointerEnter={onPointerEnter}
      onPointerLeave={() => {
        if (!splitDragging) onPointerLeave();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        flexShrink: 0,
        width: MAIN_SPLITTER_HIT_PX,
        background: vcTokens.color.neutral.background.container,
        cursor: 'col-resize',
        touchAction: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignSelf: 'stretch',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <div
        style={{
          alignSelf: 'stretch',
          width: lineActive ? 3 : 1,
          borderRadius: 1,
          background: lineActive
            ? vcTokens.color.primary.default
            : vcTokens.color.neutral.border.default,
          transition: 'width 0.12s ease, background 0.12s ease',
          flexShrink: 0,
        }}
      />
    </div>
  );
}


type TableRefs = Readonly<{
  tableModelRef: MutableRefObject<TableAreaDemoModel | null>;
  rowCountRef: MutableRefObject<number>;
  colCountRef: MutableRefObject<number>;
}>;

/** 表格状态隔离在此子树，避免改单元格时重渲染右侧对话区 */
function TableColumn({
  tableModelRef,
  rowCountRef,
  colCountRef,
  initial,
  onTabFieldConfigChange,
}: TableRefs & {
  initial: TableStateSnapshot;
  onTabFieldConfigChange: (next: CustomTabsActiveTabFieldConfig | null) => void;
}) {
  const { hostRef, bodyScrollMaxHeight } = useTableBodyScrollMaxHeight();
  const model = useTableAreaDemoState({
    initialRowCount: initial.rowCount,
    initialColCount: initial.colCount,
    initialEnableColumnResize: initial.tableFlags.enableColumnResize,
    initialEnableVerticalCenter: initial.tableFlags.enableVerticalCenter,
    initialEnableFreezeFirstCol: initial.tableFlags.enableFreezeFirstCol,
    initialEnableFreezeLastCol: initial.tableFlags.enableFreezeLastCol,
    initialEnableFreezeLastRow: initial.tableFlags.enableFreezeLastRow,
    initialEnableBodyCellRightBorder: initial.tableFlags.enableBodyCellRightBorder,
    initialEnableShowRowIndex: initial.enableShowRowIndex,
    initialEnableInsertRowCol: initial.tableFlags.enableInsertRowCol,
    initialEnableEditMode: initial.tableFlags.enableEditMode,
    initialEnableRegularTableFont: initial.tableFlags.enableRegularTableFont,
    initialValueByCell: initial.valueByCell,
    showEditKeyboardHints: TABLE_OPTIONS.showEditKeyboardHints,
    /** 有正值时与 TableAreaTableInstance 相同走表内 `.vc-biz-table-scrollport` 虚拟滚动；`tableOuterScrollRef` 仅在全量挂载模式需要，此处不传 */
    bodyScrollMaxHeight,
  });
  tableModelRef.current = model;
  rowCountRef.current = model.rowCount;
  colCountRef.current = model.colCount;

  useLayoutEffect(() => {
    onTabFieldConfigChange({
      colCount: model.colCount,
      valueByCell: model.valueByCell,
      hiddenColSet: model.hiddenColSet,
      setColumnHidden: model.setColumnHidden,
      enableFreezeLastCol: model.enableFreezeLastCol,
    });
  }, [
    model.colCount,
    model.hiddenColSet,
    model.valueByCell,
    model.setColumnHidden,
    model.enableFreezeLastCol,
    onTabFieldConfigChange,
  ]);

  useEffect(() => {
    return () => {
      onTabFieldConfigChange(null);
    };
  }, [onTabFieldConfigChange]);

  return (
    <Flex
      vertical
      align="stretch"
      style={{
        flex: 1,
        minWidth: MAIN_PANEL_MIN_WIDTH_PX,
        minHeight: 0,
        height: '100%',
        padding: 16,
        boxSizing: 'border-box',
        background: vcTokens.color.neutral.background.container,
        /** 高度交给 host 测量；横滚在表内 scrollport */
        overflow: 'hidden',
      }}
    >
      <div
        ref={hostRef}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <BizTable {...model} />
      </div>
    </Flex>
  );
}

const CHAT_INPUT_PLACEHOLDER = '输入指令，操控表格';

/** 生成 L0 补全池（基于当前表格状态） */
function buildL0CompletionsForTable(model: TableAreaDemoModel | null): string[] {
  if (!model) return [];
  return buildL0CompletionPool(model);
}

export default function App() {
  const tableModelRef = useRef<TableAreaDemoModel | null>(null);
  const rowCountRef = useRef(0);
  const colCountRef = useRef(0);
  const { items, setItems, activeKey, setActiveKey } = useCustomTabsState({
    initialLabel: '未命名表格',
  });
  const [tableStates, setTableStates] = useState<Record<string, TableStateSnapshot>>({});
  /** 每个表格独立的对话历史：切换表格时自动切换对话区内容 */
  const [chatHistories, setChatHistories] = useState<Record<string, VtellMessage[]>>({});
  const [chatSending, setChatSending] = useState(false);
  const [chatLlm, setChatLlm] = useState<string>(DEFAULT_CHAT_LLM_VALUE);
  const mainRowRef = useRef<HTMLDivElement>(null);
  const chatPanelWidthRef = useRef(0);
  const dragSessionRef = useRef<{ startX: number; startChat: number } | null>(null);

  const [chatPanelWidthPx, setChatPanelWidthPx] = useState(defaultChatPanelWidthPx);
  chatPanelWidthRef.current = chatPanelWidthPx;

  const [splitDragging, setSplitDragging] = useState(false);
  const [splitHovered, setSplitHovered] = useState(false);
  const lineActive = splitDragging || splitHovered;

  const persistActiveTableSnapshot = useCallback(() => {
    const tm = tableModelRef.current;
    if (!tm) return;
    setTableStates((prev) => ({ ...prev, [activeKey]: snapshotFromModel(tm) }));
  }, [activeKey]);

  const onTabsItemsChange = useCallback(
    (nextItems: CustomTabItem[]) => {
      const prevKeys = new Set(items.map((t) => t.key));
      const normalized = nextItems.map((t) => {
        if (t.kind !== 'custom') return t;
        if (!prevKeys.has(t.key)) return { ...t, label: '未命名表格' };
        if (t.label.trim() === '未命名') return { ...t, label: '未命名表格' };
        return t;
      });
      setItems(normalized);
      setTableStates((prev) => {
        const nextMap: Record<string, TableStateSnapshot> = {};
        for (const t of normalized) {
          nextMap[t.key] = prev[t.key] ?? createInitialTableState();
        }
        return nextMap;
      });
    },
    [items, setItems]
  );

  const onTabsActiveKeyChange = useCallback(
    (nextKey: string) => {
      if (nextKey === activeKey) return;
      persistActiveTableSnapshot();
      setActiveKey(nextKey);
    },
    [activeKey, persistActiveTableSnapshot, setActiveKey]
  );

  const onImportFileAsNewTable = useCallback(
    async (file: File) => {
      persistActiveTableSnapshot();
      const tab: CustomTabItem = { key: uid(), label: file.name, kind: 'custom' };
      const next = [...items, tab];
      setItems(next);
      setTableStates((prev) => ({ ...prev, [tab.key]: createInitialTableState() }));
      setActiveKey(tab.key);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const tm = tableModelRef.current;
      if (!tm) return;
      await tm.importExcelFromFile(file);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      setTableStates((prev) => ({ ...prev, [tab.key]: snapshotFromModel(tm) }));
    },
    [items, persistActiveTableSnapshot, setActiveKey, setItems]
  );

  useEffect(() => {
    setTableStates((prev) => {
      const nextMap: Record<string, TableStateSnapshot> = {};
      for (const t of items) {
        nextMap[t.key] = prev[t.key] ?? createInitialTableState();
      }
      return nextMap;
    });
  }, [items]);

  const reClampChatWidth = useCallback(() => {
    const el = mainRowRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    setChatPanelWidthPx((prev) => clampChatPanelWidth(w, prev));
  }, []);

  useLayoutEffect(() => {
    reClampChatWidth();
  }, [reClampChatWidth]);

  useEffect(() => {
    const el = mainRowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => reClampChatWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [reClampChatWidth]);

  useEffect(() => {
    const onWin = () => reClampChatWidth();
    window.addEventListener('resize', onWin);
    return () => window.removeEventListener('resize', onWin);
  }, [reClampChatWidth]);

  const onSplitterPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>((e) => {
    e.preventDefault();
    dragSessionRef.current = {
      startX: e.clientX,
      startChat: chatPanelWidthRef.current,
    };
    setSplitDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onSplitterPointerMove = useCallback<PointerEventHandler<HTMLDivElement>>((e) => {
    if (!dragSessionRef.current || !mainRowRef.current) return;
    const rect = mainRowRef.current.getBoundingClientRect();
    const dx = e.clientX - dragSessionRef.current.startX;
    const next = dragSessionRef.current.startChat - dx;
    setChatPanelWidthPx(clampChatPanelWidth(rect.width, next));
  }, []);

  const finishSplitDrag = useCallback<PointerEventHandler<HTMLDivElement>>((e) => {
    if (dragSessionRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* 未持有 capture 时忽略 */
      }
      dragSessionRef.current = null;
    }
    setSplitDragging(false);
  }, []);

  const refs = useMemo(
    () => ({
      tableModelRef,
      rowCountRef,
      colCountRef,
    }),
    []
  );
  const activeTableState = tableStates[activeKey] ?? createInitialTableState();
  const activeTableLabel = items.find((it) => it.key === activeKey)?.label ?? '未命名表格';

  const [activeTabFieldConfig, setActiveTabFieldConfig] =
    useState<CustomTabsActiveTabFieldConfig | null>(null);

  const onTabFieldConfigChange = useCallback((next: CustomTabsActiveTabFieldConfig | null) => {
    setActiveTabFieldConfig((prev) => {
      if (next === null) return prev === null ? prev : null;
      if (prev !== null && sameTabFieldConfig(prev, next)) return prev;
      return next;
    });
  }, []);

  // ===== Vtell 对话区状态 =====
  /** 当前激活表格的对话历史 */
  const activeMessages = useMemo(
    () => chatHistories[activeKey] ?? [],
    [chatHistories, activeKey]
  );

  /** L0 补全池（基于当前表格状态） */
  const l0Completions = useMemo(() => {
    const tm = tableModelRef.current;
    return buildL0CompletionsForTable(tm);
  }, [activeKey, activeTableState]);

  /** 更新当前表格的对话历史 */
  const updateActiveChatHistory = useCallback(
    (messages: VtellMessage[]) => {
      setChatHistories((prev) => ({ ...prev, [activeKey]: messages }));
    },
    [activeKey]
  );

  /** 新增表格时初始化空对话历史 */
  useEffect(() => {
    setChatHistories((prev) => {
      const nextMap: Record<string, VtellMessage[]> = {};
      for (const t of items) {
        nextMap[t.key] = prev[t.key] ?? [];
      }
      return nextMap;
    });
  }, [items]);

  /** Vtell onSend 回调：包含完整 L0/L1/L2 Agent 路由逻辑 */
  const onVtellSend = useCallback(
    async (text: string, files: VtellAttachedFile[]) => {
      if (!text && files.length === 0) return;

      const attachNote =
        files.length > 0 ? `[附件: ${files.map((a) => a.file.name).join(', ')}]` : '';
      const userContent = text && attachNote ? `${text}\n${attachNote}` : text || attachNote;

      const userMsg: VtellMessage = { id: uid(), role: 'user', content: userContent };
      const startedAt = performance.now();
      const loadingId = uid();
      const loadingMsg: VtellMessage = {
        id: loadingId,
        role: 'assistant',
        content: '',
        status: 'loading',
      };

      setChatSending(true);
      updateActiveChatHistory([...activeMessages, userMsg, loadingMsg]);

      const finishAssistant = (content: string) => {
        setChatHistories((prev) => {
          const current = prev[activeKey] ?? [];
          return {
            ...prev,
            [activeKey]: current.map((msg) =>
              msg.id === loadingId ? { ...msg, content, status: undefined } : msg
            ),
          };
        });
        setChatSending(false);
      };

      const routeFoot = (route: 'L0' | 'L1' | 'L2', reason?: string) => {
        const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
        return `\n\n（路由：${route}${reason ? `，原因：${reason}` : ''}，耗时：${elapsed}ms）`;
      };

      const logRoute = (route: 'L0' | 'L1' | 'L2', reason?: string) => {
        const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
        console.info('[table-route]', { route, elapsedMs: elapsed, reason: reason ?? '' });
      };

      const historyForAgent = [...activeMessages, userMsg].map(({ role, content }) => ({
        role,
        content,
      }));

      // 处理附件导入
      if (files.length > 0) {
        for (const a of files) {
          await onImportFileAsNewTable(a.file);
        }
      }

      if (!text) {
        finishAssistant(
          `已新建并选中 ${files.length} 个表格后导入附件：${files
            .map((a) => a.file.name)
            .join('、')}（使用表格区「导入数据」同款能力）。`
        );
        return;
      }

      const tm = tableModelRef.current;
      if (!tm) {
        finishAssistant('表格尚未就绪，请稍后重试。');
        return;
      }

      const applyActionsWithUndo = (
        actions: Parameters<typeof applyTableAgentActions>[1]
      ) => {
        tm.startUndoBatch();
        try {
          return applyTableAgentActions(
            tm,
            actions,
            { rowCountRef, colCountRef },
            { runAfterUpdate: flushSync }
          );
        } finally {
          tm.endUndoBatch();
        }
      };

      // L0: 预设规则匹配
      const quick = parseQuickCommand(text, tm);
      if (quick.matched) {
        setChatLlm('automation_rules');
        const report = applyActionsWithUndo(quick.actions);
        const extra =
          report.notes.length > 0
            ? `\n\n执行备注：${report.notes.join('；')}`
            : report.skipped > 0
              ? `\n\n（有 ${report.skipped} 步未生效，可能因越界或已达最小行列数）`
              : '';
        const importNote =
          files.length > 0
            ? `（发送前已新建并选中表格后导入附件：${files.map((a) => a.file.name).join('、')}）\n\n`
            : '';
        logRoute('L0');
        finishAssistant(`${importNote}${quick.reply}${extra}\n\n（本次处理：预设规则）${routeFoot('L0')}`);
        return;
      }

      // L1: 快速技能路由
      let fastFallbackReason = 'L1无可执行动作';
      if (shouldAttemptFastCommands(false, chatLlm)) {
        const fastHistory = [...activeMessages.slice(-1), userMsg].map(({ role, content }) => ({
          role,
          content,
        }));
        const tableSnapshotForFast = {
          tableKey: activeKey,
          tableLabel: activeTableLabel,
          valueByCell: { ...tm.valueByCell },
          rowCount: tm.rowCount,
          colCount: tm.colCount,
          enableShowRowIndex: tm.enableShowRowIndex,
          tableFlags: {
            enableColumnResize: tm.enableColumnResize,
            enableVerticalCenter: tm.enableVerticalCenter,
            enableFreezeFirstCol: tm.enableFreezeFirstCol,
            enableFreezeLastCol: tm.enableFreezeLastCol,
            enableFreezeLastRow: tm.enableFreezeLastRow,
            enableBodyCellRightBorder: tm.enableBodyCellRightBorder,
            enableShowRowIndex: tm.enableShowRowIndex,
            enableInsertRowCol: tm.enableInsertRowCol,
            enableEditMode: tm.enableEditMode,
            enableRegularTableFont: tm.enableRegularTableFont,
          },
        };
        const fastModel = resolveOllamaModelForLlmValue('qwen');
        if (!fastModel) {
          fastFallbackReason = 'L1模型未配置';
        } else {
          try {
            const fastRes = await fetchTableAgent(
              fastHistory,
              tableSnapshotForFast,
              fastModel,
              'fast_commands'
            );
            if (!('error' in fastRes)) {
              const parsedFast = parseTableAgentResult(fastRes.result);
              const fastConfidence = fastRes.confidence ?? 0;
              const decision = decideFastCommandsRoute({
                hasActions: Boolean(parsedFast && parsedFast.actions.length > 0),
                confidence: fastConfidence,
                threshold: FAST_COMMANDS_CONFIDENCE_THRESHOLD,
              });
              if (decision.route === 'L1' && parsedFast) {
                setChatLlm('automation_rules');
                const report = applyActionsWithUndo(parsedFast.actions);
                const extra =
                  report.notes.length > 0
                    ? `\n\n执行备注：${report.notes.join('；')}`
                    : report.skipped > 0
                      ? `\n\n（有 ${report.skipped} 步未生效，可能因越界或已达最小行列数）`
                      : '';
                const importNote =
                  files.length > 0
                    ? `（发送前已新建并选中表格后导入附件：${files.map((a) => a.file.name).join('、')}）\n\n`
                    : '';
                finishAssistant(
                  `${importNote}${parsedFast.reply}${extra}\n\n（本次处理：预设规则技能，confidence=${fastConfidence.toFixed(2)}）${routeFoot('L1')}`
                );
                logRoute('L1');
                return;
              }
              fastFallbackReason = decision.reason ?? fastFallbackReason;
            } else {
              fastFallbackReason = decideFastCommandsRoute({
                hasActions: false,
                confidence: 0,
                threshold: FAST_COMMANDS_CONFIDENCE_THRESHOLD,
                errorKind: 'request_failed',
              }).reason ?? 'L1请求失败';
            }
          } catch {
            fastFallbackReason = decideFastCommandsRoute({
              hasActions: false,
              confidence: 0,
              threshold: FAST_COMMANDS_CONFIDENCE_THRESHOLD,
              errorKind: 'request_exception',
            }).reason ?? 'L1请求异常';
          }
        }
      }

      // L2: LLM fallback
      let effectiveLlm = chatLlm;
      let fallbackNote = '';
      let fallbackReason = fastFallbackReason;
      if (chatLlm === 'automation_rules') {
        effectiveLlm = 'qwen';
        setChatLlm('qwen');
        fallbackNote = '（未命中预设规则/技能，已自动切换到 Qwen 处理）\n\n';
        fallbackReason = fastFallbackReason || 'L0未命中或L1置信度不足';
      }

      const ollamaModel = resolveOllamaModelForLlmValue(effectiveLlm);
      if (!ollamaModel) {
        finishAssistant('当前模型选项未配置路由。');
        return;
      }

      const tableSnapshot = {
        tableKey: activeKey,
        tableLabel: activeTableLabel,
        valueByCell: { ...tm.valueByCell },
        rowCount: tm.rowCount,
        colCount: tm.colCount,
        enableShowRowIndex: tm.enableShowRowIndex,
        tableFlags: {
          enableColumnResize: tm.enableColumnResize,
          enableVerticalCenter: tm.enableVerticalCenter,
          enableFreezeFirstCol: tm.enableFreezeFirstCol,
          enableFreezeLastCol: tm.enableFreezeLastCol,
          enableFreezeLastRow: tm.enableFreezeLastRow,
          enableBodyCellRightBorder: tm.enableBodyCellRightBorder,
          enableShowRowIndex: tm.enableShowRowIndex,
          enableInsertRowCol: tm.enableInsertRowCol,
          enableEditMode: tm.enableEditMode,
          enableRegularTableFont: tm.enableRegularTableFont,
        },
      };

      try {
        const res = await fetchTableAgent(historyForAgent, tableSnapshot, ollamaModel);
        if ('error' in res) {
          finishAssistant(
            `请求失败：${res.error}${res.raw ? `\n\n模型原文片段：\n${res.raw.slice(0, 800)}` : ''}`
          );
          return;
        }
        const parsed = parseTableAgentResult(res.result);
        if (!parsed) {
          finishAssistant('模型返回格式无法解析为改表结果，请重试或更换模型。');
          return;
        }
        const report = applyActionsWithUndo(parsed.actions);
        const extra =
          report.notes.length > 0
            ? `\n\n执行备注：${report.notes.join('；')}`
            : report.skipped > 0
              ? `\n\n（有 ${report.skipped} 步未生效，可能因越界或已达最小行列数）`
              : '';
        const thinkingBlock =
          'thinking' in res && typeof res.thinking === 'string' && res.thinking.trim()
            ? `【推理过程】\n${res.thinking.trim()}\n\n──────────\n\n`
            : '';
        const modelFoot = `\n\n（本次调用模型：${res.model}）`;
        const importNote =
          files.length > 0
            ? `（发送前已新建并选中表格后导入附件：${files.map((a) => a.file.name).join('、')}）\n\n`
            : '';
        finishAssistant(
          `${importNote}${fallbackNote}${thinkingBlock}${parsed.reply}${extra}${modelFoot}${routeFoot('L2', fallbackReason || undefined)}`
        );
        logRoute('L2', fallbackReason || undefined);
      } catch (e) {
        finishAssistant(`请求异常：${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [
      activeMessages,
      activeKey,
      activeTableLabel,
      chatLlm,
      onImportFileAsNewTable,
      rowCountRef,
      colCountRef,
      tableModelRef,
      updateActiveChatHistory,
    ]
  );

  return (
    <Layout style={{ height: '100%', background: vcTokens.color.neutral.background.layout }}>
      <CustomTabs
        items={items}
        onItemsChange={onTabsItemsChange}
        activeKey={activeKey}
        onActiveKeyChange={onTabsActiveKeyChange}
        showIcon
        activeTabFieldConfig={activeTabFieldConfig}
        onAddMenuImportTableFile={onImportFileAsNewTable}
      />
      <Content style={{ flex: 1, minHeight: 0, padding: 0, overflow: 'hidden' }}>
        <div
          ref={mainRowRef}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            height: '100%',
            minHeight: 0,
            width: '100%',
            overflow: 'hidden',
          }}
        >
          <TableColumn
            key={activeKey}
            {...refs}
            initial={activeTableState}
            onTabFieldConfigChange={onTabFieldConfigChange}
          />
          <MainSplitter
            lineActive={lineActive}
            splitDragging={splitDragging}
            onPointerEnter={() => setSplitHovered(true)}
            onPointerLeave={() => setSplitHovered(false)}
            onPointerDown={onSplitterPointerDown}
            onPointerMove={onSplitterPointerMove}
            onPointerUp={finishSplitDrag}
            onPointerCancel={finishSplitDrag}
          />
          <Vtell
            messages={activeMessages}
            sending={chatSending}
            onSend={onVtellSend}
            widthPx={chatPanelWidthPx}
            llmOptions={CHAT_LLM_OPTIONS}
            llmValue={chatLlm}
            onLlmChange={setChatLlm}
            placeholder={CHAT_INPUT_PLACEHOLDER}
            l0Completions={l0Completions}
          />
        </div>
      </Content>
    </Layout>
  );
}
