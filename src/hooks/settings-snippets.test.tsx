import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { mockApi } from '../api/mock';
import { reset } from '../api/mock/store';
import { queryKeys, useReorderSnippetGroups, useRestoreBackup, useSetLibraryRoot, useSettings, useSnippetGroups } from './queries';

let q: QueryClient;
beforeEach(async () => { reset(); await mockApi.library.setRoot('D:/客户工作台'); q = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); });
afterEach(() => { q.clear(); vi.restoreAllMocks(); });
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={q}>{children}</QueryClientProvider>;

describe('设置与话术缓存更新', () => {
  it('分组排序持久化并在失败时重新读取服务端顺序', async () => {
    const { result } = renderHook(() => ({ groups: useSnippetGroups(), reorder: useReorderSnippetGroups() }), { wrapper });
    await waitFor(() => expect(result.current.groups.isSuccess).toBe(true));
    await act(async () => result.current.reorder.mutateAsync(['group-3', 'group-1', 'group-2']));
    expect((await mockApi.snippetGroups.list()).map(group => group.id)).toEqual(['group-3', 'group-1', 'group-2']);
    const original = mockApi.snippetGroups.update;
    vi.spyOn(mockApi.snippetGroups, 'update').mockImplementation(async (id, patch) => { if (id === 'group-2') throw new Error('模拟写入失败'); return original(id, patch); });
    await act(async () => { await expect(result.current.reorder.mutateAsync(['group-2', 'group-3', 'group-1'])).rejects.toThrow('模拟写入失败'); });
    await waitFor(() => expect(result.current.groups.data?.map(group => group.id)).toEqual(['group-3', 'group-1', 'group-2']));
  });

  it('恢复备份移除旧缓存并重新读取所有活动查询', async () => {
    const backup = await mockApi.backups.create();
    await mockApi.settings.update({ paymentMethods: ['验收付款方式'] });
    const { result } = renderHook(() => ({ settings: useSettings(), restore: useRestoreBackup() }), { wrapper });
    await waitFor(() => expect(result.current.settings.data?.paymentMethods).toEqual(['验收付款方式']));
    q.setQueryData(queryKeys.client('stale'), { id: 'stale' });
    await act(async () => result.current.restore.mutateAsync(backup.fileName));
    await waitFor(() => expect(result.current.settings.data?.paymentMethods).toContain('微信'));
    expect(q.getQueryData(queryKeys.client('stale'))).toBeUndefined();
  });

  it('文件库更换后让备份和客户文件信息失效', async () => {
    await api.library.status();
    q.setQueryData(queryKeys.backups, []); q.setQueryData(queryKeys.client('client-1'), { id: 'client-1' });
    const { result } = renderHook(() => useSetLibraryRoot(), { wrapper });
    await act(async () => result.current.mutateAsync('E:/客户资料'));
    expect(q.getQueryState(queryKeys.backups)?.isInvalidated).toBe(true);
    expect(q.getQueryState(queryKeys.client('client-1'))?.isInvalidated).toBe(true);
  });
});
