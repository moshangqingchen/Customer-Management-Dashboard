import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { FileTarget } from '../api/types';
import { useFiles, useLibraryStatus, usePasteFiles, useSettings } from './queries';
import { filesAddedToast } from '../components/files/fileFeedback';

const destinations = new Map<string, string>();
const subscribers = new Set<() => void>();
const registrations = new Map<symbol, { priority: number; paste: () => void }>();
const targetKey = (target: FileTarget) => 'projectId' in target ? `project:${target.projectId}` : `client:${target.clientId}`;

export function useFileDestination(target: FileTarget) {
  const settings = useSettings(); const key = targetKey(target);
  const stored = useSyncExternalStore(listener => { subscribers.add(listener); return () => { subscribers.delete(listener); }; }, () => destinations.get(key));
  const subfolder = stored ?? ('projectId' in target ? settings.data?.subfolderTemplate[0] ?? '' : '');
  return { subfolder, setSubfolder: (value: string) => { destinations.set(key, value); subscribers.forEach(listener => listener()); } };
}

/** Registered by details, so paste still works when their file tab is closed. */
export function useFilePaste(target: FileTarget) {
  const { subfolder } = useFileDestination(target); const paste = usePasteFiles(); const library = useLibraryStatus(); const files = useFiles(target, 'clientId' in target);
  const current = useRef({ target, subfolder, paste, library, files }); current.current = { target, subfolder, paste, library, files };
  const key = targetKey(target);
  useEffect(() => {
    const token = Symbol(key);
    registrations.set(token, { priority: 'projectId' in target ? 2 : 1, paste: () => {
      const value = current.current;
      if (value.library.data?.state === 'ready' && !value.files.data?.folderMissing && !value.paste.isPending) value.paste.mutate({ target: value.target, subfolder: value.subfolder }, { onSuccess: filesAddedToast });
    } });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'v' || event.altKey || event.shiftKey) return;
      const element = event.target instanceof Element ? event.target : document.activeElement;
      const modalOpen = [...document.querySelectorAll('[role="dialog"]')].some(dialog => dialog.getAttribute('aria-modal') === 'true' || !dialog.querySelector('[data-drop-target]'));
      if (element?.closest('input,textarea,[contenteditable]:not([contenteditable="false"])') || modalOpen) return;
      const active = [...registrations].sort((a, b) => b[1].priority - a[1].priority).at(0);
      if (active?.[0] !== token) return;
      event.preventDefault(); active[1].paste();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { registrations.delete(token); window.removeEventListener('keydown', onKeyDown); };
  }, [key]);
}
