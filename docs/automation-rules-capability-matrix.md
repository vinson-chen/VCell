# Automation Rules Capability Matrix (Single Source of Truth)

> 以「50 条规则总览」为主目录，统一维护每条能力的状态、路由与回归测试。

**L0 核心定位**：筛选条件批量操作
- 筛选条件类型：列值条件、正则匹配、选中行状态、空值判断、多列组合
- 批量操作类型：删除行、清空列、数值变换、文本替换

字段说明：

- `status`: `implemented` | `partial` | `planned`
- `route`: 当前主路由（`L0` / `L1` / `L2`）
- `tests`: 已落地的测试用例（无则 `-`）
- `phase`: 归属迭代阶段

## A. 筛选条件批量操作（新增核心能力）

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| A1 | 删除第N列包含X的行 | implemented | L0 | - | Phase4 |
| A2 | 删除第N列等于X的行 | implemented | L0 | - | Phase4 |
| A3 | 删除第N列数值大于X的行 | implemented | L0 | - | Phase4 |
| A4 | 删除第N列数值小于X的行 | implemented | L0 | - | Phase4 |
| A5 | 删除第N列数值大于等于X的行 | implemented | L0 | - | Phase4 |
| A6 | 删除第N列数值小于等于X的行 | implemented | L0 | - | Phase4 |
| A7 | 删除第N列匹配正则X的行 | implemented | L0 | - | Phase4 |
| A8 | 删除第N列为空的行 | implemented | L0 | - | Phase4 |
| A9 | 删除第N列非空的行 | implemented | L0 | - | Phase4 |
| A10 | 删除多列组合条件满足的行（AND/OR） | implemented | L0 | - | Phase4 |
| A11 | 清空满足条件行的指定列 | implemented | L0 | - | Phase4 |
| A12 | 对满足条件行进行数值变换（折扣） | implemented | L0 | - | Phase4 |
| A13 | 替换满足条件行的文本 | implemented | L0 | - | Phase4 |

## B. 选中行批量操作（筛选条件：选中状态）

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| B1 | 删除选中行 | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| B2 | 清空选中行内容 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |
| B3 | 选中行数值变换（加减乘除/折扣） | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| B4 | 选中行保留小数/取整 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| B5 | 选中行去首尾空格 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |
| B6 | 选中行统一大小写 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |
| B7 | 选中行填充空单元格 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |
| B8 | 选中行替换文本 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |

## C. 全表批量操作

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| C1 | 删除空行 | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| C2 | 删除空列 | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| C3 | 清空全表内容（保留表头） | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| C4 | 全表替换文本（A→B） | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| C5 | 全表去首尾空格 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |
| C6 | 全表统一大小写 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |
| C7 | 全表填充空单元格 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |

## D. 列级批量操作

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| D1 | 清空指定列 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| D2 | 列内替换文本 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| D3 | 列数值变换（加减乘除/折扣/百分比） | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| D4 | 列保留小数/取整 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| D5 | 列去首尾空格 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |
| D6 | 列统一大小写 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |
| D7 | 列填充空单元格 | implemented | L0 | `quickCommandRules.test.ts` | Phase2 |
| D8 | 列单位换算（元→分、kg→g） | implemented | L0 | `quickCommandRules.test.ts` | Phase3 |

## E. 筛选保留操作

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| E1 | 筛选保留等于某值的行 | implemented | L0 | `quickCommandRules.test.ts` | Phase3 |
| E2 | 筛选保留包含关键词的行 | implemented | L0 | `quickCommandRules.test.ts` | Phase3 |
| E3 | 筛选保留数值区间内行 | implemented | L0 | `quickCommandRules.test.ts` | Phase3 |
| E4 | 清除筛选 | implemented | L0 | `quickCommandRules.test.ts` | Phase3 |

## F. 排序去重操作

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| F1 | 按单列升序/降序 | implemented | L0 | `quickCommandRules.test.ts` | Phase3 |
| F2 | 按多列排序（优先级） | implemented | L0 | `quickCommandRules.test.ts` | Phase3 |
| F3 | 按指定列组合去重 | implemented | L0 | `quickCommandRules.test.ts` | Phase3 |
| F4 | 去重后保留首条/末条 | implemented | L0 | `quickCommandRules.test.ts` | Phase3 |

## G. 列格式操作

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| G1 | 重命名列表头 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| G2 | 批量重命名多列表头 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| G3 | 交换两列位置 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| G4 | 按给定顺序重排列顺序 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| G5 | 隐藏/显示指定列 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| G6 | 显示全部隐藏列 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |

## H. 视图开关操作

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| H1 | 开启/关闭行号显示 | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| H2 | 开启/关闭编辑模式 | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| H3 | 开启/关闭插入行列能力 | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| H4 | 开启/关闭冻结首列/末列/末行 | implemented | L0 | `quickCommandRules.test.ts` | Phase0+ |
| H5 | 开启/关闭垂直居中 | partial | L0/L1 | `quickCommandRules.test.ts` | Phase0+ |

## I. 结构操作（简单操作，L2 备选）

> 注：以下操作表格 UI 已有直接入口（插入按钮、右键菜单），对话效率相对较低。

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| I1 | 新增 N 行（末尾追加） | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| I2 | 新增 N 列（末尾追加） | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| I3 | 在指定位置插入 N 行 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| I4 | 在指定位置插入 N 列 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| I5 | 删除第 N 行 | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| I6 | 删除第 N 列 | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| I7 | 删除第 A-B 行（区间） | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |
| I8 | 删除第 A-B 列（区间） | implemented | L0 | `quickCommandRules.test.ts` | Phase0 |

## Maintenance Rules

- 本文档是规则能力状态的唯一真源；每次规则实现/回归变更必须同步本文档。
- L0 上限按"意图规则数"计数，硬上限 50。
- 新增 L0 意图必须同时补：
  - schema 规则项
  - 冲突样例
  - 至少 1 条可执行测试
| 26 | 指定列全部除 X | implemented | L0 | `quickCommandRules.test.ts`（数值类，含选中行） | Phase1 |
| 27 | 指定列打 N 折 | implemented | L0 | `quickCommandRules.test.ts`（数值类，含选中行） | Phase0 |
| 28 | 指定列上调 X% | implemented | L0 | `quickCommandRules.test.ts`（数值类，含选中行） | Phase0 |
| 29 | 指定列下调 X% | implemented | L0 | `quickCommandRules.test.ts`（数值类，含选中行） | Phase0 |
| 30 | 指定列保留 N 位小数 | implemented | L0 | `quickCommandRules.test.ts`（数值类，含选中行） | Phase1 |
| 31 | 指定列四舍五入到整数 | implemented | L0 | `quickCommandRules.test.ts`（数值类，含选中行） | Phase1 |
| 32 | 数值列统一单位换算（元→分、kg→g） | implemented | L0 | `quickCommandRules.test.ts`（单位换算） | Phase3 |

## D. 排序筛选（33-40）

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| 33 | 按单列升序 | implemented | L0 | `quickCommandRules.test.ts`（排序筛选） | Phase3 |
| 34 | 按单列降序 | implemented | L0 | `quickCommandRules.test.ts`（排序筛选） | Phase3 |
| 35 | 按多列排序（优先级） | implemented | L0 | `quickCommandRules.test.ts`（排序筛选） | Phase3 |
| 36 | 仅显示等于某值的行 | implemented | L0 | `quickCommandRules.test.ts`（排序筛选） | Phase3 |
| 37 | 仅显示包含某关键词的行 | implemented | L0 | `quickCommandRules.test.ts`（排序筛选） | Phase3 |
| 38 | 仅显示数值区间内行（>=A 且 <=B） | implemented | L0 | `quickCommandRules.test.ts`（排序筛选） | Phase3 |
| 39 | 清除筛选，恢复全量 | partial | L0/L2 | `quickCommandRules.test.ts`（清除筛选口令） | Phase3 |
| 40 | 仅保留筛选结果并删除其余行 | implemented | L0 | `quickCommandRules.test.ts`（排序筛选） | Phase3 |

## E. 列与格式（41-46）

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| 41 | 重命名第 N 列表头 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| 42 | 批量重命名多列表头 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| 43 | 交换两列位置 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| 44 | 按给定顺序重排列顺序 | implemented | L0 | `quickCommandRules.test.ts` | Phase1 |
| 45 | 隐藏指定列 / 取消隐藏 | implemented | L0 | `quickCommandRules.test.ts`（rule 45） | Phase1 |
| 46 | 冻结首行/首列/末列/末行（开关） | partial | L0 | `quickCommandRules.test.ts`（首列/末列/末行；首行待 vc-biz） | Phase0+ |

## F. 视图与保护（47-50）

| # | 规则 | status | route | tests | phase |
|---|---|---|---|---|---|
| 47 | 开启/关闭行号显示 | implemented | L0 | `quickCommandRules.test.ts`（开关类） | Phase0 |
| 48 | 开启/关闭编辑模式（只读切换） | implemented | L0 | `quickCommandRules.test.ts`（开关类） | Phase0 |
| 49 | 开启/关闭插入行列能力 | implemented | L0 | `quickCommandRules.test.ts`（开关类） | Phase0 |
| 50 | 开启/关闭自动换行（或垂直居中） | partial | L0/L1 | `quickCommandRules.test.ts`（垂直居中） | Phase0+ |

## Maintenance Rules

- 本文档是规则能力状态的唯一真源；每次规则实现/回归变更必须同步本文档。
- L0 上限按“意图规则数”计数，硬上限 50。
- 新增 L0 意图必须同时补：
  - schema 规则项
  - 冲突样例
  - 至少 1 条可执行测试

