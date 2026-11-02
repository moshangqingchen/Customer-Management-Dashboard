import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addBrowserFiles } from '../api/mock';
import { useFileDrop } from './useFileDrop';

vi.mock('../api/client', () => ({ api: { files: { add: vi.fn() } }, isTauri: false }));
vi.mock('../api/mock', () => ({ addBrowserFiles: vi.fn().mockResolvedValue([]) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function drag(type: string, files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const dataTransfer = { types: files.length ? ['Files'] : ['text/plain'], files, dropEffect: 'none' };
  Object.defineProperties(event, { clientX: { value: 42 }, clientY: { value: 80 }, dataTransfer: { value: dataTransfer } });
  return { event, dataTransfer };
}
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
describe('浏览器文件拖放', () => {
  it('悬停高亮、传递文件名大小和子目录，卸载后移除监听', async () => {
    const target = document.createElement('div'); target.dataset.dropTarget = 'project:p1'; target.dataset.dropSubfolder = '交付成品';
    const child = document.createElement('span'); target.append(child); document.body.append(target);
    const atPoint = vi.fn().mockReturnValue(child);
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: atPoint });
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { unmount } = renderHook(() => useFileDrop(), { wrapper });
    const file = new File(['作品'], '海报.svg', { type: 'image/svg+xml' });
    const over = drag('dragover', [file]); document.dispatchEvent(over.event);
    expect(target.dataset.dropActive).toBe('true'); expect(over.dataTransfer.dropEffect).toBe('copy'); expect(over.event.defaultPrevented).toBe(true);
    const drop = drag('drop', [file]);
    act(() => { document.dispatchEvent(drop.event); });
    await waitFor(() => expect(addBrowserFiles).toHaveBeenCalledWith({ projectId: 'p1' }, [{ name: '海报.svg', size: file.size }], '交付成品'));
    expect(target.hasAttribute('data-drop-active')).toBe(false); expect(atPoint).toHaveBeenCalledWith(42, 80);
    unmount();
    const stopped = drag('dragover', [file]); document.dispatchEvent(stopped.event);
    expect(stopped.event.defaultPrevented).toBe(false); target.remove(); queryClient.clear();
  });
  it('文本拖放保留浏览器默认行为', () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const { unmount } = renderHook(() => useFileDrop(), { wrapper });
    const { event } = drag('drop'); document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false); expect(addBrowserFiles).not.toHaveBeenCalled();
    unmount(); queryClient.clear();
  });
});
