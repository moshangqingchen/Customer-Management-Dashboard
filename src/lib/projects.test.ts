import { describe, expect, it } from 'vitest';
import { createSeed } from '../api/mock/seed';
import type { Project } from '../api/types';
import { dateOffset } from './dates';
import { filterProjects, sortProjects } from './filters';
import { groupBoard, projectViewCounts, routeProjectFilters } from './projects';

describe('项目筛选与看板', () => {
  const projects = createSeed('2026-11-02').projects;
  it('需要关注包含逾期和未来三天，排除远期、无日期与已归档项目', () => {
    const input: Project[] = [-10, 0, 3, 4].map((offset, index) => ({ ...projects[0], id: `${index}`, status: 'active', dueDate: dateOffset(offset, '2026-11-02') }));
    input.push({ ...input[0], id: 'done', status: 'done' }, { ...input[0], id: 'cancelled', status: 'cancelled' }, { ...input[0], id: 'none', dueDate: null });
    expect(filterProjects(input, { due: 'attention' }, '2026-11-02').map(project => project.id)).toEqual(['0', '1', '2']);
  });
  it('快捷视图按项目统计置顶、逾期和未取消的待收款', () => {
    const input: Project[] = [
      { ...projects[0], pinned: true, status: 'active', dueDate: '2026-11-01', priceCents: 10000, receivedCents: 0 },
      { ...projects[1], pinned: false, status: 'done', dueDate: '2026-11-01', priceCents: 10000, receivedCents: 10000 },
      { ...projects[2], pinned: true, status: 'cancelled', dueDate: '2026-11-01', priceCents: 10000, receivedCents: 0 },
    ];
    expect(projectViewCounts(input, '2026-11-02')).toEqual({ pinned: 2, overdue: 1, outstanding: 1 });
  });
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
  it('默认智能排序先未结后归档，空截止日最后，归档按完成或更新时间倒序', () => {
    const make = (id: string, patch: Partial<Project>): Project => ({ ...projects[0], id, pinned: false, ...patch });
    const input = [
      make('old-done', { status: 'done', dueDate: '2026-01-01', completedAt: '2026-01-02' }),
      make('no-date', { status: 'lead', dueDate: null }),
      make('later', { status: 'review', dueDate: '2026-11-10' }),
      make('new-cancelled', { status: 'cancelled', updatedAt: '2026-11-01T12:00:00Z', completedAt: null }),
      make('first', { status: 'active', dueDate: '2026-11-03' }),
      make('delivered', { status: 'delivered', dueDate: '2026-11-04' }),
    ];
    expect(sortProjects(input).map(project => project.id)).toEqual(['first', 'delivered', 'later', 'no-date', 'new-cancelled', 'old-done']);
    expect(input[0].id).toBe('old-done');
    expect(sortProjects(input, 'dueDate')[0].id).toBe('old-done');
    expect(sortProjects([...input, make('pinned-done', { status: 'done', pinned: true })])[0].id).toBe('first');
  });
  it('所有排序保持置顶置顶，3000项目组合筛选小于50ms', () => {
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
