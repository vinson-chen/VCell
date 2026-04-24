import { describe, expect, it } from 'vitest';
import type { TableAreaDemoModel } from '@vinson.hx/vc-biz';
import { parseQuickCommand } from './quickCommandRules';

function makeModel(): TableAreaDemoModel {
  return {
    colCount: 4,
    rowCount: 10,
    valueByCell: {
      'header-0': '组名',
      'header-1': '常用',
      'header-2': '系统设置',
      'header-3': '价格',
    },
  } as unknown as TableAreaDemoModel;
}

describe('parseQuickCommand schema regression', () => {
  it('matches clear_all_body variants', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('清空所有表体', m);
    const q2 = parseQuickCommand('把表体都清空', m);
    const q3 = parseQuickCommand('清空所有表体。', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    expect(q3.matched).toBe(true);
    if (q1.matched) expect(q1.actions[0].type).toBe('clear_all_body');
  });

  it('matches clear selected rows intent', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('清空选中行内容', m);
    const q2 = parseQuickCommand('把已选中的行清除', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({ type: 'clear_selected_rows' });
      expect(q2.actions[0]).toMatchObject({ type: 'clear_selected_rows' });
    }
  });

  it('matches selected-rows batch intents', () => {
    const m = makeModel();
    const d = parseQuickCommand('删除选中行', m);
    const t = parseQuickCommand('去除选中行首尾空格', m);
    const c = parseQuickCommand('把选中行转成大写', m);
    const f = parseQuickCommand('把选中行空单元格填充为“未配置”', m);
    const r = parseQuickCommand('把选中行“旧”替换为“新”', m);
    const e = parseQuickCommand('将选中行"旧"清空', m);
    expect(d.matched).toBe(true);
    expect(t.matched).toBe(true);
    expect(c.matched).toBe(true);
    expect(f.matched).toBe(true);
    expect(r.matched).toBe(true);
    expect(e.matched).toBe(true);
    if (d.matched && t.matched && c.matched && f.matched && r.matched && e.matched) {
      expect(d.actions[0]).toMatchObject({ type: 'delete_selected_rows' });
      expect(t.actions[0]).toMatchObject({ type: 'trim_whitespace_in_selected_rows' });
      expect(c.actions[0]).toMatchObject({ type: 'normalize_case_in_selected_rows', mode: 'upper' });
      expect(f.actions[0]).toMatchObject({ type: 'fill_empty_in_selected_rows', value: '未配置' });
      expect(r.actions[0]).toMatchObject({ type: 'replace_text_in_selected_rows', find: '旧', replace: '新' });
      expect(e.actions[0]).toMatchObject({ type: 'replace_text_in_selected_rows', find: '旧', replace: '' });
    }
  });

  it('matches selected-rows synonym intents', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('清空勾选行内容', m);
    const q2 = parseQuickCommand('删除当前勾选行', m);
    const q3 = parseQuickCommand('把已勾选行转成小写', m);
    const q4 = parseQuickCommand('把勾选行都除以2', m);
    const q5 = parseQuickCommand('帮我把勾选行清掉', m);
    const q6 = parseQuickCommand('把勾选行里的空白补成“未配置”', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    expect(q3.matched).toBe(true);
    expect(q4.matched).toBe(true);
    expect(q5.matched).toBe(true);
    expect(q6.matched).toBe(true);
    if (q1.matched && q2.matched && q3.matched && q4.matched && q5.matched && q6.matched) {
      expect(q1.actions[0]).toMatchObject({ type: 'clear_selected_rows' });
      expect(q2.actions[0]).toMatchObject({ type: 'delete_selected_rows' });
      expect(q3.actions[0]).toMatchObject({ type: 'normalize_case_in_selected_rows', mode: 'lower' });
      expect(q4.actions[0]).toMatchObject({ type: 'numeric_transform_in_selected_rows', op: 'multiply', value: 0.5 });
      expect(q5.actions[0]).toMatchObject({ type: 'clear_selected_rows' });
      expect(q6.actions[0]).toMatchObject({ type: 'fill_empty_in_selected_rows', value: '未配置' });
    }
  });

  it('matches selected-rows numeric intents', () => {
    const m = makeModel();
    const d = parseQuickCommand('把选中行都除以2', m);
    const z = parseQuickCommand('把选中行打8折', m);
    const p = parseQuickCommand('把选中行上调10%', m);
    const a = parseQuickCommand('把选中行加5', m);
    const r1 = parseQuickCommand('把选中行保留2位小数', m);
    const r2 = parseQuickCommand('把选中行四舍五入到整数', m);
    expect(d.matched).toBe(true);
    expect(z.matched).toBe(true);
    expect(p.matched).toBe(true);
    expect(a.matched).toBe(true);
    expect(r1.matched).toBe(true);
    expect(r2.matched).toBe(true);
    if (d.matched && z.matched && p.matched && a.matched && r1.matched && r2.matched) {
      expect(d.actions[0]).toMatchObject({ type: 'numeric_transform_in_selected_rows', op: 'multiply', value: 0.5 });
      expect(z.actions[0]).toMatchObject({ type: 'numeric_transform_in_selected_rows', op: 'multiply', value: 0.8 });
      expect(p.actions[0]).toMatchObject({ type: 'numeric_transform_in_selected_rows', op: 'multiply', value: 1.1 });
      expect(a.actions[0]).toMatchObject({ type: 'numeric_transform_in_selected_rows', op: 'add', value: 5 });
      expect(r1.actions[0]).toMatchObject({ type: 'round_in_selected_rows', decimals: 2 });
      expect(r2.actions[0]).toMatchObject({ type: 'round_in_selected_rows', decimals: 0 });
    }
  });

  it('matches clear by row/column variants from conflict samples', () => {
    const m = makeModel();
    const cFirst = parseQuickCommand('清空首列', m);
    const c0 = parseQuickCommand('清空第1列', m);
    const c1 = parseQuickCommand('清空第3列', m);
    const c2 = parseQuickCommand('把第3列都清空', m);
    const r1 = parseQuickCommand('清空第5行', m);
    const h1 = parseQuickCommand('清空系统设置列', m);
    expect(cFirst.matched).toBe(true);
    expect(c0.matched).toBe(true);
    expect(c1.matched).toBe(true);
    expect(c2.matched).toBe(true);
    expect(r1.matched).toBe(true);
    expect(h1.matched).toBe(true);
    if (cFirst.matched && c0.matched && c1.matched && c2.matched && r1.matched && h1.matched) {
      expect(cFirst.actions[0]).toMatchObject({ type: 'clear_column', colIndex: 0 });
      expect(c0.actions[0]).toMatchObject({ type: 'clear_column', colIndex: 0 });
      expect(c1.actions[0]).toMatchObject({ type: 'clear_column', colIndex: 2 });
      expect(c2.actions[0]).toMatchObject({ type: 'clear_column', colIndex: 2 });
      expect(r1.actions[0]).toMatchObject({ type: 'clear_row', rowIndex: 4 });
      expect(h1.actions[0]).toMatchObject({ type: 'clear_column', colIndex: 2 });
    }
  });

  it('matches insert-at variants', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('在第3行前插入2行', m);
    const q2 = parseQuickCommand('第3行前加2行', m);
    const q3 = parseQuickCommand('在第2列左侧插入1列', m);
    const q4 = parseQuickCommand('第2列左边加1列', m);
    const q5 = parseQuickCommand('在第3行后插入2行', m);
    const q6 = parseQuickCommand('第3行后加2行', m);
    const q7 = parseQuickCommand('在第2列右侧插入1列', m);
    const q8 = parseQuickCommand('第2列右边加1列', m);
    const q9 = parseQuickCommand('首列后增加1列', m);
    const q9b = parseQuickCommand('首列后增加1列”', m); // 句末杂引号，应归一化后仍命中 L0
    const q10 = parseQuickCommand('末列左边加1列', m);
    const q11 = parseQuickCommand('最后一列右侧加1列', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    expect(q3.matched).toBe(true);
    expect(q4.matched).toBe(true);
    expect(q5.matched).toBe(true);
    expect(q6.matched).toBe(true);
    expect(q7.matched).toBe(true);
    expect(q8.matched).toBe(true);
    expect(q9.matched).toBe(true);
    expect(q9b.matched).toBe(true);
    expect(q10.matched).toBe(true);
    expect(q11.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({ type: 'insert_rows_at', index: 2, count: 2 });
      expect(q2.actions[0]).toMatchObject({ type: 'insert_rows_at', index: 2, count: 2 });
    }
    if (q3.matched && q4.matched) {
      expect(q3.actions[0]).toMatchObject({ type: 'insert_columns_at', index: 1, count: 1 });
      expect(q4.actions[0]).toMatchObject({ type: 'insert_columns_at', index: 1, count: 1 });
    }
    if (q5.matched && q6.matched) {
      expect(q5.actions[0]).toMatchObject({ type: 'insert_rows_at', index: 3, count: 2 });
      expect(q6.actions[0]).toMatchObject({ type: 'insert_rows_at', index: 3, count: 2 });
    }
    if (q7.matched && q8.matched) {
      expect(q7.actions[0]).toMatchObject({ type: 'insert_columns_at', index: 2, count: 1 });
      expect(q8.actions[0]).toMatchObject({ type: 'insert_columns_at', index: 2, count: 1 });
    }
    if (q9.matched && q9b.matched) {
      expect(q9.actions[0]).toMatchObject({ type: 'insert_columns_at', index: 1, count: 1 });
      expect(q9b.actions[0]).toMatchObject({ type: 'insert_columns_at', index: 1, count: 1 });
    }
    if (q10.matched && q11.matched) {
      expect(q10.actions[0]).toMatchObject({ type: 'insert_columns_at', index: 3, count: 1 });
      expect(q11.actions[0]).toMatchObject({ type: 'insert_columns_at', index: 4, count: 1 });
    }
  });

  it('matches column hide / unhide (rule 45)', () => {
    const m = makeModel();
    const h1 = parseQuickCommand('隐藏第2列', m);
    const h2 = parseQuickCommand('隐藏价格列', m);
    const h3 = parseQuickCommand('隐藏末列', m);
    const s1 = parseQuickCommand('显示第2列', m);
    const s2 = parseQuickCommand('取消隐藏第3列', m);
    const all = parseQuickCommand('显示所有列', m);
    expect(h1.matched).toBe(true);
    expect(h2.matched).toBe(true);
    expect(h3.matched).toBe(true);
    expect(s1.matched).toBe(true);
    expect(s2.matched).toBe(true);
    expect(all.matched).toBe(true);
    expect(h1.actions[0]).toMatchObject({ type: 'set_column_hidden', colIndex: 1, hidden: true });
    expect(h2.actions[0]).toMatchObject({ type: 'set_column_hidden', colIndex: 3, hidden: true });
    expect(h3.actions[0]).toMatchObject({ type: 'set_column_hidden', colIndex: 3, hidden: true });
    expect(s1.actions[0]).toMatchObject({ type: 'set_column_hidden', colIndex: 1, hidden: false });
    expect(s2.actions[0]).toMatchObject({ type: 'set_column_hidden', colIndex: 2, hidden: false });
    expect(all.actions[0]).toMatchObject({ type: 'clear_hidden_columns' });
  });

  it('matches replace_text intents', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('把第2列“旧”替换为“新”', m);
    const q2 = parseQuickCommand('将所有单元格"旧"改成"新"', m);
    const q3 = parseQuickCommand('把全表“旧”替换为“新”', m);
    const q4 = parseQuickCommand('将第2列"旧"改成"新"', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    expect(q3.matched).toBe(true);
    expect(q4.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'replace_text_in_column',
        colIndex: 1,
        find: '旧',
        replace: '新',
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'replace_text_in_all_body',
        find: '旧',
        replace: '新',
      });
    }
    if (q3.matched) {
      expect(q3.actions[0]).toMatchObject({
        type: 'replace_text_in_all_body',
        find: '旧',
        replace: '新',
      });
    }
    if (q4.matched) {
      expect(q4.actions[0]).toMatchObject({
        type: 'replace_text_in_column',
        colIndex: 1,
        find: '旧',
        replace: '新',
      });
    }
  });

  it('matches replace-to-empty intents', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('把第2列“旧”替换为空', m);
    const q2 = parseQuickCommand('将所有单元格"旧"清空', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'replace_text_in_column',
        colIndex: 1,
        find: '旧',
        replace: '',
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'replace_text_in_all_body',
        find: '旧',
        replace: '',
      });
    }
  });

  it('matches rename header by index', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('把第2列表头改为“导航名”', m);
    const q2 = parseQuickCommand('第3列标题改成"系统模块"', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'set_cells',
        values: { 'header-1': '导航名' },
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'set_cells',
        values: { 'header-2': '系统模块' },
      });
    }
  });

  it('matches batch rename headers', () => {
    const m = makeModel();
    const q = parseQuickCommand('第1列改为“组别”，第2列表头改成"导航名称"', m);
    expect(q.matched).toBe(true);
    if (q.matched) {
      expect(q.actions[0]).toMatchObject({
        type: 'set_cells',
        values: {
          'header-0': '组别',
          'header-1': '导航名称',
        },
      });
    }
  });

  it('matches swap two columns', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('交换第1列和第3列', m);
    const q2 = parseQuickCommand('第2列与第4列互换', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({ type: 'swap_columns', colAIndex: 0, colBIndex: 2 });
      expect(q2.actions[0]).toMatchObject({ type: 'swap_columns', colAIndex: 1, colBIndex: 3 });
    }
  });

  it('matches reorder columns by given order', () => {
    const m = makeModel();
    const q = parseQuickCommand('按第3列 第1列 第4列 第2列顺序重排列', m);
    expect(q.matched).toBe(true);
    if (q.matched) {
      expect(q.actions[0]).toMatchObject({
        type: 'reorder_columns',
        order: [2, 0, 3, 1],
      });
    }
  });

  it('matches trim whitespace intents', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('去除第2列首尾空格', m);
    const q2 = parseQuickCommand('清理全表首尾空格', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({ type: 'trim_whitespace_in_column', colIndex: 1 });
      expect(q2.actions[0]).toMatchObject({ type: 'trim_whitespace_in_all_body' });
    }
  });

  it('matches normalize case intents', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('把第2列转成大写', m);
    const q2 = parseQuickCommand('全表统一转换为小写', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'normalize_case_in_column',
        colIndex: 1,
        mode: 'upper',
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'normalize_case_in_all_body',
        mode: 'lower',
      });
    }
  });

  it('matches fill empty cell intents', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('把第3列空单元格填充为“未配置”', m);
    const q2 = parseQuickCommand('全表空单元格设为"—"', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'fill_empty_in_column',
        colIndex: 2,
        value: '未配置',
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'fill_empty_in_all_body',
        value: '—',
      });
    }
  });

  it('matches first-column aliases in column intents', () => {
    const m = makeModel();
    const t = parseQuickCommand('去除首列首尾空格', m);
    const c = parseQuickCommand('把首列转成大写', m);
    const f = parseQuickCommand('把首列空单元格填充为“未配置”', m);
    const r = parseQuickCommand('把首列“旧”替换为“新”', m);
    const e = parseQuickCommand('把首列“旧”清空', m);
    const d = parseQuickCommand('把首列都除以2', m);
    const rd = parseQuickCommand('首列保留2位小数', m);
    const ri = parseQuickCommand('首列四舍五入到整数', m);
    expect(t.matched).toBe(true);
    expect(c.matched).toBe(true);
    expect(f.matched).toBe(true);
    expect(r.matched).toBe(true);
    expect(e.matched).toBe(true);
    expect(d.matched).toBe(true);
    expect(rd.matched).toBe(true);
    expect(ri.matched).toBe(true);
    if (t.matched && c.matched && f.matched && r.matched && e.matched && d.matched && rd.matched && ri.matched) {
      expect(t.actions[0]).toMatchObject({ type: 'trim_whitespace_in_column', colIndex: 0 });
      expect(c.actions[0]).toMatchObject({ type: 'normalize_case_in_column', colIndex: 0, mode: 'upper' });
      expect(f.actions[0]).toMatchObject({ type: 'fill_empty_in_column', colIndex: 0, value: '未配置' });
      expect(r.actions[0]).toMatchObject({ type: 'replace_text_in_column', colIndex: 0, find: '旧', replace: '新' });
      expect(e.actions[0]).toMatchObject({ type: 'replace_text_in_column', colIndex: 0, find: '旧', replace: '' });
      expect(d.actions[0]).toMatchObject({ type: 'column_numeric_transform', colIndex: 0, op: 'multiply', value: 0.5 });
      expect(rd.actions[0]).toMatchObject({ type: 'column_round', colIndex: 0, decimals: 2 });
      expect(ri.actions[0]).toMatchObject({ type: 'column_round', colIndex: 0, decimals: 0 });
    }
  });

  it('matches last-column aliases in column intents', () => {
    const m = makeModel();
    const cl = parseQuickCommand('清空末列', m);
    const t = parseQuickCommand('去除末列首尾空格', m);
    const c = parseQuickCommand('把最后一列转成小写', m);
    const f = parseQuickCommand('把末列空单元格填充为“未配置”', m);
    const r = parseQuickCommand('把末列“旧”替换为“新”', m);
    const e = parseQuickCommand('把最后一列“旧”清空', m);
    const d = parseQuickCommand('把末列都除以2', m);
    const rd = parseQuickCommand('末列保留2位小数', m);
    const ri = parseQuickCommand('最后一列四舍五入到整数', m);
    expect(cl.matched).toBe(true);
    expect(t.matched).toBe(true);
    expect(c.matched).toBe(true);
    expect(f.matched).toBe(true);
    expect(r.matched).toBe(true);
    expect(e.matched).toBe(true);
    expect(d.matched).toBe(true);
    expect(rd.matched).toBe(true);
    expect(ri.matched).toBe(true);
    if (cl.matched && t.matched && c.matched && f.matched && r.matched && e.matched && d.matched && rd.matched && ri.matched) {
      expect(cl.actions[0]).toMatchObject({ type: 'clear_column', colIndex: 3 });
      expect(t.actions[0]).toMatchObject({ type: 'trim_whitespace_in_column', colIndex: 3 });
      expect(c.actions[0]).toMatchObject({ type: 'normalize_case_in_column', colIndex: 3, mode: 'lower' });
      expect(f.actions[0]).toMatchObject({ type: 'fill_empty_in_column', colIndex: 3, value: '未配置' });
      expect(r.actions[0]).toMatchObject({ type: 'replace_text_in_column', colIndex: 3, find: '旧', replace: '新' });
      expect(e.actions[0]).toMatchObject({ type: 'replace_text_in_column', colIndex: 3, find: '旧', replace: '' });
      expect(d.actions[0]).toMatchObject({ type: 'column_numeric_transform', colIndex: 3, op: 'multiply', value: 0.5 });
      expect(rd.actions[0]).toMatchObject({ type: 'column_round', colIndex: 3, decimals: 2 });
      expect(ri.actions[0]).toMatchObject({ type: 'column_round', colIndex: 3, decimals: 0 });
    }
  });

  it('matches freeze flag intents (except first-row freeze)', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('开启冻结首列', m);
    const q2 = parseQuickCommand('关闭最后一列冻结', m);
    const q3 = parseQuickCommand('打开末行冻结', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    expect(q3.matched).toBe(true);
    if (q1.matched && q2.matched && q3.matched) {
      expect(q1.actions[0]).toMatchObject({ type: 'set_table_flags', flags: { enableFreezeFirstCol: true } });
      expect(q2.actions[0]).toMatchObject({ type: 'set_table_flags', flags: { enableFreezeLastCol: false } });
      expect(q3.actions[0]).toMatchObject({ type: 'set_table_flags', flags: { enableFreezeLastRow: true } });
    }
  });

  it('matches divide/round numeric intents', () => {
    const m = makeModel();
    const d1 = parseQuickCommand('第2列除以2', m);
    const d2 = parseQuickCommand('价格列除以2', m);
    const r1 = parseQuickCommand('第2列保留2位小数', m);
    const r2 = parseQuickCommand('第2列四舍五入到整数', m);
    expect(d1.matched).toBe(true);
    expect(d2.matched).toBe(true);
    expect(r1.matched).toBe(true);
    expect(r2.matched).toBe(true);
    if (d1.matched && d2.matched && r1.matched && r2.matched) {
      expect(d1.actions[0]).toMatchObject({
        type: 'column_numeric_transform',
        colIndex: 1,
        op: 'multiply',
        value: 0.5,
      });
      expect(d2.actions[0]).toMatchObject({
        type: 'column_numeric_transform',
        colIndex: 3,
        op: 'multiply',
        value: 0.5,
      });
      expect(r1.actions[0]).toMatchObject({ type: 'column_round', colIndex: 1, decimals: 2 });
      expect(r2.actions[0]).toMatchObject({ type: 'column_round', colIndex: 1, decimals: 0 });
    }
  });

  it('matches delete tail rows as L0 deterministic intent', () => {
    const m = makeModel();
    const q = parseQuickCommand('删除最后3行', m);
    expect(q.matched).toBe(true);
    if (q.matched) {
      expect(q.actions).toEqual([
        { type: 'delete_body_row', rowIndex: 8 },
        { type: 'delete_body_row', rowIndex: 7 },
        { type: 'delete_body_row', rowIndex: 6 },
      ]);
    }
  });

  it('matches delete tail columns as L0 deterministic intent', () => {
    const m = makeModel();
    const q = parseQuickCommand('删除末尾2列', m);
    expect(q.matched).toBe(true);
    if (q.matched) {
      expect(q.actions).toEqual([
        { type: 'delete_column', colIndex: 3 },
        { type: 'delete_column', colIndex: 2 },
      ]);
    }
  });

  it('matches delete tail rows/columns with 最后 wording', () => {
    const m = makeModel();
    const r = parseQuickCommand('删除最后2行', m);
    const c = parseQuickCommand('删除最后1列', m);
    expect(r.matched).toBe(true);
    expect(c.matched).toBe(true);
    if (r.matched && c.matched) {
      expect(r.actions).toEqual([
        { type: 'delete_body_row', rowIndex: 8 },
        { type: 'delete_body_row', rowIndex: 7 },
      ]);
      expect(c.actions).toEqual([{ type: 'delete_column', colIndex: 3 }]);
    }
  });

  it('matches sort intents', () => {
    const m = makeModel();
    const s1 = parseQuickCommand('按第2列升序排序', m);
    const s2 = parseQuickCommand('按第3列降序', m);
    const s3 = parseQuickCommand('按第1列升序第3列降序排序', m);
    expect(s1.matched).toBe(true);
    expect(s2.matched).toBe(true);
    expect(s3.matched).toBe(true);
    if (s1.matched && s2.matched && s3.matched) {
      expect(s1.actions[0]).toMatchObject({
        type: 'sort_body_rows',
        keys: [{ colIndex: 1, direction: 'asc' }],
      });
      expect(s2.actions[0]).toMatchObject({
        type: 'sort_body_rows',
        keys: [{ colIndex: 2, direction: 'desc' }],
      });
      expect(s3.actions[0]).toMatchObject({
        type: 'sort_body_rows',
        keys: [
          { colIndex: 0, direction: 'asc' },
          { colIndex: 2, direction: 'desc' },
        ],
      });
    }
  });

  it('matches filter intents as keep-rows actions', () => {
    const m = makeModel();
    const f1 = parseQuickCommand('仅显示第2列等于"首页"的行', m);
    const f2 = parseQuickCommand('只显示第2列包含"首页"的行', m);
    const f3 = parseQuickCommand('仅保留第4列在10到20之间的行并删除其余行', m);
    const cf = parseQuickCommand('清除筛选', m);
    expect(f1.matched).toBe(true);
    expect(f2.matched).toBe(true);
    expect(f3.matched).toBe(true);
    expect(cf.matched).toBe(true);
    if (f1.matched && f2.matched && f3.matched && cf.matched) {
      expect(f1.actions[0]).toMatchObject({
        type: 'keep_rows_by_column_condition',
        colIndex: 1,
        operator: 'eq',
        value: '首页',
      });
      expect(f2.actions[0]).toMatchObject({
        type: 'keep_rows_by_column_condition',
        colIndex: 1,
        operator: 'contains',
        value: '首页',
      });
      expect(f3.actions[0]).toMatchObject({
        type: 'keep_rows_by_column_condition',
        colIndex: 3,
        operator: 'range',
        min: 10,
        max: 20,
      });
      expect(cf.actions[0]).toMatchObject({ type: 'clear_row_filter' });
    }
  });

  it('matches dedupe and unit-convert intents', () => {
    const m = makeModel();
    const d1 = parseQuickCommand('按第1列和第3列去重并保留首条', m);
    const d2 = parseQuickCommand('按第2列去重并保留末条', m);
    const u1 = parseQuickCommand('把第4列单位从元转分', m);
    const u2 = parseQuickCommand('把第4列单位从g到kg', m);
    expect(d1.matched).toBe(true);
    expect(d2.matched).toBe(true);
    expect(u1.matched).toBe(true);
    expect(u2.matched).toBe(true);
    if (d1.matched && d2.matched && u1.matched && u2.matched) {
      expect(d1.actions[0]).toMatchObject({
        type: 'dedupe_rows_by_columns',
        colIndices: [0, 2],
        keep: 'first',
      });
      expect(d2.actions[0]).toMatchObject({
        type: 'dedupe_rows_by_columns',
        colIndices: [1],
        keep: 'last',
      });
      expect(u1.actions[0]).toMatchObject({
        type: 'convert_column_unit',
        colIndex: 3,
        factor: 100,
      });
      expect(u2.actions[0]).toMatchObject({
        type: 'convert_column_unit',
        colIndex: 3,
        factor: 0.001,
      });
    }
  });

  it('keeps complex intent for L1/L2 fallback', () => {
    const m = makeModel();
    const q = parseQuickCommand('把第2列前20行按拼音排序', m);
    const q2 = parseQuickCommand('把商品管理列中包含首页的行删除', m);
    const q3 = parseQuickCommand('把选中行按第2列升序排序', m);
    const q4 = parseQuickCommand('对选中行按第1列和第3列多列排序', m);
    const q5 = parseQuickCommand('对选中行按第2列去重并保留首条', m);
    expect(q.matched).toBe(false);
    expect(q2.matched).toBe(false);
    expect(q3.matched).toBe(false);
    expect(q4.matched).toBe(false);
    expect(q5.matched).toBe(false);
  });
});

describe('filter-based batch operations (L0 core capability)', () => {
  it('matches delete rows by contains condition', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('删除第2列包含"首页"的所有行', m);
    const q2 = parseQuickCommand('把第2列包含"首页"的行都删除', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 1,
        operator: 'contains',
        value: '首页',
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 1,
        operator: 'contains',
        value: '首页',
      });
    }
  });

  it('matches delete rows by eq condition', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('删除第2列等于"首页"的所有行', m);
    const q2 = parseQuickCommand('把第2列为"首页"的行都删除', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 1,
        operator: 'eq',
        value: '首页',
      });
    }
  });

  it('matches delete rows by numeric gt condition', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('删除第3列数值大于100的所有行', m);
    const q2 = parseQuickCommand('删除第3列大于50的行', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 2,
        operator: 'gt',
        min: 100,
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 2,
        operator: 'gt',
        min: 50,
      });
    }
  });

  it('matches delete rows by numeric lt/gte/lte conditions', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('删除第3列小于100的行', m);
    const q2 = parseQuickCommand('删除第3列大于等于50的行', m);
    const q3 = parseQuickCommand('删除第3列小于等于20的行', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    expect(q3.matched).toBe(true);
    if (q1.matched && q2.matched && q3.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 2,
        operator: 'lt',
        min: 100,
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 2,
        operator: 'gte',
        min: 50,
      });
      expect(q3.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 2,
        operator: 'lte',
        min: 20,
      });
    }
  });

  it('matches delete rows by regex condition', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('删除第2列匹配"^首页.*"的所有行', m);
    const q2 = parseQuickCommand('把第2列符合"^首页.*"的行都删除', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 1,
        operator: 'regex',
        regex: '^首页.*',
      });
    }
  });

  it('matches delete rows by empty/not_empty condition', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('删除第2列为空的所有行', m);
    const q2 = parseQuickCommand('删除第3列非空的行', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 1,
        operator: 'empty',
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'delete_rows_by_condition',
        colIndex: 2,
        operator: 'not_empty',
      });
    }
  });

  it('matches delete rows by multi-condition (AND)', () => {
    const m = makeModel();
    const q = parseQuickCommand('删除第1列等于"A"且第2列包含"B"的行', m);
    expect(q.matched).toBe(true);
    if (q.matched) {
      expect(q.actions[0]).toMatchObject({
        type: 'delete_rows_by_multi_condition',
        logic: 'and',
      });
      expect(q.actions[0].conditions).toHaveLength(2);
    }
  });

  it('matches delete rows by multi-condition (OR)', () => {
    const m = makeModel();
    const q = parseQuickCommand('删除第1列等于"A"或第2列包含"B"的行', m);
    expect(q.matched).toBe(true);
    if (q.matched) {
      expect(q.actions[0]).toMatchObject({
        type: 'delete_rows_by_multi_condition',
        logic: 'or',
      });
      expect(q.actions[0].conditions).toHaveLength(2);
    }
  });

  it('matches clear column for condition', () => {
    const m = makeModel();
    // 修改测试用例使用模型中存在的列（只有4列）
    const q1 = parseQuickCommand('清空第1列等于"已处理"的行的第3列内容', m);
    const q2 = parseQuickCommand('把第2列包含"待审"的行的第4列清空', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'clear_column_for_condition',
        filterColIndex: 0,
        filterOperator: 'eq',
        filterValue: '已处理',
        targetColIndex: 2,
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'clear_column_for_condition',
        filterColIndex: 1,
        filterOperator: 'contains',
        filterValue: '待审',
        targetColIndex: 3,
      });
    }
  });

  it('matches numeric transform for condition', () => {
    const m = makeModel();
    const q1 = parseQuickCommand('把第3列数值大于100的行都打8折', m);
    const q2 = parseQuickCommand('把第2列等于"A类"的行打7折', m);
    expect(q1.matched).toBe(true);
    expect(q2.matched).toBe(true);
    if (q1.matched && q2.matched) {
      expect(q1.actions[0]).toMatchObject({
        type: 'numeric_transform_for_condition',
        filterColIndex: 2,
        filterOperator: 'gt',
        op: 'multiply',
      });
      expect(q2.actions[0]).toMatchObject({
        type: 'numeric_transform_for_condition',
        filterColIndex: 1,
        filterOperator: 'eq',
        filterValue: 'A类',
        op: 'multiply',
      });
    }
  });

  it('matches replace text for condition', () => {
    const m = makeModel();
    const q = parseQuickCommand('把第2列等于"待审核"的行中"旧"替换成"新"', m);
    expect(q.matched).toBe(true);
    if (q.matched) {
      expect(q.actions[0]).toMatchObject({
        type: 'replace_text_for_condition',
        filterColIndex: 1,
        filterOperator: 'eq',
        filterValue: '待审核',
        find: '旧',
        replace: '新',
      });
    }
  });
});

