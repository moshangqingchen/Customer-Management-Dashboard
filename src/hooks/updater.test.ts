import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { check } from '@tauri-apps/plugin-updater';
import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { checkForUpdates, UPDATER_PROXY, useUpdater } from './useUpdater';

vi.mock('../api/client', () => ({ isTauri: true }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const createUpdate = () => ({ version: '2.1.0', currentVersion: '2.0.0', body: '更新说明', close: vi.fn().mockResolvedValue(undefined),
  downloadAndInstall: vi.fn().mockImplementation(async (onEvent: (event: DownloadEvent) => void) => {
    onEvent({ event: 'Started', data: { contentLength: 100 } });
    onEvent({ event: 'Progress', data: { chunkLength: 100 } });
  }),
} as unknown as Update);
beforeEach(() => {
  vi.clearAllMocks();
  useUpdater.setState({ checking: false, installing: false, available: null, open: false, error: null, downloaded: 0, total: null });
});
describe('桌面更新', () => {
  it('静默检查只标记更新，手动检查显示说明；重复检查释放旧资源', async () => {
    const old = createUpdate(); const next = createUpdate();
    vi.mocked(check).mockResolvedValueOnce(old).mockResolvedValueOnce(next);
    await checkForUpdates(true);
    expect(check).toHaveBeenCalledWith({ proxy: UPDATER_PROXY, timeout: 30000 });
    expect(useUpdater.getState()).toMatchObject({ available: old, open: false, checking: false });
    await useUpdater.getState().check();
    expect(useUpdater.getState().open).toBe(true);
    expect(old.close).toHaveBeenCalledOnce();
    expect(next.downloadAndInstall).not.toHaveBeenCalled();
  });
  it('合并同时发起的检查；代理失败不回退直连', async () => {
    vi.mocked(check).mockRejectedValue(new Error('proxy unavailable'));
    await Promise.all([checkForUpdates(true), checkForUpdates()]);
    expect(check).toHaveBeenCalledTimes(1);
    expect(useUpdater.getState().checking).toBe(false);
    expect(toast.error).toHaveBeenCalledOnce();
  });
  it('确认后报告下载进度并安装重启；失败保留重试入口', async () => {
    const update = createUpdate(); useUpdater.setState({ available: update, open: true });
    await useUpdater.getState().install();
    expect(update.downloadAndInstall).toHaveBeenCalledWith(expect.any(Function), { timeout: 120000, restartAfterInstall: true });
    expect(useUpdater.getState()).toMatchObject({ downloaded: 100, total: 100, installing: false });
    expect(relaunch).toHaveBeenCalledOnce();
    vi.mocked(update.downloadAndInstall).mockRejectedValueOnce(new Error('network'));
    await useUpdater.getState().install();
    expect(useUpdater.getState().error).toContain('更新安装失败');
    expect(useUpdater.getState().available).toBe(update);
  });
  it('无新版本时给出手动检查结果', async () => {
    vi.mocked(check).mockResolvedValue(null); await checkForUpdates();
    expect(toast.success).toHaveBeenCalledWith('当前已是最新版本');
  });
});
