import { describe, expect, it } from 'vitest';
import { createSeed } from '../api/mock/seed';
import { clientContactFields, cooperationDate } from './clients';
import { filterClients, sortClients } from './filters';

describe('客户查询与显示', () => {
  const data = createSeed('2026-11-02').clients;
  it('搜索覆盖联系方式、公司、地址、平台账号及备注，标签使用AND', () => {
    const client = { ...data[0], company: '一片叶子', address: '杭州西湖', phone: '13812344321', wechat: 'GreenLeaf', email: 'design@leaf.cn', accounts: [{ platform: '淘宝', handle: '春茶官方旗舰店' }], notes: '偏好竖版海报', tagIds: ['food', 'vip'] };
    for (const query of ['一片叶子', '杭州', '1381234', 'greenleaf', 'design@leaf.cn', '春茶官方', '竖版']) expect(filterClients([client], query)).toEqual([client]);
    expect(filterClients([client], '', ['food', 'vip'])).toEqual([client]);
    expect(filterClients([client], '', ['food', 'other'])).toEqual([]);
  });
  it('所有排序星标优先，同值有稳定次序且不改变原数组', () => {
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
  });
});
