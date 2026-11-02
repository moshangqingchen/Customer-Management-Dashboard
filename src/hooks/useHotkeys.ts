import { useEffect, useRef } from 'react';

export type HotkeyBindings = Record<string, (event: KeyboardEvent) => void>;
const isEditing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"]'));
export function hotkeyMatches(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop() ?? '';
  const ctrl = parts.includes('ctrl') || parts.includes('mod');
  const meta = parts.includes('meta');
  return event.key.toLowerCase() === key && (ctrl ? event.ctrlKey || event.metaKey : meta ? event.metaKey : !event.ctrlKey && !event.metaKey) && event.altKey === parts.includes('alt') && event.shiftKey === parts.includes('shift');
}
/** Modified global shortcuts work inside fields. Plain keys never interrupt text editing. */
export function useHotkeys(bindings: HotkeyBindings, enabled = true): void {
  const latest = useRef(bindings);
  latest.current = bindings;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      for (const [shortcut, handler] of Object.entries(latest.current)) {
        if (!hotkeyMatches(event, shortcut)) continue;
        if (!event.ctrlKey && !event.metaKey && !event.altKey && isEditing(event.target)) return;
        event.preventDefault();
        handler(event);
        break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
