import { describe, expect, it } from 'vitest';
import type { Activity } from '../api/types';
import { activitySummary, groupActivities, relativeActivityTime } from './activity';

const event = (id: string, date: string, patch: Partial<Activity> = {}): Activity => ({ id, clientId: 'c', clientName: '客户', projectId: 'p', projectTitle: '项目', kind: 'note', body: '已确认需求', meta: {}, createdAt: date, ...patch });

describe('动态时间线派生', () => {
  it('按本地日期分组并降序排列，标明今天和昨天', () => {
    const groups = groupActivities([event('a', '2026-11-01T09:00:00'), event('b', '2026-11-02T15:00:00'), event('c', '2026-11-02T11:00:00'), event('d', '2026-10-30T11:00:00')], '2026-11-02');
    expect(groups.map(group => group.label)).toEqual(['今天', '昨天', '10月30日']);
    expect(groups[0].items.map(item => item.id)).toEqual(['b', 'c']);
  });
  it('状态变化显示两端中文状态，未知状态保留原文', () => {
    expect(activitySummary(event('a', '', { kind: 'status', meta: { from: 'active', to: 'review' } }))).toBe('进行中 → 待确认');
    expect(activitySummary(event('a', '', { kind: 'status', meta: { from: 'unknown' } }))).toBe('已确认需求');
  });
  it('收款与退款展示金额，文件数不重复', () => {
    expect(activitySummary(event('a', '', { kind: 'payment', body: '记录了退款', meta: { amountCents: 1250, kind: 'refund' } }))).toBe('记录了退款 −¥12.50');
    expect(activitySummary(event('b', '', { kind: 'file', body: '添加了 2 个文件', meta: { names: ['a', 'b'] } }))).toBe('添加了 2 个文件');
  });
  it('相对时间没有大约前缀，昨天显示具体时分', () => {
    const now = new Date('2026-11-02T15:20:00');
    expect(relativeActivityTime('2026-11-02T11:00:00', now)).toBe('4 小时前');
    expect(relativeActivityTime('2026-11-01T14:20:00', now)).toBe('昨天 14:20');
    expect(relativeActivityTime('2026-11-02T15:19:30', now)).toBe('刚刚');
  });
});
