import { describe, expect, it } from 'vitest';
import { createSeed } from '../api/mock/seed';
import { activityDate, clientContactFields, clientProjectCounts, cooperationDate, filterClientProjects, filterClientView, primaryClientContact } from './clients';
import { filterClients, sortClients } from './filters';

describe('客户查询与显示', () => {
  const data = createSeed('2026-11-02').clients;
  it('搜索覆盖联系方式、公司、地址、平台账号及备注，标签使用AND', () => {
    const client = { ...data[0], company: '一片叶子', address: '杭州西湖', phone: '13812344321', wechat: 'GreenLeaf', email: 'design@leaf.cn', accounts: [{ platform: '淘宝', handle: '春茶官方旗舰店' }], notes: '偏好竖版海报', tagIds: ['food', 'vip'] };
    for (const query of ['一片叶子', '杭州', '1381234', 'greenleaf', 'design@leaf.cn', '春茶官方', '竖版']) expect(filterClients([client], query)).toEqual([client]);
    expect(filterClients([client], '', ['food', 'vip'])).toEqual([client]);
    expect(filterClients([client], '', ['food', 'other'])).toEqual([]);
  });
  it('所有排序置顶优先，同值有稳定次序且不改变原数组', () => {
    const a = { ...data[0], id: 'a', name: '甲', pinned: false, receivedCents: 500, lastActivityAt: '2026-11-01', createdAt: '2026-10-01' };
    const b = { ...a, id: 'b', name: '乙', receivedCents: 900, lastActivityAt: '2026-11-02', createdAt: '2026-11-01' };
    const pinned = { ...a, id: 'pin', pinned: true, receivedCents: 0, lastActivityAt: '2026-01-01' };
    const input = [a, b, pinned];
    for (const sort of ['recent', 'received', 'createdAt'] as const) expect(sortClients(input, sort).map(client => client.id)).toEqual(['pin', 'b', 'a']);
    expect(sortClients(input, 'name')[0]).toEqual(pinned); expect(input).toEqual([a, b, pinned]);
  });
  it('隐藏空联系方式，只有明确展开时显示空项', () => {
    const client = { ...data[0], phone: '', wechat: 'leaf', email: '', address: '' };
    expect(clientContactFields(client).map(field => field.key)).toEqual(['wechat']);
    expect(clientContactFields(client, true)).toHaveLength(4);
  });
  it('合作时间用本地日历，未合作与无效值明确显示', () => {
    expect(cooperationDate(null, '2026-11-02')).toBe('暂无合作');
    expect(cooperationDate('invalid', '2026-11-02')).toBe('暂无合作');
    expect(cooperationDate('2026-11-01T12:00:00', '2026-11-02')).toBe('昨天');
    expect(cooperationDate('2026-11-02T12:00:00', '2026-11-02')).toBe('今天');
    expect(activityDate(null, '2026-11-02')).toBe('暂无动态');
    expect(activityDate('2026-11-02T12:00:00', '2026-11-02')).toBe('今天');
  });

  it('客户快捷筛选采用项目和应收口径，互不修改原数据', () => {
    const active = { ...data[0], id: 'active', openProjectCount: 2, projectCount: 3, outstandingCents: 500, pinned: false };
    const historical = { ...active, id: 'historical', openProjectCount: 0, outstandingCents: 0, pinned: true };
    const empty = { ...historical, id: 'empty', projectCount: 0, pinned: false };
    const clients = [active, historical, empty];
    expect(filterClientView(clients, 'active').map(client => client.id)).toEqual(['active']);
    expect(filterClientView(clients, 'outstanding').map(client => client.id)).toEqual(['active']);
    expect(filterClientView(clients, 'pinned').map(client => client.id)).toEqual(['historical']);
    expect(filterClientView(clients, 'empty').map(client => client.id)).toEqual(['empty']);
    expect(filterClientView(clients, 'all')).toEqual(clients);
  });

  it('客户项目分类保留已完成未收清项目，排除取消项目的待收，并支持范围内搜索', () => {
    const base = createSeed('2026-11-02').projects[0];
    const projects = [
      { ...base, id: 'active', title: '春季海报', status: 'review' as const, priceCents: 10000, receivedCents: 3000 },
      { ...base, id: 'done', title: '包装交付', status: 'done' as const, priceCents: 20000, receivedCents: 5000 },
      { ...base, id: 'cancelled', title: '旧需求', status: 'cancelled' as const, priceCents: 90000, receivedCents: 0 },
    ];
    expect(clientProjectCounts(projects)).toEqual({ active: 1, outstanding: 2, history: 2, all: 3 });
    expect(filterClientProjects(projects, 'active').map(project => project.id)).toEqual(['active']);
    expect(filterClientProjects(projects, 'outstanding').map(project => project.id)).toEqual(['active', 'done']);
    expect(filterClientProjects(projects, 'history', '包装').map(project => project.id)).toEqual(['done']);
    expect(filterClientProjects(projects, 'active', '包装')).toEqual([]);
  });

  it('主要联系方式依次回退到微信、电话、邮箱与有效平台账号', () => {
    const client = { ...data[0], wechat: 'leaf', phone: '13900001111', email: 'hello@leaf.cn', accounts: [{ platform: '淘宝', handle: '' }, { platform: '小红书', handle: '叶子店' }] };
    expect(primaryClientContact(client)).toEqual({ label: '微信', value: 'leaf' });
    expect(primaryClientContact({ ...client, wechat: ' ' })).toEqual({ label: '电话', value: '13900001111' });
    expect(primaryClientContact({ ...client, wechat: '', phone: '' })).toEqual({ label: '邮箱', value: 'hello@leaf.cn' });
    expect(primaryClientContact({ ...client, wechat: '', phone: '', email: '' })).toEqual({ label: '小红书', value: '叶子店' });
    expect(primaryClientContact({ ...client, wechat: '', phone: '', email: '', accounts: [] })).toBeNull();
  });
});
