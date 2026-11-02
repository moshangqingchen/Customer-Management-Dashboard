import { describe, expect, it } from 'vitest';
import { createSeed } from '../api/mock/seed';
import type { Project } from '../api/types';
import { dateOffset } from './dates';
import { filterProjects, sortProjects } from './filters';
import { groupBoard, routeProjectFilters } from './projects';

describe('项目筛选与看板', () => {
  const projects = createSeed('2026-11-02').projects;
  it('侧栏与统计卡预设转为可组合筛选', () => {
    expect(routeProjectFilters({ view: 'overdue', tagId: 'tag-1', statuses: ['active'], filters: { clientId: 'client-1' } })).toEqual({ due: 'overdue', tagIds: ['tag-1'], statuses: ['active'], clientId: 'client-1' });
    expect(routeProjectFilters({ view: 'outstanding' })).toEqual({ outstanding: true });
    expect(routeProjectFilters({ view: 'pinned' })).toEqual({ pinned: true });
    expect(filterProjects(projects, { sourcePlatform: '微信', paymentStatus: 'unpaid', tagIds: ['tag-4'] }).every(p => p.sourcePlatform === '微信' && p.tagIds.includes('tag-4'))).toBe(true);
  });
  it('五列排除取消，完成列30天边界与金额统计一致', () => {
    const input: Project[] = [0, -30, -31].map((delta, i) => ({ ...projects[i], id: `${i}`, status: 'done', completedAt: dateOffset(delta, '2026-11-02'), priceCents: 100 }));
    input.push({ ...input[0], id: 'cancelled', status: 'cancelled' });
    const group = groupBoard(input, false, '2026-11-02');
    expect(group).toHaveLength(5); expect(group.at(-1)).toMatchObject({ totalCents: 200, hiddenCount: 1 });
    expect(groupBoard(input, true, '2026-11-02').at(-1)?.projects).toHaveLength(3);
  });
  it('所有排序保持星标置顶，3000项目组合筛选小于50ms', () => {
    const input = Array.from({ length: 3000 }, (_, i) => ({ ...projects[i % projects.length], id: `p${i}` }));
    const start = performance.now();
    const filtered = filterProjects(input, { query: '海报', due: 'month', tagIds: ['tag-1'], sourcePlatform: '淘宝' }, '2026-11-02');
    expect(performance.now() - start).toBeLessThan(50);
    expect(filtered.length).toBeGreaterThan(0);
    for (const sort of ['dueDate', 'updatedAt', 'price', 'createdAt'] as const) {
      const sorted = sortProjects(projects, sort); expect(sorted[0].pinned).toBe(true); expect(sorted).not.toBe(projects);
    }
  });
});
