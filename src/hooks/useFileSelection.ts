import { useEffect, useState } from 'react';
import type { FileEntry } from '../api/types';

export interface SelectionModifiers { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; }
export function useFileSelection(files: readonly FileEntry[]) {
  const [paths, setPaths] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string>();
  const selected = files.filter(file => paths.has(file.path));
  useEffect(() => {
    const visible = new Set(files.map(file => file.path));
    setPaths(previous => {
      const next = new Set([...previous].filter(path => visible.has(path)));
      return next.size === previous.size ? previous : next;
    });
    setAnchor(previous => previous && visible.has(previous) ? previous : undefined);
  }, [files]);
  function select(path: string, modifiers: SelectionModifiers) {
    const anchorIndex = files.findIndex(file => file.path === anchor);
    const index = files.findIndex(file => file.path === path);
    setPaths(previous => {
      if (modifiers.shiftKey && anchorIndex >= 0 && index >= 0) {
        const next = modifiers.ctrlKey || modifiers.metaKey ? new Set(previous) : new Set<string>();
        for (const file of files.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1)) next.add(file.path);
        return next;
      }
      if (modifiers.ctrlKey || modifiers.metaKey) {
        const next = new Set(previous); if (next.has(path)) next.delete(path); else next.add(path); return next;
      }
      return new Set([path]);
    });
    if (!modifiers.shiftKey || anchorIndex < 0) setAnchor(path);
  }
  return { selected, isSelected: (path: string) => selected.some(file => file.path === path), select, clear: () => { setPaths(new Set()); setAnchor(undefined); } };
}
