import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { mockApi } from '../../api/mock';
import { mockFollowUps } from '../../api/mock/followUps';
import { reset } from '../../api/mock/store';
import { FollowUpReminders } from './FollowUpReminders';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
let query: QueryClient;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-05T09:00:00Z')); reset();
  query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.mocked(toast).mockClear();
});
afterEach(() => { query.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('应用内跟进提醒', () => {
  it('每分钟检查、聚焦检查，到期只提醒一次；重新挂载沿用持久化提醒状态', async () => {
    const client = (await mockApi.clients.list())[0];
    const item = await mockFollowUps.create({ clientId: client.id, title: '定时回访', dueAt: '2026-11-05T09:01:00Z' });
    const list = vi.spyOn(mockFollowUps, 'list');
    const view = render(<QueryClientProvider client={query}><FollowUpReminders /></QueryClientProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    expect(toast).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_005); });
    expect(toast).toHaveBeenCalledTimes(1);
    const calls = list.mock.calls.length;
    await act(async () => { fireEvent.focus(window); await vi.advanceTimersByTimeAsync(5); });
    expect(list.mock.calls.length).toBeGreaterThan(calls); expect(toast).toHaveBeenCalledTimes(1);
    view.unmount();
    render(<QueryClientProvider client={query}><FollowUpReminders /></QueryClientProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(5); });
    expect(toast).toHaveBeenCalledTimes(1);
    expect((await mockFollowUps.list()).find(value => value.id === item.id)?.remindedRevision).toBe(1);
  });
});
