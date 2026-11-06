import { describe, expect, it } from 'vitest';
import type { Activity } from '../api/types';
import { filterActivities } from './activityFilters';

const event = (id: string, patch: Partial<Activity>): Activity => ({ id, clientId: 'client', clientName: '林女士', projectId: 'project', projectTitle: '新品海报', kind: 'note', body: '', meta: {}, createdAt: '2026-11-05T12:00:00Z', ...patch });
const events = [
  event('note', { body: '第二稿改成暖色' }),
  event('file', { kind: 'file', body: '添加了 2 个文件', meta: { names: ['Poster-FINAL.psd', '参考.png', 123] } }),
  event('status', { kind: 'status', body: '变更了项目状态', meta: { from: 'active', to: 'review' } }),
  event('payment', { kind: 'payment', body: '新增了收款', meta: { method: '微信', amountCents: 120000 } }),
];

describe('动态检索', () => {
  it('组合分类与多个关键词，并保持原始记录和顺序', () => {
    expect(filterActivities(events, 'notes', '第二稿 暖色').map(value => value.id)).toEqual(['note']);
    expect(filterActivities(events, 'system', '海报').map(value => value.id)).toEqual(['file', 'status', 'payment']);
    expect(filterActivities(events, 'system', '暖色')).toEqual([]);
    expect(events).toHaveLength(4);
  });
  it('匹配文件名、显示状态、金额与收款方式，忽略大小写和首尾空格', () => {
    expect(filterActivities(events, 'all', '  poster-final  ').map(value => value.id)).toEqual(['file']);
    expect(filterActivities(events, 'all', '待确认').map(value => value.id)).toEqual(['status']);
    expect(filterActivities(events, 'all', '微信 1,200').map(value => value.id)).toEqual(['payment']);
  });
});
