import { create } from 'zustand';
import { toast } from 'sonner';
import type { Update } from '@tauri-apps/plugin-updater';
import { isTauri } from '../api/client';

// Explicit proxy applies to both the manifest and payload. Never retry directly.
export const UPDATER_PROXY = 'http://127.0.0.1:10090';
interface UpdaterState {
  checking: boolean; installing: boolean; available: Update | null; open: boolean;
  downloaded: number; total: number | null; error: string | null;
  check: () => Promise<void>; install: () => Promise<void>; setOpen: (open: boolean) => void;
}
let checkingTask: Promise<void> | undefined;
let manualCheckRequested = false;
export const useUpdater = create<UpdaterState>((set, get) => ({
  checking: false, installing: false, available: null, open: false, downloaded: 0, total: null, error: null,
  check: () => checkForUpdates(),
  setOpen: open => { if (!get().installing) set({ open }); },
  install: async () => {
    const update = get().available;
    if (!update || get().installing || get().checking) return;
    set({ installing: true, downloaded: 0, total: null, error: null });
    try {
      await update.downloadAndInstall(event => {
        if (event.event === 'Started') set({ total: event.data.contentLength ?? null });
        if (event.event === 'Progress') set(state => ({ downloaded: state.downloaded + event.data.chunkLength }));
      }, { timeout: 120_000, restartAfterInstall: true });
      // Windows exits when NSIS starts; other desktop platforms need an explicit restart.
      await (await import('@tauri-apps/plugin-process')).relaunch();
    } catch {
      set({ error: '更新安装失败，请检查代理连接后重试。当前数据已保留。' });
    } finally { set({ installing: false }); }
  },
}));

export async function checkForUpdates(silent = false): Promise<void> {
  if (!isTauri) {
    if (!silent) toast.info('浏览器预览不检查更新，请在桌面应用中使用。');
    return;
  }
  if (useUpdater.getState().installing) return;
  if (!silent) manualCheckRequested = true;
  if (checkingTask) {
    await checkingTask;
    return;
  }
  checkingTask = (async () => {
    useUpdater.setState({ checking: true, error: null });
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check({ proxy: UPDATER_PROXY, timeout: 30_000 });
      const previous = useUpdater.getState().available;
      useUpdater.setState({ available: update, ...(manualCheckRequested && update ? { open: true } : {}) });
      if (previous && previous !== update) await previous.close().catch(() => undefined);
      if (manualCheckRequested && !update) toast.success('当前已是最新版本');
    } catch {
      if (manualCheckRequested) toast.error('检查更新失败，请检查代理连接或稍后重试。');
    } finally { useUpdater.setState({ checking: false }); }
  })();
  try { await checkingTask; } finally { checkingTask = undefined; manualCheckRequested = false; }
}
