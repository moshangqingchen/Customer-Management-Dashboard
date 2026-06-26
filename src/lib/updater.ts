import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

import type { AvailableUpdate } from "../components/UpdateDialog";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface PendingUpdate extends AvailableUpdate {
  currentVersion: string;
  native: Update;
}

export async function checkForAppUpdate(): Promise<PendingUpdate | null> {
  if (!isTauri) return null;

  const update = await check({ timeout: 7_000 });
  if (!update) return null;

  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date,
    body: update.body,
    native: update,
  };
}

export async function installAppUpdate(update: PendingUpdate, onProgress: (progress: number) => void): Promise<void> {
  let downloaded = 0;
  let total = 0;

  await update.native.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      downloaded = 0;
      total = event.data.contentLength ?? 0;
      onProgress(total > 0 ? 1 : 0);
      return;
    }

    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      if (total > 0) onProgress(Math.min(99, (downloaded / total) * 100));
      return;
    }

    onProgress(100);
  });
}

export async function closePendingUpdate(update: PendingUpdate): Promise<void> {
  await update.native.close().catch(() => undefined);
}
