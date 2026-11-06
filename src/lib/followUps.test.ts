import { describe, expect, it, vi } from 'vitest';
import type { FollowUp } from '../api/followUps';
import { createFollowUpNotifier, followUpsForToday, isFollowUpDue, localDateTime, localDateTimeToUtc } from './followUps';

const item = (patch: Partial<FollowUp> = {}): FollowUp => ({ id: 'f', clientId: 'c', clientName: '林女士', projectId: null, projectTitle: null, projectAvailable: true, title: '确认稿件', dueAt: '2026-11-05T09:00:00.000Z', notes: '', status: 'pending', result: '', completedAt: null, revision: 1, remindedRevision: null, createdAt: '', updatedAt: '', ...patch });
describe('跟进时间与提醒', () => {
  it('本地输入转换 UTC 并保留本地日期时间，拒绝无效日期', () => {
    const local = '2026-12-31T23:30'; const utc = localDateTimeToUtc(local);
    expect(utc).not.toBeNull(); expect(localDateTime(utc!)).toBe(local);
    expect(localDateTimeToUtc('2026-02-30T10:00')).toBeNull();
    expect(localDateTimeToUtc('2026-11-05T25:30')).toBeNull();
    expect(localDateTimeToUtc('')).toBeNull();
  });
  it('到期边界包含相等时刻，逾期保留，已完成或关联不可用不提醒', () => {
    const now = Date.parse('2026-11-05T09:00:00Z');
    expect(isFollowUpDue(item(), now - 1)).toBe(false); expect(isFollowUpDue(item(), now)).toBe(true);
    expect(isFollowUpDue(item({ status: 'completed' }), now + 1)).toBe(false);
    expect(isFollowUpDue(item({ projectAvailable: false }), now + 1)).toBe(false);
    expect(followUpsForToday([item()], new Date('2026-12-01T12:00:00'))).toHaveLength(1);
  });
  it('并发检查和重复列表只发一次，持久化已提醒版本不再请求', async () => {
    let release: (value: boolean) => void = () => undefined;
    const claim = vi.fn(() => new Promise<boolean>(resolve => { release = resolve; })); const show = vi.fn();
    const notify = createFollowUpNotifier(claim, show); const now = Date.parse('2026-11-06T00:00:00Z');
    const first = notify([item(), item()], now); await notify([item()], now);
    release(true); await first;
    expect(claim).toHaveBeenCalledTimes(1); expect(show).toHaveBeenCalledTimes(1);
    await notify([item({ remindedRevision: 1 })], now); expect(claim).toHaveBeenCalledTimes(1);
  });
  it('原子核验拒绝过时计划，失败可重试，延期后的新版本可再次提醒', async () => {
    const claim = vi.fn().mockRejectedValueOnce(new Error('磁盘暂不可写')).mockResolvedValueOnce(false).mockResolvedValueOnce(true); const show = vi.fn();
    const notify = createFollowUpNotifier(claim, show); const now = Date.parse('2026-11-06T00:00:00Z');
    await expect(notify([item()], now)).rejects.toThrow('磁盘暂不可写');
    await notify([item()], now); expect(show).not.toHaveBeenCalled();
    await notify([item({ revision: 2 })], now); expect(show).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenLastCalledWith('f', 2);
  });
});
