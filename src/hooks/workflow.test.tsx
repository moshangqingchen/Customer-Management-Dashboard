import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { queryKeys, useCopyFiles, useFileThumbnail, usePasteFiles } from './queries';

vi.mock('../api/client', () => ({ api: { files: { thumbnail: vi.fn(), paste: vi.fn(), copyToClipboard: vi.fn() } }, isTauri: false }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
afterEach(() => vi.clearAllMocks());
function provider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}

describe('设计师工作流查询', () => {
  it('进入视口才请求，同一文件和尺寸共享缓存，修改版本会重新请求', async () => {
    const { client, wrapper } = provider();
    vi.mocked(api.files.thumbnail).mockResolvedValue('/sample.webp');
    const { result, rerender, unmount } = renderHook(({ visible, version }) => ({
      first: useFileThumbnail('D:/库/源文件.psd', 256, visible, version),
      second: useFileThumbnail('D:/库/源文件.psd', 256, visible, version),
    }), { wrapper, initialProps: { visible: false, version: 'v1' } });
    expect(api.files.thumbnail).not.toHaveBeenCalled();
    rerender({ visible: true, version: 'v1' });
    await waitFor(() => expect(result.current.first.data).toBe('/sample.webp'));
    expect(result.current.second.data).toBe('/sample.webp');
    expect(api.files.thumbnail).toHaveBeenCalledTimes(1);
    rerender({ visible: false, version: 'v1' }); rerender({ visible: true, version: 'v1' });
    expect(api.files.thumbnail).toHaveBeenCalledTimes(1);
    rerender({ visible: true, version: 'v2' });
    await waitFor(() => expect(api.files.thumbnail).toHaveBeenCalledTimes(2));
    unmount(); client.clear();
  });

  it('没有缩略图的null同样缓存，不因重新挂载重复请求', async () => {
    const { client, wrapper } = provider();
    vi.mocked(api.files.thumbnail).mockResolvedValue(null);
    const first = renderHook(() => useFileThumbnail('D:/库/文件.cdr', 1024), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true)); first.unmount();
    const second = renderHook(() => useFileThumbnail('D:/库/文件.cdr', 1024), { wrapper });
    expect(second.result.current.data).toBeNull(); expect(api.files.thumbnail).toHaveBeenCalledTimes(1);
    second.unmount(); client.clear();
  });

  it('粘贴刷新文件、项目、客户和动态；复制不失效业务查询', async () => {
    const { client, wrapper } = provider();
    client.setQueryData(queryKeys.project('p'), { id: 'p', clientId: 'c' });
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    vi.mocked(api.files.paste).mockResolvedValue({ added: [], failed: [{ name: '缺失.psd', message: '文件不存在' }] });
    const { result, unmount } = renderHook(() => ({ paste: usePasteFiles(), copy: useCopyFiles() }), { wrapper });
    await act(async () => { await result.current.paste.mutateAsync({ target: { projectId: 'p' }, subfolder: '参考资料' }); });
    expect(api.files.paste).toHaveBeenCalledWith({ projectId: 'p' }, '参考资料');
    for (const queryKey of [queryKeys.files, queryKeys.project('p'), queryKeys.client('c'), queryKeys.activities]) expect(invalidate).toHaveBeenCalledWith({ queryKey });
    invalidate.mockClear();
    await act(async () => { await result.current.copy.mutateAsync(['D:/库/稿件.psd']); });
    expect(api.files.copyToClipboard).toHaveBeenCalledWith(['D:/库/稿件.psd']); expect(invalidate).not.toHaveBeenCalled();
    unmount(); client.clear();
  });
});
