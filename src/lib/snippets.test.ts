import { describe, expect, it } from 'vitest';
import { createSeed } from '../api/mock/seed';
import { filterSnippets, snippetGroupCount } from './snippets';

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
