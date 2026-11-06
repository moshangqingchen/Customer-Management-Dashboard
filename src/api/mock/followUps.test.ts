import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from './index';
import { mockFollowUps } from './followUps';
import { clone, replace, reset, state } from './store';

beforeEach(() => { reset(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-05T09:00:00Z')); });
afterEach(() => vi.useRealTimers());
describe('持久化跟进 mock', () => {
  it('提醒状态随数据重载，延期和重开重置提醒，完成写不可编辑动态', async () => {
    const client = (await mockApi.clients.list())[0];
    const follow = await mockFollowUps.create({ clientId: client.id, title: '确认初稿', dueAt: '2026-11-05T09:00:00Z' });
    expect(await mockFollowUps.claimReminder(follow.id, 1)).toBe(true);
    replace(clone(state()));
    expect(await mockFollowUps.claimReminder(follow.id, 1)).toBe(false);
    const later = await mockFollowUps.update(follow.id, { dueAt: '2026-11-05T10:00:00Z' });
    expect(later.revision).toBe(2); expect(await mockFollowUps.claimReminder(follow.id, 2)).toBe(false);
    vi.setSystemTime(new Date('2026-11-05T10:00:00Z'));
    expect(await mockFollowUps.claimReminder(follow.id, 2)).toBe(true);
    await expect(mockFollowUps.setStatus(follow.id, 'completed', '')).rejects.toThrow();
    const done = await mockFollowUps.setStatus(follow.id, 'completed', '客户确认配色');
    expect(done.completedAt).not.toBeNull();
    const event = (await mockApi.activities.list({ clientId: client.id })).find(value => value.body.includes('客户确认配色'));
    expect(event?.kind).toBe('status');
    await expect(mockApi.activities.updateNote(event!.id, '篡改')).rejects.toThrow();
    const reopened = await mockFollowUps.setStatus(follow.id, 'pending');
    expect(await mockFollowUps.claimReminder(follow.id, reopened.revision)).toBe(true);
  });
  it('误关联和非法时间不入库，软删项目停止提醒但保留历史，取消不提醒', async () => {
    const clients = await mockApi.clients.list(); const project = (await mockApi.projects.list()).find(value => value.clientId !== clients[0].id)!;
    await expect(mockFollowUps.create({ clientId: clients[0].id, projectId: project.id, title: '误关联', dueAt: '2026-11-05T09:00:00Z' })).rejects.toThrow();
    await expect(mockFollowUps.create({ clientId: clients[0].id, title: '非法日期', dueAt: '2026-02-30T09:00:00Z' })).rejects.toThrow();
    const own = await mockApi.projects.create({ clientId: clients[0].id, title: '跟进关联' });
    const follow = await mockFollowUps.create({ clientId: clients[0].id, projectId: own.id, title: '等待反馈', dueAt: '2026-11-05T09:00:00Z' });
    await mockApi.projects.delete(own.id);
    expect(await mockFollowUps.claimReminder(follow.id, 1)).toBe(false);
    expect((await mockFollowUps.list())[0]).toMatchObject({ projectAvailable: false });
    await mockFollowUps.update(follow.id, { projectId: null });
    await mockFollowUps.setStatus(follow.id, 'cancelled');
    expect(await mockFollowUps.claimReminder(follow.id, 1)).toBe(false);
    await mockApi.clients.delete(clients[0].id);
    expect(await mockFollowUps.list()).toHaveLength(0);
  });
  it('存储失败时回滚提醒声明，恢复后仍能提醒', async () => {
    const client = (await mockApi.clients.list())[0];
    const follow = await mockFollowUps.create({ clientId: client.id, title: '回访', dueAt: '2026-11-05T09:00:00Z' });
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('满'); });
    await expect(mockFollowUps.claimReminder(follow.id, 1)).rejects.toThrow();
    storage.mockRestore();
    expect(await mockFollowUps.claimReminder(follow.id, 1)).toBe(true);
  });
});
