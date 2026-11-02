import type { ReactNode } from 'react';
import type { EventCallback } from '@tauri-apps/api/event';
import type { DragDropEvent } from '@tauri-apps/api/webview';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { useFileDrop } from './useFileDrop';

const native = vi.hoisted(() => ({ listen: vi.fn(), stop: vi.fn() }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ onDragDropEvent: native.listen }) }));
vi.mock('../api/client', () => ({ api: { files: { add: vi.fn().mockResolvedValue([]) } }, isTauri: true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

function provider() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return { queryClient, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> };
}
describe('Tauri文件拖放', () => {
  it('将物理坐标换算为CSS坐标，定位目标并交给文件API', async () => {
    let listener: EventCallback<DragDropEvent> | undefined;
    native.listen.mockImplementation((callback: EventCallback<DragDropEvent>) => { listener = callback; return Promise.resolve(native.stop); });
    vi.stubGlobal('devicePixelRatio', 2);
    const target = document.createElement('div'); target.dataset.dropTarget = 'client:c1';
    const atPoint = vi.fn().mockReturnValue(target); Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: atPoint });
    const { queryClient, wrapper } = provider(); const { unmount } = renderHook(() => useFileDrop(), { wrapper });
    await waitFor(() => expect(native.listen).toHaveBeenCalledTimes(1));
    const payload = { type: 'over' as const, position: new PhysicalPosition(80, 120) };
    act(() => { listener?.({ event: 'tauri://drag-over', id: 1, payload }); });
    expect(atPoint).toHaveBeenCalledWith(40, 60); expect(target.dataset.dropActive).toBe('true');
    act(() => { listener?.({ event: 'tauri://drag-drop', id: 2, payload: { ...payload, type: 'drop', paths: ['D:/原稿/名片.pdf'] } }); });
    await waitFor(() => expect(api.files.add).toHaveBeenCalledWith({ clientId: 'c1' }, ['D:/原稿/名片.pdf'], undefined));
    expect(target.hasAttribute('data-drop-active')).toBe(false);
    unmount(); expect(native.stop).toHaveBeenCalledTimes(1); queryClient.clear();
  });
  it('组件先卸载时仍清理稍后返回的原生监听', async () => {
    let resolveListen: (stop: () => void) => void = () => undefined;
    let listener: EventCallback<DragDropEvent> | undefined;
    native.listen.mockImplementation((callback: EventCallback<DragDropEvent>) => {
      listener = callback; return new Promise<() => void>(resolve => { resolveListen = resolve; });
    });
    const { queryClient, wrapper } = provider(); const { unmount } = renderHook(() => useFileDrop(), { wrapper });
    await waitFor(() => expect(native.listen).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => { resolveListen(native.stop); });
    expect(native.stop).toHaveBeenCalledTimes(1);
    act(() => { listener?.({ event: 'tauri://drag-drop', id: 2, payload: { type: 'drop', position: new PhysicalPosition(80, 120), paths: ['D:/稿件.png'] } }); });
    expect(api.files.add).not.toHaveBeenCalled(); queryClient.clear();
  });
});
