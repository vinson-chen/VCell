# VCell 计划与现状

> **治理（必须遵守）**  
> - **每一轮迭代计划**（范围、优先级、任务拆分）与 **验收标准**，**必须经产品负责人明确确认** 后方可视为生效；未确认内容仅作草案，不视为对交付的承诺。  
> - 本文档及 AI 生成的「下一步」列表均为 **建议草稿**，以你确认后的版本为准。  
> - 与 Cursor **Plans** 中的《VCell MVP 技术架构》等文档并存时：**Plans = 战略/约束母本**；本仓库 `plan.md` = **可执行现状 + 待你确认的迭代草案**。若你从 Plans 导出全文，建议保存为 `docs/mvp-architecture.md` 并在本节下方增加链接，便于团队单一事实来源。

---

## MVP 目标与约束（与架构计划对齐）

以下摘要对应《VCell MVP 技术架构》类文档中的「目标与约束」，具体表述以你确认的母版为准。

| 维度 | 说明 |
|------|------|
| **范式** | 用户通过自然语言对话 + 类 Excel 自由表格定义字段、视图与简单逻辑；避免「固定业务菜单式」表单产品形态。 |
| **数据域** | 多电商平台（淘宝、抖音等）商品/订单等统一进入同一 **Workspace**；MVP 可先 1～2 个数据源或 Mock/CSV，以降低 OAuth 与合规阻塞。 |
| **客户端** | Web 优先；桌面端后续可复用同一套 API。 |

---

## 表格引擎（架构决策）

- **继续采用 [TanStack Table](https://tanstack.com/table) 作为表格引擎（核心层）**。列定义、排序/筛选/分页、虚拟化、与数据模型的绑定等应以 TanStack Table 为基准设计与演进。  
- **当前仓库状态**：主界面演示仍为 **`vc-biz` 的 `BizTable`**（基于现有 `TableRows` 网格实现，与 Figma/设计系统对齐），**尚未**在主路径接入 TanStack Table。  
- **演进原则**：后续迭代在 **你确认的计划与验收标准** 下，将 **数据与交互内核** 与 TanStack Table 对齐，或分阶段把 BizTable 的「壳与视觉」与 TanStack 内核组合；**不得在未确认迭代中擅自替换为与 TanStack 无关的另一套自研网格作为长期引擎**。

---

## 前端技术边界（必须遵守）

1. **`vc-design`**：基础设计系统、主题 Token（`vcTokens`）、`VcConfigProvider`，以及从 `vc-design` 再导出的 Ant Design 5 原子组件。**业务代码不要 `import … from 'antd'`**，一律经 `vc-design` 引入。  
2. **`vc-biz`**：业务复合能力。当前表格 **展示与交互壳** 使用 `BizTable` + `useTableAreaDemoState`；顶栏结构使用 `TopBar`（内部 `OperationBar`）。不在业务侧自造与上述等价的顶栏壳子；表格 **引擎层** 按上节以 TanStack Table 为方向演进。  
3. **`VcIcon`**：所有图标统一 `VcIcon`。**禁止**在业务与 vc-biz 表格等场景使用 `@ant-design/icons`。  
4. **基础设施（可保留）**：`react` / `react-dom`、`vite`、`dayjs`、`index.html` 外链字体等。

**依赖说明**：`apps/web` 可声明 `antd` 以满足 `vc-design` peer；实现层仅通过 `vc-design` 使用。TanStack Table 相关依赖 **待你确认的迭代** 中纳入 `package.json` 与验收项。

---

## 已实际落地的范围（截至当前仓库）

### 前端 `apps/web`

- **壳层**：`Layout` + `Content`；左侧表格、右侧对话；表格区域 `Flex` `align="start"` + `overflow: auto`，避免插入行列模式下横向撑满导致插入列被挤出视口。  
- **顶栏**：`components/TopBar.tsx` 仅负责 Figma 内容（品牌「VCell」+ Agbalumo + 用户 `Avatar`）；**结构**使用 **`vc-biz` `TopBar`**。  
- **表格（演示层）**：**`BizTable`**，默认开关含列宽拖拽、垂直居中、冻结首列、序号、插入行列、编辑模式；初始单元格 `data/figmaTableCells.ts`。  
- **对话**：规则识别示例指令（如标题列 `2025 → 2026`），助手回复含「这里是AI的回答」；**未接大模型**。  
- **图标**：**`VcIcon`**（如 `send`、`user`）。  
- **样式**：`vc-design` / `vc-biz` 的 `dist` CSS + `VcConfigProvider`。

### 设计系统侧（`vc-design` / `packages/vc-biz`）

- **BizTable**：`useTableGridEditing`、`valueByCell` 受控、插入行列 **`VcIcon type="add"`** 等。  
- **`TopBar`**（`OperationBar`）、**`TopOperationBar`**（搜索 + 溢出操作）。  
- **iconfont**：全量 `@import` 官方项目样式 + 必要时 `edit` 覆盖。

### 后端 `apps/api`

- Fastify：**`GET /api/health`**；无表格/对话 BFF。

### `packages/shared`

- 占位常量，随迭代扩展。

---

## 与历史决策的关系（避免歧义）

- 曾为主路径 **剥离** TanStack、React Query、Zustand、旧 mock 订单表等，是为了 **缩小 MVP 演示面**；**不表示**放弃 TanStack Table 作为 **长期表格引擎**。  
- **当前**：演示用 BizTable；**架构目标**：TanStack Table 作为引擎；**落地节奏与验收**以你确认的迭代为准。

---

## 待你确认的下一步迭代（草案 · 非承诺）

> 下列顺序与范围 **默认无效**，直至你逐条确认或修订。确认时请标明：迭代名、范围、**验收标准（可测试）**、是否引入 `@tanstack/react-table` 等依赖。

1. **迭代 T-1（草案）**：在 `apps/web` 中引入 TanStack Table，与现有 `BizTable` 视觉/交互对齐的最小 POC（例如只读 + 一列排序），**验收标准**：由你确认。  
2. **规范巡检**：CI grep 禁止业务目录 `from 'antd'`、`@ant-design/icons`（白名单除外）。  
3. **对话 BFF**：`apps/api` 路由；规则引擎 → 可选 LLM + 工具/schema diff；**验收标准**：由你确认。  
4. **持久化与多工作区**：元数据 + 行存储 API；**验收标准**：由你确认。  
5. **连接器**：Mock/CSV、`source_platform` / `external_id`；**验收标准**：由你确认。  
6. **字体**：Agbalumo 本地化（内网）；**验收标准**：由你确认。  
7. **E2E / 冒烟**：顶栏、表格插入列、对话改表；**验收标准**：由你确认。

---

## 本地开发

- 仅前端：`npm run dev`（workspace：`vcell-web`）。  
- 前后端：`npm run dev:all`。  
- 本地 `vc-design` / `vc-biz`：修改后需在对应包执行 `npm run build` 更新 `dist`。
