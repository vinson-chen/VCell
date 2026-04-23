# Automation Rules Conflict Samples

用于长期维护 L0 规则冲突与回归，按「意图规则」而非正则条目管理。

列索引约定（非常重要）：

- `第1列` / `首列` 均指 **checkbox 列右侧第一列**（即界面显示的 `列 1`）。
- checkbox 列与行号列不计入业务列序号。

## Insert-at

- `在第3行前插入2行` -> `insert_rows_at(index=2,count=2)`（L0）
- `第3行前加2行` -> `insert_rows_at(index=2,count=2)`（L0）
- `在第3行后插入2行` -> `insert_rows_at(index=3,count=2)`（L0）
- `第3行后加2行` -> `insert_rows_at(index=3,count=2)`（L0）
- `在第2列左侧插入1列` -> `insert_columns_at(index=1,count=1)`（L0）
- `第2列左边加1列` -> `insert_columns_at(index=1,count=1)`（L0）
- `在第2列右侧插入1列` -> `insert_columns_at(index=2,count=1)`（L0）
- `第2列右边加1列` -> `insert_columns_at(index=2,count=1)`（L0）

## Clear

- `清空所有表体` -> `clear_all_body`（L0）
- `把表体都清空` -> `clear_all_body`（L0）
- `清空选中行内容` -> `clear_selected_rows`（L0）
- `清空首列` -> `clear_column(colIndex=0)`（L0，首列=列1）
- `清空第3列` -> `clear_column(colIndex=2)`（L0）
- `把第3列都清空` -> `clear_column(colIndex=2)`（L0）
- `清空第5行` -> `clear_row(rowIndex=4)`（L0）

## Replace

- `把第2列“旧”替换为“新”` -> `replace_text_in_column(colIndex=1,find=旧,replace=新)`（L0）
- `把首列“旧”替换为“新”` -> `replace_text_in_column(colIndex=0,find=旧,replace=新)`（L0）
- `将第2列"旧"改成"新"` -> 同上（L0）
- `把全表“旧”替换为“新”` -> `replace_text_in_all_body(find=旧,replace=新)`（L0）
- `将所有单元格"旧"改成"新"` -> 同上（L0）
- `把选中行“旧”替换为“新”` -> `replace_text_in_selected_rows(find=旧,replace=新)`（L0）
- `将选中行"旧"清空` -> `replace_text_in_selected_rows(find=旧,replace='')`（L0）

## Selected rows batch

- `删除选中行` -> `delete_selected_rows`（L0）
- `删除当前勾选行` -> `delete_selected_rows`（L0）
- `去除选中行首尾空格` -> `trim_whitespace_in_selected_rows`（L0）
- `把选中行转成大写` -> `normalize_case_in_selected_rows(mode=upper)`（L0）
- `把已勾选行转成小写` -> `normalize_case_in_selected_rows(mode=lower)`（L0）
- `清空勾选行内容` -> `clear_selected_rows`（L0）
- `帮我把勾选行清掉` -> `clear_selected_rows`（L0）
- `把选中行空单元格填充为“未配置”` -> `fill_empty_in_selected_rows(value=未配置)`（L0）
- `把勾选行里的空白补成“未配置”` -> `fill_empty_in_selected_rows(value=未配置)`（L0）
- `把选中行都除以2` -> `numeric_transform_in_selected_rows(op=multiply,value=0.5)`（L0）
- `把勾选行都除以2` -> `numeric_transform_in_selected_rows(op=multiply,value=0.5)`（L0）
- `把选中行打8折` -> `numeric_transform_in_selected_rows(op=multiply,value=0.8)`（L0）
- `把选中行上调10%` -> `numeric_transform_in_selected_rows(op=multiply,value=1.1)`（L0）
- `把选中行加5` -> `numeric_transform_in_selected_rows(op=add,value=5)`（L0）
- `把选中行保留2位小数` -> `round_in_selected_rows(decimals=2)`（L0）
- `把选中行四舍五入到整数` -> `round_in_selected_rows(decimals=0)`（L0）

## First-column aliases

- `去除首列首尾空格` -> `trim_whitespace_in_column(colIndex=0)`（L0）
- `把首列转成大写` -> `normalize_case_in_column(colIndex=0,mode=upper)`（L0）
- `把首列空单元格填充为“未配置”` -> `fill_empty_in_column(colIndex=0,value=未配置)`（L0）
- `把首列都除以2` -> `column_numeric_transform(colIndex=0,op=multiply,value=0.5)`（L0）
- `首列保留2位小数` -> `column_round(colIndex=0,decimals=2)`（L0）
- `首列四舍五入到整数` -> `column_round(colIndex=0,decimals=0)`（L0）

## Last-column aliases

- `清空末列` -> `clear_column(colIndex=last)`（L0）
- `去除末列首尾空格` -> `trim_whitespace_in_column(colIndex=last)`（L0）
- `把最后一列转成小写` -> `normalize_case_in_column(colIndex=last,mode=lower)`（L0）
- `把末列空单元格填充为“未配置”` -> `fill_empty_in_column(colIndex=last,value=未配置)`（L0）
- `把末列“旧”替换为“新”` -> `replace_text_in_column(colIndex=last,find=旧,replace=新)`（L0）
- `把最后一列“旧”清空` -> `replace_text_in_column(colIndex=last,find=旧,replace='')`（L0）
- `把末列都除以2` -> `column_numeric_transform(colIndex=last,op=multiply,value=0.5)`（L0）
- `末列保留2位小数` -> `column_round(colIndex=last,decimals=2)`（L0）
- `最后一列四舍五入到整数` -> `column_round(colIndex=last,decimals=0)`（L0）

## Sort / Filter / Dedupe / Unit

- `按第2列升序排序` -> `sort_body_rows(keys=[{colIndex:1,direction:asc}])`（L0）
- `按第3列降序` -> `sort_body_rows(keys=[{colIndex:2,direction:desc}])`（L0）
- `按第1列升序第3列降序排序` -> `sort_body_rows(keys=[{0,asc},{2,desc}])`（L0）
- `仅显示第2列等于"首页"的行` -> `keep_rows_by_column_condition(colIndex=1,operator=eq,value=首页)`（L0，执行为保留匹配行）
- `仅显示第2列包含"首页"的行` -> `keep_rows_by_column_condition(colIndex=1,operator=contains,value=首页)`（L0，执行为保留匹配行）
- `仅保留第4列在10到20之间的行并删除其余行` -> `keep_rows_by_column_condition(colIndex=3,operator=range,min=10,max=20)`（L0）
- `清除筛选` -> `clear_row_filter`（L0；当前用于口令对齐）
- `按第1列和第3列去重并保留首条` -> `dedupe_rows_by_columns(colIndices=[0,2],keep=first)`（L0）
- `按第2列去重并保留末条` -> `dedupe_rows_by_columns(colIndices=[1],keep=last)`（L0）
- `把第4列单位从元转分` -> `convert_column_unit(colIndex=3,factor=100)`（L0）
- `把第4列单位从g到kg` -> `convert_column_unit(colIndex=3,factor=0.001)`（L0）

## Expected fallback

- `把商品管理列中包含首页的行删除` -> L0 miss，L1/L2 处理（语义组合）
- `把第2列前20行按拼音排序` -> L0 miss，L2 处理（范围+拼音排序）
- `把选中行按第2列升序排序` -> L0 miss，L1/L2 处理（排序类高风险）
- `对选中行按第1列和第3列多列排序` -> L0 miss，L1/L2 处理（多条件排序）
- `对选中行按第2列去重并保留首条` -> L0 miss，L1/L2 处理（去重策略语义）

## Routing expectations

- L0 命中：回复尾注应出现 `路由：L0`
- L1 命中：回复尾注应出现 `路由：L1` 且显示 `confidence`
- L2 回退：回复尾注应出现 `路由：L2` 与回退原因
- L1 请求失败/异常：应回退 L2，原因分别为 `L1请求失败` / `L1请求异常`

