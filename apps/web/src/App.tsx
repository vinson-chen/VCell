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
  type VInputCommandTag,
  type CellSelectionStore,
  type CellSelectionSummary,
  /* VTellCompletionItem defined inline below */
} from '@vinson.hx/vc-biz';
import { Layout, vcTokens, Button, Popover, VcIcon, Select, Input, Space } from '@vinson.hx/vc-design';
import type { MutableRefObject, PointerEventHandler } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  dispatchTableAgent, TableSnapshot, ChatMessage } from './tableAgent/tableAgentRouter';
import { executeTableActions, formatExecutionReport, getSelectedBodyRows } from './tableAgent/tableActionExecutor';
import type { TableAgentAction } from './tableAgent/tableAgentTypes';
import { getAllSkills, PRESET_SKILLS, SavedSkill, executeSkill, checkSkillRequirements } from './tableAgent/skills';
import {
  CHAT_LLM_OPTIONS,
  DEFAULT_CHAT_LLM_VALUE,
} from './data/llmOptions';
import {
  buildL0CompletionPool,
  isFilterCommand,
  isOperationCommand,
  isSpecialCommand,
  extractFilterKeyword,
} from './data/l0ChatCompletions';

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

/** 筛选条件结构 */
type FilterCondition = Readonly<{
  id: string;
  fieldIndex: number;      // 列索引
  operator: string;        // 操作符：等于、不等于、包含、不包含、为空、不为空
  value: string;           // 输入值
}>;

/** 筛选操作符选项 */
const FILTER_OPERATOR_OPTIONS = [
  { value: '等于', label: '等于' },
  { value: '不等于', label: '不等于' },
  { value: '包含', label: '包含' },
  { value: '不包含', label: '不包含' },
  { value: '为空', label: '为空' },
  { value: '不为空', label: '不为空' },
];

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
  const w = (globalThis as unknown as Window).innerWidth;
  return Math.min(448, Math.round(w * 0.36));
}

/** 列号转 Excel 列名：0→A, 1→B, 26→AA */
function colToExcelName(col: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (col < 26) return letters[col]!;
  // 多字母列名
  let name = '';
  let n = col;
  while (n >= 0) {
    name = letters[n % 26]! + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

/** 选区语义化：将 CellSelectionSummary 转为 Excel 风格标签 */
function formatSelectionLabel(
  summary: CellSelectionSummary | null
): string | null {
  if (!summary) return null;

  switch (summary.kind) {
    case 'full':
      return '全选';

    case 'rows': {
      const rows = summary.rows ?? [];
      if (rows.length === 0) return null;

      // 连续行：#2-5行
      if (summary.rowsContinuous) {
        const start = rows[0]! + 1;
        const end = rows[rows.length - 1]! + 1;
        if (start === end) return `${start}行`;
        return `${start}-${end}行`;
      }

      // 非连续行：#2,5行
      if (rows.length === 1) {
        return `${rows[0]! + 1}行`;
      }
      // 按顺序排列，逗号分隔
      const sortedRows = [...rows].sort((a, b) => a - b);
      return `${sortedRows.map(r => r + 1).join(',')}行`;
    }

    case 'column': {
      const col = summary.column ?? 0;
      return `${colToExcelName(col)}列`;
    }

    case 'cell': {
      const { r, c } = summary.cellStart ?? { r: 0, c: 0 };
      // Excel 格式：B2
      return `${colToExcelName(c)}${r + 1}`;
    }

    case 'cell-range': {
      const start = summary.cellStart ?? { r: 0, c: 0 };
      const end = summary.cellEnd ?? { r: 0, c: 0 };
      // Excel 格式：B2:D4
      return `${colToExcelName(start.c)}${start.r + 1}:${colToExcelName(end.c)}${end.r + 1}`;
    }

    default:
      return null;
  }
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
  onCellSelectionStore: (store: CellSelectionStore) => void;
}>;

/** 表格状态隔离在此子树，避免改单元格时重渲染右侧对话区 */
function TableColumn({
  tableModelRef,
  rowCountRef,
  colCountRef,
  onCellSelectionStore,
  initial,
  onTabFieldConfigChange,
}: TableRefs & {
  initial: TableStateSnapshot;
  onTabFieldConfigChange: (next: CustomTabsActiveTabFieldConfig | null) => void;
  }) {
  // 1. 遵循 vc-design 标准：在表格直接宿主容器内测量高度
  // reserveBottomPx = Header(40) + Footer(40) = 80px
  const { hostRef, bodyScrollMaxHeight } = useTableBodyScrollMaxHeight({
    reserveBottomPx: 0,
    borderFudgePx: 2,
  });

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
    onCellSelectionStore,
    /** 有正值时与 TableAreaTableInstance 相同走表内 `.vc-biz-table-scrollport` 虚拟滚动 */
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
    <div
      ref={hostRef as any}
      style={{
        flex: 1,
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <BizTable {...model} />
    </div>
  );
}

const CHAT_INPUT_PLACEHOLDER = '输入指令，操控表格';

/** 生成 L0 补全池（基于当前表格状态） */
function buildL0CompletionsForTable(model: TableAreaDemoModel | null) {
  if (!model) return [];
  return buildL0CompletionPool(model);
}

export default function App() {
  const tableModelRef = useRef<TableAreaDemoModel | null>(null);
  const rowCountRef = useRef(0);
  const colCountRef = useRef(0);
  const cellSelectionStoreRef = useRef<CellSelectionStore | null>(null);
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
  const [filterSnapshots, setFilterSnapshots] = useState<Record<string, TableStateSnapshot>>({});
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [columnOptionsState, setColumnOptionsState] = useState<{ value: number; label: string }[]>([]);
  const [vtellVisible, setVtellVisible] = useState(true);

  /** CellSelectionStore 实例（由 TableRows 传入） */
  const [cellSelectionStore, setCellSelectionStore] = useState<CellSelectionStore | null>(null);

  // 同步到 ref（供回调使用）
  useEffect(() => {
    cellSelectionStoreRef.current = cellSelectionStore;
  }, [cellSelectionStore]);

  /** 当前选区摘要（用于 hashtag 补全池动态显示） */
  const [selectionSummary, setSelectionSummary] = useState<CellSelectionSummary | null>(null);

  /** 选区标签（自动生成的 hashtag 标签） */
  const [selectionTags, setSelectionTags] = useState<VInputCommandTag[]>([]);

  /** 延迟清除标签的 timeout（避免行→列切换时高度抖动） */
  const pendingClearTagsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 监听选区变化，自动生成语义化标签（与表格选区完全对应，最多一个标签） */
  useEffect(() => {
    if (!cellSelectionStore) return;

    const updateSelection = () => {
      const summary = cellSelectionStore.getSelectionSummary();
      setSelectionSummary(summary);

      // 生成选区标签
      const label = formatSelectionLabel(summary);
      if (label && label !== '全选') {
        // 有新选区：取消 pending 清除，立即设置新标签
        if (pendingClearTagsRef.current) {
          clearTimeout(pendingClearTagsRef.current);
          pendingClearTagsRef.current = null;
        }
        const stableId = `selection-current`;
        setSelectionTags([{ id: stableId, label, type: 'hashtag' }]);
      } else {
        // 无选区或全选：延迟清除标签（避免切换时抖动）
        if (pendingClearTagsRef.current) {
          clearTimeout(pendingClearTagsRef.current);
        }
        pendingClearTagsRef.current = setTimeout(() => {
          setSelectionTags([]);
          pendingClearTagsRef.current = null;
        }, 100); // 100ms 内如果有新选区，就不清空
      }
    };

    // 初始读取
    updateSelection();

    // 订阅变化
    const unsubscribe = cellSelectionStore.subscribeSelection(updateSelection);
    return () => {
      unsubscribe();
      if (pendingClearTagsRef.current) {
        clearTimeout(pendingClearTagsRef.current);
      }
    };
  }, [cellSelectionStore]);

  /** 当前请求的 AbortController（用于撤回） */
  const abortControllerRef = useRef<AbortController | null>(null);

  /** 撤回处理：取消请求并移除 loading 消息 */
  const handleCancel = useCallback(() => {
    const abortController = abortControllerRef.current;
    if (abortController) {
      abortController.abort();
      abortControllerRef.current = null;
    }
    setChatHistories((prev) => {
      const current = prev[activeKey] ?? [];
      // 移除 status 为 'loading' 的消息
      return {
        ...prev,
        [activeKey]: current.filter((msg) => msg.status !== 'loading'),
      };
    });
    setChatSending(false);
  }, [activeKey]);

  const [chatPanelWidthPx, setChatPanelWidthPx] = useState(defaultChatPanelWidthPx);
  chatPanelWidthRef.current = chatPanelWidthPx;

  const [splitDragging, setSplitDragging] = useState(false);
  const [splitHovered, setSplitHovered] = useState(false);
  const lineActive = splitDragging || splitHovered;

  const persistActiveTableSnapshot = useCallback(() => {
    const tm = tableModelRef.current;
    if (!tm) return;
    const snapshot = snapshotFromModel(tm);
    setTableStates((prev) => {
      if (prev[activeKey] && JSON.stringify(prev[activeKey]) === JSON.stringify(snapshot)) {
        return prev;
      }
      return { ...prev, [activeKey]: snapshot };
    });
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

      // 批量更新：避免多次 render 导致的状态不同步
      flushSync(() => {
        setItems(normalized);
        setTableStates((prev) => {
          const nextMap: Record<string, TableStateSnapshot> = {};
          for (const t of normalized) {
            nextMap[t.key] = prev[t.key] ?? createInitialTableState();
          }
          return nextMap;
        });
        setChatHistories((prev) => {
          const nextMap: Record<string, VtellMessage[]> = {};
          for (const t of normalized) {
            nextMap[t.key] = prev[t.key] ?? [];
          }
          return nextMap;
        });
      });
    },
    [items, setItems]
  );

  const onTabsActiveKeyChange = useCallback((key: string) => {
    persistActiveTableSnapshot();
    setActiveKey(key);
  }, [persistActiveTableSnapshot, setActiveKey]);

  const onImportFileAsNewTable = useCallback(
    async (file: File) => {
      persistActiveTableSnapshot();
      const tab: CustomTabItem = { key: uid(), label: file.name, kind: 'custom' };

      // 批量更新
      flushSync(() => {
        setItems((prev) => [...prev, tab]);
        setTableStates((prev) => ({ ...prev, [tab.key]: createInitialTableState() }));
        setChatHistories((prev) => ({ ...prev, [tab.key]: [] }));
        setActiveKey(tab.key);
      });

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
    [persistActiveTableSnapshot, setActiveKey, setItems]
  );

  /** 导入表格到当前选中表格（替换数据） */
  const onImportFileToCurrentTable = useCallback(
    async (file: File) => {
      const tm = tableModelRef.current;
      if (!tm) return;

      // 直接导入到当前表格，替换数据
      await tm.importExcelFromFile(file);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      // 更新当前表格状态
      setTableStates((prev) => ({
        ...prev,
        [activeKey]: snapshotFromModel(tm),
      }));
    },
    [activeKey]
  );

  /** 创建商品模板表格 */
  const onCreateGoodsTable = useCallback(() => {
    persistActiveTableSnapshot();
    const tab: CustomTabItem = { key: uid(), label: '商品表格', kind: 'goods' };

    // 淘宝中文模板数据
    const headers = ['商品标题', '类目', '货号', '原价', '售价', '库存', '主图'];
    const sampleRow = ['示例连衣裙', '女装/连衣裙', 'ABC001', '199.00', '99.00', '100', 'https://img.alicdn.com/example.jpg'];

    // 构建初始表格数据
    const valueByCell: Record<string, string> = {};
    headers.forEach((h, c) => {
      valueByCell[`header-${c}`] = h;
    });
    sampleRow.forEach((v, c) => {
      valueByCell[`0-${c}`] = v;
    });

    const goodsState: TableStateSnapshot = {
      rowCount: 2,
      colCount: headers.length,
      valueByCell,
      enableShowRowIndex: true,
      tableFlags: {
        enableColumnResize: true,
        enableVerticalCenter: true,
        enableFreezeFirstCol: true,
        enableFreezeLastCol: false,
        enableFreezeLastRow: true,
        enableBodyCellRightBorder: true,
        enableInsertRowCol: true,
        enableEditMode: true,
        enableRegularTableFont: true,
      },
    };

    // 批量更新
    flushSync(() => {
      setItems((prev) => [...prev, tab]);
      setTableStates((prev) => ({ ...prev, [tab.key]: goodsState }));
      setChatHistories((prev) => ({ ...prev, [tab.key]: [] }));
      setActiveKey(tab.key);
    });
  }, [persistActiveTableSnapshot, setActiveKey, setItems]);

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
      onCellSelectionStore: setCellSelectionStore,
    }),
    [setCellSelectionStore]
  );

  const activeTableState = tableStates[activeKey] ?? createInitialTableState();
  const activeTableLabel = items.find((it) => it.key === activeKey)?.label ?? '未命名表格';

  /** 添加筛选条件 */
  const addCondition = useCallback(() => {
    const defaultFieldIndex = 0;
    setFilterConditions((prev) => [
      ...prev,
      {
        id: uid(),
        fieldIndex: defaultFieldIndex,
        operator: '等于',
        value: '',
      },
    ]);
  }, []);

  /** 删除筛选条件 */
  const removeCondition = useCallback((id: string) => {
    setFilterConditions((prev) => prev.filter((c) => c.id !== id));
  }, []);

  /** 更新条件字段 */
  const updateConditionField = useCallback((id: string, fieldIndex: number) => {
    setFilterConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, fieldIndex } : c))
    );
  }, []);

  /** 更新条件操作符 */
  const updateConditionOperator = useCallback((id: string, operator: string) => {
    setFilterConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, operator } : c))
    );
  }, []);

  /** 更新条件值 */
  const updateConditionValue = useCallback((id: string, value: string) => {
    setFilterConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, value } : c))
    );
  }, []);

  /** 执行筛选：条件变化时实时筛选表格 */
  useEffect(() => {
    const tm = tableModelRef.current;
    if (!tm) return;

    // 无条件时恢复原始数据
    if (filterConditions.length === 0) {
      const savedSnapshot = filterSnapshots[activeKey];
      if (savedSnapshot) {
        tm.startUndoBatch();
        tm.setRowCount(savedSnapshot.rowCount);
        tm.setColCount(savedSnapshot.colCount);
        tm.setValueByCell(savedSnapshot.valueByCell);
        tm.endUndoBatch();
        setFilterSnapshots((prev) => {
          const next = { ...prev };
          delete next[activeKey];
          return next;
        });
      }
      return;
    }

    // 检查条件是否有效（有值或为空/不为空操作符）
    const validConditions = filterConditions.filter((cond) => {
      if (cond.operator === '为空' || cond.operator === '不为空') {
        return true;
      }
      return cond.value.trim().length > 0;
    });

    if (validConditions.length === 0) return;

    // 第一次筛选时保存原始快照
    const hasExistingFilter = filterSnapshots[activeKey] != null;
    if (!hasExistingFilter) {
      const originalSnapshot = snapshotFromModel(tm);
      setFilterSnapshots((prev) => ({ ...prev, [activeKey]: originalSnapshot }));
    }

    // 从原始数据筛选
    const sourceData = filterSnapshots[activeKey] ?? snapshotFromModel(tm);

    // 遍历所有行，检查是否符合所有条件（AND 逻辑）
    // 注意：rowCount 包含表头（虚拟第0行），body 行从 r=1 开始
    const matchedRows: number[] = [];
    for (let r = 1; r < sourceData.rowCount; r++) {
      const rowMatches = validConditions.every((cond) => {
        const cellKey = `${r}-${cond.fieldIndex}`;
        const cellValue = sourceData.valueByCell[cellKey] ?? '';

        switch (cond.operator) {
          case '等于':
            return cellValue === cond.value;
          case '不等于':
            return cellValue !== cond.value;
          case '包含':
            return cellValue.includes(cond.value);
          case '不包含':
            return !cellValue.includes(cond.value);
          case '为空':
            return cellValue === '' || cellValue === undefined;
          case '不为空':
            return cellValue !== '' && cellValue !== undefined;
          default:
            return false;
        }
      });

      if (rowMatches) {
        matchedRows.push(r);
      }
    }

    // 构建筛选后的数据
    const newValueByCell: Record<string, string> = {};
    // 保留表头
    for (let c = 0; c < sourceData.colCount; c++) {
      newValueByCell[`header-${c}`] = sourceData.valueByCell[`header-${c}`] ?? '';
    }
    // 保留匹配行（重新编号）
    for (let newR = 0; newR < matchedRows.length; newR++) {
      const oldR = matchedRows[newR];
      for (let c = 0; c < sourceData.colCount; c++) {
        newValueByCell[`${newR}-${c}`] = sourceData.valueByCell[`${oldR}-${c}`] ?? '';
      }
    }

    // 无损筛选：替换数据
    // rowCount 包含表头行（虚拟第0行），所以是 matchedRows.length + 1
    tm.startUndoBatch();
    tm.setRowCount(matchedRows.length + 1);
    tm.setValueByCell(newValueByCell);
    tm.endUndoBatch();
  }, [filterConditions, activeKey, filterSnapshots]);

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
    const baseCompletions = buildL0CompletionPool();

    // 添加技能列表
    const userSkills = getAllSkills();
    const allSkills = [...PRESET_SKILLS, ...userSkills];

    const skillCompletions = allSkills.map(skill => ({
      key: `skill-${skill.id}`,
      label: `📌 ${skill.name}`,
      icon: 'skill',
    }));

    // 添加分隔符和技能列表
    return [
      ...baseCompletions,
      { key: 'separator-skills', label: '── 我的技能 ──' },
      ...skillCompletions,
      { key: 'new-skill', label: '+ 新建技能' },
    ];
  }, [activeKey]);

  /** Hashtag 补全池（选择范围功能） */
  const hashtagCompletions = useMemo(() => {
    const tm = tableModelRef.current;
    if (!tm) return [];

    // 提供表格范围选项
    const columnNames: string[] = [];
    for (let c = 0; c < tm.colCount; c++) {
      columnNames.push(tm.valueByCell[`header-${c}`] ?? `第${c + 1}列`);
    }

    return [
      { key: 'hashtag-full', label: '全表数据' },
      { key: 'hashtag-selection', label: '选中区域' },
      { key: 'hashtag-separator', label: '── 按列 ──' },
      ...columnNames.map((name, idx) => ({
        key: `hashtag-col-${idx}`,
        label: name,
      })),
    ];
  }, [activeKey]);

  /** Hashtag 选择回调 */
  const onHashtagPick = useCallback((label: string) => {
    // 可以用于设置操作范围
    console.log('选择范围:', label);
  }, []);

  /** 技能选择回调 */
  const onSkillPick = useCallback((label: string) => {
    // 判断是否选择了技能
    if (label.startsWith('📌')) {
      const skillName = label.replace('📌 ', '');
      // 返回技能调用指令，由 onVtellSend 处理
      return `使用技能：${skillName}`;
    }
    if (label === '+ 新建技能') {
      return '新建技能';
    }
    return label;
  }, []);

  /** 更新当前表格的对话历史 */
  const updateActiveChatHistory = useCallback(
    (messages: VtellMessage[]) => {
      setChatHistories((prev) => ({ ...prev, [activeKey]: messages }));
    },
    [activeKey]
  );

  /** Vtell onSend 回调：包含完整 L0/L1/L2 Agent 路由逻辑 */
  const onVtellSend = useCallback(
    async (text: string, files: VtellAttachedFile[], tags: VInputCommandTag[]) => {
      if (!text && files.length === 0 && tags.length === 0) return;

      const attachNote =
        files.length > 0 ? `[附件: ${files.map((a) => a.file.name).join(', ')}]` : '';
      // 只有标签时 content 为空，VTellMessageBubble 不显示气泡
      // 只有文件时 content 为空
      // 有文本时 content 为文本
      const userContent = text || '';

      const userMsg: VtellMessage = { id: uid(), role: 'user', content: userContent, tags, files };
      const loadingId = uid();
      const loadingMsg: VtellMessage = { id: loadingId, role: 'assistant', content: '', status: 'loading' };

      // 创建 AbortController 用于撤回
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setChatSending(true);
      updateActiveChatHistory([...activeMessages, userMsg, loadingMsg]);

      // 超时提示：10秒后显示等待中提示
      const timeoutHintId = setTimeout(() => {
        setChatHistories((prev) => {
          const current = prev[activeKey] ?? [];
          const loadingMsg = current.find((msg) => msg.id === loadingId);
          // 只有还在 loading 状态才更新
          if (loadingMsg?.status === 'loading') {
            return {
              ...prev,
              [activeKey]: current.map((msg) =>
                msg.id === loadingId ? { ...msg, content: '模型正在处理中，请稍候...' } : msg
              ),
            };
          }
          return prev;
        });
      }, 10000);

      const finishAssistant = (content: string) => {
        clearTimeout(timeoutHintId);
        abortControllerRef.current = null;
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

      // 检查是否已取消
      const checkCancelled = () => abortController.signal.aborted;

      try {
        // 0. 处理技能调用
        if (text.startsWith('使用技能：')) {
          const skillName = text.replace('使用技能：', '').trim();
          const tm = tableModelRef.current;
          if (!tm) throw new Error('表格尚未就绪');

          // 查找技能
          const allSkills = [...PRESET_SKILLS, ...getAllSkills()];
          const skill = allSkills.find(s => s.name === skillName);

          if (!skill) {
            finishAssistant(`未找到技能「${skillName}」。`);
            return;
          }

          // 检查前置条件
          const selectedRows = getSelectedBodyRows(tm);
          const hasSelection = selectedRows.length > 0;
          const columnNames: string[] = [];
          for (let c = 0; c < tm.colCount; c++) {
            columnNames.push(tm.valueByCell[`header-${c}`] ?? `第${c + 1}列`);
          }

          const checkResult = checkSkillRequirements(skill, {
            hasSelection,
            rowCount: tm.rowCount,
            colCount: tm.colCount,
            columnNames,
          });

          if (!checkResult.passed) {
            finishAssistant(checkResult.message || '技能执行条件不满足。');
            return;
          }

          // 执行技能
          const execResult = executeSkill(skill, {}, {
            colCount: tm.colCount,
            columnNames,
          });

          if (!execResult.success) {
            finishAssistant(execResult.error || '技能执行失败。');
            return;
          }

          // 执行动作
          const execReport = executeTableActions(tm, execResult.actions, { rowCountRef, colCountRef });

          let aggNote = '';
          if (execReport.aggregateResult) {
            const agg = execReport.aggregateResult;
            const aggNameMap: Record<string, string> = {
              sum: '总和', avg: '平均值', max: '最大值', min: '最小值', count: '数量',
            };
            const aggName = aggNameMap[agg.aggType] || agg.aggType;
            const valueFormatted = Number.isFinite(agg.result)
              ? (Number.isInteger(agg.result) ? agg.result.toLocaleString('zh-CN') : agg.result.toLocaleString('zh-CN', { maximumFractionDigits: 2 }))
              : '无法计算';
            aggNote = `\n\n📊 ${aggName}：${valueFormatted}`;
          }

          finishAssistant(`${execResult.reply}${aggNote}`);
          return;
        }

        // 1. 处理附件导入
        if (files.length > 0) {
          for (const a of files) {
            await onImportFileAsNewTable(a.file);
          }
        }

        // 只有 files 没有 text 和 tags 时才返回
        if (!text && tags.length === 0) {
          finishAssistant(`已导入 ${files.length} 个表格附件。`);
          return;
        }

        const tm = tableModelRef.current;
        if (!tm) throw new Error('表格尚未就绪');

        // 合成完整指令：标签 + 文本（如"查找关键词" + "新款" = "查找关键词新款"）
        const tagPart = tags.map((t) => t.label).join('');
        const agentText = (tagPart + text).trim();

        // ===== 新路由逻辑 =====
        // 0. 兜底：处理无效确认/取消指令（避免触发 LLM 调用）
        if (agentText === '确认' || agentText === '取消' || agentText === '执行' || agentText === '放弃') {
          finishAssistant('当前没有待确认的操作。请先发送筛选指令。');
          return;
        }

        // 1. 重置筛选：恢复原始数据
        if (agentText === '重置' || agentText === '显示全部' || agentText === '清除筛选') {
          const savedSnapshot = filterSnapshots[activeKey];
          if (!savedSnapshot) {
            finishAssistant('当前没有筛选状态，无需重置。');
            return;
          }

          // 恢复原始数据
          tm.startUndoBatch();
          tm.setRowCount(savedSnapshot.rowCount);
          tm.setColCount(savedSnapshot.colCount);
          tm.setValueByCell(savedSnapshot.valueByCell);
          tm.endUndoBatch();

          // 清除筛选快照
          setFilterSnapshots(prev => {
            const next = { ...prev };
            delete next[activeKey];
            return next;
          });

          finishAssistant(`✅ 已重置筛选，恢复 ${savedSnapshot.rowCount} 行原始数据。`);
          return;
        }

        // 2. 筛选指令：无损筛选，支持多轮筛选
        if (isFilterCommand(agentText)) {
          const keyword = extractFilterKeyword(agentText);
          if (!keyword || keyword.length === 0) {
            finishAssistant('请输入要筛选的关键词。');
            return;
          }

          // 遍历当前数据，找出包含关键词的行
          const matchedRows = new Set<number>();
          for (let r = 0; r < tm.rowCount; r++) {
            for (let c = 0; c < tm.colCount; c++) {
              const cellKey = `${r}-${c}`;
              const headerKey = `header-${c}`;
              const cellValue = tm.valueByCell[cellKey] ?? '';
              const headerValue = tm.valueByCell[headerKey] ?? '';
              if (cellValue.includes(keyword) || headerValue.includes(keyword)) {
                matchedRows.add(r);
              }
            }
          }

          if (matchedRows.size === 0) {
            finishAssistant(`未找到包含"${keyword}"的数据。`);
            return;
          }

          const currentRows = tm.rowCount;
          if (matchedRows.size >= currentRows) {
            finishAssistant(`筛选"${keyword}"匹配了全部 ${currentRows} 行，无需筛选。`);
            return;
          }

          // 第一次筛选时保存原始数据快照
          const hasExistingFilter = filterSnapshots[activeKey] != null;
          if (!hasExistingFilter) {
            const originalSnapshot = snapshotFromModel(tm);
            setFilterSnapshots(prev => ({ ...prev, [activeKey]: originalSnapshot }));
          }

          // 构建筛选后的数据（只保留匹配行）
          const newValueByCell: Record<string, string> = {};
          // 保留表头
          for (let c = 0; c < tm.colCount; c++) {
            newValueByCell[`header-${c}`] = tm.valueByCell[`header-${c}`] ?? '';
          }
          // 保留匹配行（重新编号）
          const matchedRowList = [...matchedRows].sort((a, b) => a - b);
          for (let newR = 0; newR < matchedRowList.length; newR++) {
            const oldR = matchedRowList[newR];
            for (let c = 0; c < tm.colCount; c++) {
              newValueByCell[`${newR}-${c}`] = tm.valueByCell[`${oldR}-${c}`] ?? '';
            }
          }

          // 无损筛选：替换数据（不删除行）
          tm.startUndoBatch();
          tm.setRowCount(matchedRowList.length);
          tm.setValueByCell(newValueByCell);
          tm.endUndoBatch();

          finishAssistant(
            `✅ **筛选完成**（无损）\n\n` +
            `关键词："${keyword}"\n` +
            `当前：${matchedRows.size} 行（筛选前 ${currentRows} 行）\n\n` +
            `可继续筛选，发送「重置」恢复原始数据。`
          );
          return;
        }

        // 2. 操作指令：需要检测选中状态
        if (isOperationCommand(agentText)) {
          const store = cellSelectionStoreRef.current;
          const selectedCells = store?.getSelectedCells();

          if (!selectedCells || selectedCells.size === 0) {
            finishAssistant('请先选择表格的生效范围。');
            return;
          }

          // 有选中，继续执行 Agent 路由
        }

        // 3. 特殊指令：不依赖选中，继续执行 Agent 路由（新增行/列、清除筛选等）

        // 4. 路由分发 (Dispatcher)
        const historyForAgent: ChatMessage[] = [...activeMessages, userMsg].map(({ role, content }) => ({
          role: role as any,
          content,
        }));

        const tableSnapshot: TableSnapshot = {
          tableKey: activeKey,
          tableLabel: activeTableLabel,
          valueByCell: { ...tm.valueByCell },
          rowCount: tm.rowCount,
          colCount: tm.colCount,
          enableShowRowIndex: tm.enableShowRowIndex,
          tableFlags: { ...activeTableState.tableFlags },
        };

        const result = await dispatchTableAgent(agentText, historyForAgent, tm, tableSnapshot, chatLlm, abortController.signal);

        // 检查是否已取消
        if (checkCancelled()) {
          finishAssistant('请求已取消。');
          return;
        }

        // 3. 执行动作 (Executor)
        const execReport = executeTableActions(tm, result.actions, { rowCountRef, colCountRef });

        // 4. 合成回复
        const importNote = files.length > 0 ? `（发送前已导入附件：${files.map((a) => a.file.name).join('、')}）\n\n` : '';
        const fallbackNote = result.reason ? `（${result.reason}）\n\n` : '';

        // 统计结果单独展示
        let aggNote = '';
        if (execReport.aggregateResult) {
          const agg = execReport.aggregateResult;
          const aggNameMap: Record<string, string> = {
            sum: '总和',
            avg: '平均值',
            max: '最大值',
            min: '最小值',
            count: '数量',
          };
          const aggName = aggNameMap[agg.aggType] || agg.aggType;
          const valueFormatted = Number.isFinite(agg.result)
            ? (Number.isInteger(agg.result) ? agg.result.toLocaleString('zh-CN') : agg.result.toLocaleString('zh-CN', { maximumFractionDigits: 2 }))
            : '无法计算';
          if (agg.colName) {
            aggNote = `\n\n📊 「${agg.colName}」${aggName}：${valueFormatted}`;
          } else {
            aggNote = `\n\n📊 ${aggName}：${valueFormatted}`;
          }
        }

        const execExtra = formatExecutionReport(execReport);
        const routeFoot = `\n\n（路由：${result.route}，耗时：${result.elapsedMs}ms${result.confidence ? `，置信度：${result.confidence.toFixed(2)}` : ''}）`;

        if (result.route === 'L0' || result.route === 'L1') {
          setChatLlm('automation_rules');
        } else if (chatLlm === 'automation_rules') {
          setChatLlm('qwen'); // L2 fallback 自动切换
        }

        finishAssistant(`${importNote}${fallbackNote}${result.reply}${aggNote}${execExtra}${routeFoot}`);
      } catch (e) {
        finishAssistant(`处理失败：${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [
      activeMessages,
      activeKey,
      activeTableLabel,
      activeTableState.tableFlags,
      chatLlm,
      onImportFileAsNewTable,
      rowCountRef,
      colCountRef,
      tableModelRef,
      updateActiveChatHistory,
      filterSnapshots,
    ]
  );

  return (
    <Layout style={{ height: '100%', background: vcTokens.color.neutral.background.layout }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Content
          style={{
            flex: 1,
            minHeight: 0,
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CustomTabs
            items={items}
            onItemsChange={onTabsItemsChange}
            activeKey={activeKey}
            onActiveKeyChange={onTabsActiveKeyChange}
            showIcon
            activeTabFieldConfig={activeTabFieldConfig}
            onAddMenuImportTableFile={onImportFileAsNewTable}
            onConfigMenuImportTableFile={onImportFileToCurrentTable}
            onAddMenuGoods={onCreateGoodsTable}
            rightSlot={
              <Button
                type="text"
                icon={<VcIcon type={vtellVisible ? 'chevron-right.double' : 'chevron-left.double'} fontSize={16} />}
                onClick={() => setVtellVisible(prev => !prev)}
              />
            }
          />
          <div
            ref={mainRowRef}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              flex: 1,
              minHeight: 0,
              width: '100%',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: MAIN_PANEL_MIN_WIDTH_PX,
                minHeight: 0,
                padding: 16,
                boxSizing: 'border-box',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: vcTokens.color.neutral.background.container,
              }}
            >
              {/* 表格工具栏 */}
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                <Popover
                  arrow={false}
                  open={filterPopoverOpen}
                  onOpenChange={(open) => {
                    setFilterPopoverOpen(open);
                    if (open) {
                      // 面板打开时从 tableModelRef 读取最新的表头字段
                      const tm = tableModelRef.current;
                      if (tm) {
                        const options: { value: number; label: string }[] = [];
                        for (let c = 0; c < tm.colCount; c++) {
                          // 与 vc-biz TableRows 一致：header-{c} 或默认 "列 {c+1}"
                          const headerName = tm.valueByCell[`header-${c}`] ?? `列 ${c + 1}`;
                          options.push({ value: c, label: headerName });
                        }
                        setColumnOptionsState(options);
                      }
                    }
                  }}
                  trigger="click"
                  placement="bottomLeft"
                  content={
                    <div style={{ minWidth: 420 }}>
                      {/* 条件列表 */}
                      {filterConditions.map((cond) => (
                        <div
                          key={cond.id}
                          style={{
                            marginBottom: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          {/* 字段选择器 */}
                          <Select
                            value={cond.fieldIndex}
                            onChange={(value) => updateConditionField(cond.id, value)}
                            options={columnOptionsState}
                            style={{ width: 140 }}
                            suffixIcon={<VcIcon type="chevron-down" fontSize={16} />}
                          />
                          {/* 计算选择器 */}
                          <Select
                            value={cond.operator}
                            onChange={(value) => updateConditionOperator(cond.id, value)}
                            options={FILTER_OPERATOR_OPTIONS}
                            style={{ width: 120 }}
                            suffixIcon={<VcIcon type="chevron-down" fontSize={16} />}
                          />
                          {/* 变量输入框（为空/不为空时不显示） */}
                          {cond.operator !== '为空' && cond.operator !== '不为空' && (
                            <Input
                              value={cond.value}
                              onChange={(e) => updateConditionValue(cond.id, e.target.value)}
                              placeholder="输入值"
                              style={{ width: 140 }}
                            />
                          )}
                          {/* 删除按钮 */}
                          <VcIcon
                            type="close"
                            fontSize={14}
                            style={{
                              cursor: 'pointer',
                              color: vcTokens.color.neutral.text.icon,
                            }}
                            onClick={() => removeCondition(cond.id)}
                          />
                        </div>
                      ))}
                      {/* 添加条件按钮 */}
                      <Button
                        type="text"
                        icon={<VcIcon type="add" fontSize={16} />}
                        onClick={addCondition}
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'center',
                        }}
                      >
                        添加条件
                      </Button>
                    </div>
                  }
                >
                  <Button
                    type="text"
                    style={filterPopoverOpen ? {
                      background: vcTokens.color.neutral.background.controlItemBgHover,
                    } : undefined}
                  >
                    筛选{filterConditions.length > 0 ? ` (${filterConditions.length})` : ''} <VcIcon type="chevron-down" fontSize={14} />
                  </Button>
                </Popover>
              </div>
              <TableColumn
                key={activeKey}
                {...refs}
                initial={activeTableState}
                onTabFieldConfigChange={onTabFieldConfigChange}
              />
            </div>
            {vtellVisible && (
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
            )}
            {vtellVisible && (
              <Vtell
                messages={activeMessages}
                sending={chatSending}
                onSend={onVtellSend}
                onCancel={handleCancel}
                widthPx={chatPanelWidthPx}
                llmOptions={CHAT_LLM_OPTIONS}
                llmValue={chatLlm}
                onLlmChange={setChatLlm}
                placeholder={CHAT_INPUT_PLACEHOLDER}
                l0Completions={l0Completions as any}
                onL0CompletionPick={(text) => {
                  const processed = onSkillPick(text);
                  if (processed !== text) {
                    // 触发技能执行
                    onVtellSend(processed, [], []);
                  }
                }}
                commandTags={selectionTags}
                onCommandTagsChange={setSelectionTags}
              />
            )}
          </div>
        </Content>
      </div>
    </Layout>
  );
}
