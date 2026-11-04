import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Activity, Client, Project } from '../api/types';
import { api } from '../api/client';
import { queryKeys, useDeleteActivity, useSetLibraryRoot, useSetProjectStatus, useUpdateClient } from './queries';
import { hotkeyMatches, useHotkeys } from './useHotkeys';
import { dropTarget } from './useFileDrop';
import { useCopy } from './useCopy';
import { today } from '../lib/dates';
import { toast } from 'sonner';

vi.mock('../api/client', () => ({ api: { projects: { setStatus: vi.fn() }, clients: { update: vi.fn() }, activities: { delete: vi.fn() }, library: { setRoot: vi.fn() } }, isTauri: false }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));
const sampleProject: Project = { id: 'p1', clientId: 'c1', clientName: '林女士', title: '海报', status: 'active', pinned: false, brief: '', sourcePlatform: '', sourceOrderNo: '', startDate: null, dueDate: null, deliveredAt: null, completedAt: null, priceCents: 10000, costCents: 0, tagIds: [], folder: null, createdAt: '', updatedAt: '', receivedCents: 0, paymentCount: 0, fileCount: 0, coverPath: null };
const sampleClient: Client = { id: 'c1', name: '林女士', company: '', phone: '', wechat: '', email: '', address: '', accounts: [], rating: 0, pinned: false, notes: '', folder: null, tagIds: [], createdAt: '', updatedAt: '', projectCount: 1, openProjectCount: 1, billedCents: 10000, receivedCents: 0, outstandingCents: 10000, firstProjectAt: null, lastActivityAt: '' };
function provider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { queryClient, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> };
}
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
describe('查询mutation缓存', () => {
  it('状态立即更新列表与详情，失败回滚，再失效相关实体', async () => {
    const { queryClient, wrapper } = provider();
    queryClient.setQueryData(queryKeys.projects, [sampleProject]); queryClient.setQueryData(queryKeys.project('p1'), sampleProject);
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    let rejectRequest: (error: Error) => void = () => undefined;
    vi.mocked(api.projects.setStatus).mockImplementation(() => new Promise<Project>((_resolve, reject) => { rejectRequest = reject; }));
    const { result } = renderHook(() => useSetProjectStatus(), { wrapper });
    act(() => result.current.mutate({ id: 'p1', status: 'review' }));
    await waitFor(() => expect(queryClient.getQueryData<Project>(queryKeys.project('p1'))?.status).toBe('review'));
    expect(queryClient.getQueryData<Project[]>(queryKeys.projects)?.[0].status).toBe('review');
    act(() => rejectRequest(new Error('测试保存失败')));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<Project>(queryKeys.project('p1'))?.status).toBe('active');
    expect(queryClient.getQueryData<Project[]>(queryKeys.projects)?.[0].status).toBe('active');
    expect(invalidation).toHaveBeenCalledWith({ queryKey: queryKeys.client('c1') });
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: queryKeys.snippets });
    queryClient.clear();
  });
  it('客户置顶乐观更新，成功后重新请求列表与详情', async () => {
    const { queryClient, wrapper } = provider();
    queryClient.setQueryData(queryKeys.clients, [sampleClient]); queryClient.setQueryData(queryKeys.client('c1'), sampleClient);
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    let resolveRequest: (value: { value: Client; warning: null }) => void = () => undefined;
    vi.mocked(api.clients.update).mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
    const { result } = renderHook(() => useUpdateClient(), { wrapper });
    act(() => result.current.mutate({ id: 'c1', patch: { pinned: true } }));
    await waitFor(() => expect(queryClient.getQueryData<Client[]>(queryKeys.clients)?.[0].pinned).toBe(true));
    expect(queryClient.getQueryData<Client>(queryKeys.client('c1'))?.pinned).toBe(true);
    act(() => resolveRequest({ value: { ...sampleClient, pinned: true }, warning: null }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidation).toHaveBeenCalledWith({ queryKey: queryKeys.clients }); expect(invalidation).toHaveBeenCalledWith({ queryKey: queryKeys.client('c1') });
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: queryKeys.projects });
    queryClient.clear();
  });
  it('客户改名和重命名文件夹刷新相关名称与路径，不刷新其他客户的项目详情', async () => {
    const { queryClient, wrapper } = provider();
    queryClient.setQueryData(queryKeys.project('p1'), sampleProject);
    queryClient.setQueryData(queryKeys.project('p2'), { ...sampleProject, id: 'p2', clientId: 'c2' });
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    vi.mocked(api.clients.update).mockResolvedValue({ value: { ...sampleClient, name: '林设计' }, warning: 'folderRenameFailed：客户已保存。文件夹正在使用' });
    const { result } = renderHook(() => useUpdateClient(), { wrapper });
    await act(async () => { await result.current.mutateAsync({ id: 'c1', patch: { name: '林设计', renameFolder: true } }); });
    for (const queryKey of [queryKeys.allPayments, queryKeys.activities, queryKeys.files, queryKeys.project('p1')]) expect(invalidation).toHaveBeenCalledWith({ queryKey });
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: queryKeys.project('p2') });
    expect(toast.warning).toHaveBeenCalledWith('文件夹重命名失败：客户已保存。文件夹正在使用');
    queryClient.clear();
  });
  it('删除最新备注后刷新所属客户的最近动态时间', async () => {
    const { queryClient, wrapper } = provider();
    const activity: Activity = { id: 'a1', clientId: 'c1', projectId: null, projectTitle: null, clientName: '林女士', kind: 'note', body: '确认需求', meta: {}, createdAt: '' };
    queryClient.setQueryData(queryKeys.recentActivities(10), [activity]);
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    vi.mocked(api.activities.delete).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteActivity(), { wrapper });
    await act(async () => { await result.current.mutateAsync('a1'); });
    expect(invalidation).toHaveBeenCalledWith({ queryKey: queryKeys.clients });
    expect(invalidation).toHaveBeenCalledWith({ queryKey: queryKeys.client('c1') });
    expect(invalidation).not.toHaveBeenCalledWith({ queryKey: queryKeys.client() });
    queryClient.clear();
  });
  it('换文件库同步刷新项目文件计数', async () => {
    const { queryClient, wrapper } = provider();
    const invalidation = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    vi.mocked(api.library.setRoot).mockResolvedValue({ root: 'D:/设计库', state: 'ready', freeBytes: null, message: '' });
    const { result } = renderHook(() => useSetLibraryRoot(), { wrapper });
    await act(async () => { await result.current.mutateAsync('D:/设计库'); });
    for (const queryKey of [queryKeys.library, queryKeys.files, queryKeys.projects, queryKeys.project()]) expect(invalidation).toHaveBeenCalledWith({ queryKey });
    queryClient.clear();
  });
  it('完成状态乐观补上日期，服务端返回后采用实际结果', async () => {
    const { queryClient, wrapper } = provider();
    queryClient.setQueryData(queryKeys.projects, [sampleProject]); queryClient.setQueryData(queryKeys.project('p1'), sampleProject);
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    let resolveRequest: (value: Project) => void = () => undefined;
    vi.mocked(api.projects.setStatus).mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
    const { result } = renderHook(() => useSetProjectStatus(), { wrapper });
    act(() => result.current.mutate({ id: 'p1', status: 'done' }));
    await waitFor(() => expect(queryClient.getQueryData<Project>(queryKeys.project('p1'))?.completedAt).toBe(today()));
    const saved = { ...sampleProject, status: 'done' as const, completedAt: today(), updatedAt: '2026-11-03T00:00:00Z' };
    act(() => resolveRequest(saved));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<Project>(queryKeys.project('p1'))).toEqual(saved);
    queryClient.clear();
  });
});
describe('键盘、复制与拖放辅助', () => {
  it('修饰键精确匹配，新建客户不误触新建项目', () => {
    const event = new KeyboardEvent('keydown', { key: 'N', ctrlKey: true, shiftKey: true });
    expect(hotkeyMatches(event, 'ctrl+shift+n')).toBe(true); expect(hotkeyMatches(event, 'ctrl+n')).toBe(false);
    expect(hotkeyMatches(new KeyboardEvent('keydown', { key: 'k', metaKey: true }), 'ctrl+k')).toBe(true);
  });
  it('输入框仍可用全局快捷键，普通/不打断输入', () => {
    const command = vi.fn(); const search = vi.fn();
    const { unmount } = renderHook(() => useHotkeys({ 'ctrl+k': command, '/': search }));
    const input = document.createElement('input'); document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    expect(command).toHaveBeenCalledTimes(1); expect(search).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true })); expect(search).toHaveBeenCalledTimes(1);
    unmount(); input.remove();
  });
  it('空属性的富文本编辑区也保留普通输入键', () => {
    const search = vi.fn(); const { unmount } = renderHook(() => useHotkeys({ '/': search }));
    const editor = document.createElement('div'); editor.setAttribute('contenteditable', ''); const child = document.createElement('span'); editor.append(child); document.body.append(editor);
    child.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    expect(search).not.toHaveBeenCalled(); unmount(); editor.remove();
  });
  it('复制原样保留换行并在1.2秒恢复图标', async () => {
    vi.useFakeTimers(); const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { result, unmount } = renderHook(() => useCopy());
    await act(async () => { expect(await result.current.copy('您好\n请确认设计稿')).toBe(true); });
    expect(writeText).toHaveBeenCalledWith('您好\n请确认设计稿'); expect(result.current.copied).toBe(true);
    act(() => vi.advanceTimersByTime(1200)); expect(result.current.copied).toBe(false); unmount();
  });
  it('从目标子元素查找合法目标，保留id中的冒号', () => {
    const parent = document.createElement('div'); parent.dataset.dropTarget = 'project:p:1'; const child = document.createElement('span'); parent.append(child);
    expect(dropTarget(child)).toEqual({ projectId: 'p:1' }); parent.dataset.dropTarget = 'client:c1'; expect(dropTarget(child)).toEqual({ clientId: 'c1' });
    parent.dataset.dropTarget = 'project:'; expect(dropTarget(child)).toBeNull(); parent.dataset.dropTarget = 'other:x'; expect(dropTarget(child)).toBeNull();
  });
});
