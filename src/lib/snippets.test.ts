import { describe, expect, it } from 'vitest';
import { createSeed } from '../api/mock/seed';
import { fillSnippet, filterSnippets, hasSnippetVariables, snippetGroupCount } from './snippets';

describe('话术筛选', () => {
  const snippets = createSeed('2026-11-02').snippets;
  it('无搜索时按分组筛选，搜索内容时跨组查找并保留原始内容', () => {
    expect(filterSnippets(snippets, 'group-1', '')).toHaveLength(4);
    const found = filterSnippets(snippets, 'group-1', '  尾款  ');
    expect(found).toHaveLength(1);
    expect(found[0].groupId).toBe('group-3');
    expect(filterSnippets(snippets, 'all', '尺寸')[0].body).toContain('\n');
    expect(snippetGroupCount(snippets, 'group-3')).toBe(4);
  });
});

describe('话术变量', () => {
  const body = '{客户}，{项目}报价{报价}，已收{已收}，待收{待收}，请于{截止日}确认。';
  it('替换所有变量并保留换行与金额精度，重复变量也全部替换', () => {
    expect(fillSnippet(body, { clientName: '林女士', projectTitle: '菜单设计', priceCents: 123400, receivedCents: 40050, outstandingCents: 83350, dueDate: '2026-11-08', baseDate: '2026-11-02' }))
      .toBe('林女士，菜单设计报价¥1,234，已收¥400.50，待收¥833.50，请于11月8日确认。');
    expect(fillSnippet('{客户}\n{客户} {待收}', { clientName: '小林', outstandingCents: 0 })).toBe('小林\n小林 ¥0');
  });
  it('缺少值时保留原占位，不把未知变量或替换值二次展开', () => {
    expect(fillSnippet(body, { clientName: '林女士' })).toBe(body.replace('{客户}', '林女士'));
    expect(fillSnippet('{客户} {报价} {截止日} {自定义}', { clientName: '{项目}', priceCents: Number.NaN, dueDate: 'invalid' })).toBe('{项目} {报价} {截止日} {自定义}');
    expect(hasSnippetVariables('{客户}您好')).toBe(true);
    expect(hasSnippetVariables('{自定义}')).toBe(false);
  });
  it('非今年截止日期附年份，空白名称保持占位', () => {
    expect(fillSnippet('{客户} {截止日}', { clientName: '', dueDate: '2025-01-24', baseDate: '2026-11-02' })).toBe('{客户} 2025年1月24日');
  });
});
