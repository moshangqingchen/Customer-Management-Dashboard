import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { isTauri } from '../api/client';
import type { FileTarget } from '../api/types';
import { useAddBrowserFiles, useAddFiles } from './queries';
import { filesAddedToast } from '../components/files/fileFeedback';

export function dropTarget(element: Element | null): FileTarget | null {
  const value = element?.closest<HTMLElement>('[data-drop-target]')?.dataset.dropTarget;
  if (!value) return null;
  const colon = value.indexOf(':');
  const kind = value.slice(0, colon); const id = value.slice(colon + 1);
  if (!id) return null;
  return kind === 'project' ? { projectId: id } : kind === 'client' ? { clientId: id } : null;
}
/** Mount once on the application shell. Targets declare data-drop-target="project:<id>". */
export function useFileDrop(enabled = true): void {
  const native = useAddFiles(); const browser = useAddBrowserFiles();
  const latest = useRef({ native, browser }); latest.current = { native, browser };
  useEffect(() => {
    if (!enabled) return;
    let highlighted: HTMLElement | null = null; let disposed = false; let unlisten: (() => void) | undefined;
    const clear = () => { highlighted?.removeAttribute('data-drop-active'); highlighted = null; };
    const highlight = (element: Element | null) => {
      const next = element?.closest<HTMLElement>('[data-drop-target]') ?? null;
      if (highlighted !== next) { clear(); highlighted = next; highlighted?.setAttribute('data-drop-active', 'true'); }
      return next;
    };
    const atPoint = (x: number, y: number) => document.elementFromPoint(x, y);
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; highlight(atPoint(event.clientX, event.clientY));
    };
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      const element = highlight(atPoint(event.clientX, event.clientY)); const target = dropTarget(element); clear();
      if (!target || !event.dataTransfer?.files.length) return;
      const files = Array.from(event.dataTransfer.files, file => ({ name: file.name, size: file.size }));
      latest.current.browser.mutate({ target, files, subfolder: element?.dataset.dropSubfolder }, { onSuccess: filesAddedToast });
    };
    const onLeave = (event: DragEvent) => { if (!event.relatedTarget) clear(); };
    if (isTauri) {
      void import('@tauri-apps/api/webview').then(async ({ getCurrentWebview }) => {
        const stop = await getCurrentWebview().onDragDropEvent(({ payload }) => {
          if (disposed) return;
          if (payload.type === 'leave') { clear(); return; }
          const element = highlight(atPoint(payload.position.x / window.devicePixelRatio, payload.position.y / window.devicePixelRatio));
          if (payload.type !== 'drop') return;
          const target = dropTarget(element); clear();
          if (target) latest.current.native.mutate({ target, sourcePaths: payload.paths, subfolder: element?.dataset.dropSubfolder }, { onSuccess: filesAddedToast });
        });
        if (disposed) stop(); else unlisten = stop;
      }).catch(() => { if (!disposed) toast.error('文件拖放未能启动，请使用添加文件按钮'); });
    } else {
      document.addEventListener('dragover', onDragOver); document.addEventListener('drop', onDrop); document.addEventListener('dragleave', onLeave); document.addEventListener('dragend', clear);
    }
    return () => { disposed = true; unlisten?.(); clear(); document.removeEventListener('dragover', onDragOver); document.removeEventListener('drop', onDrop); document.removeEventListener('dragleave', onLeave); document.removeEventListener('dragend', clear); };
  }, [enabled]);
}
