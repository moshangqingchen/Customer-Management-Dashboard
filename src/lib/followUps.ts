import type { FollowUp } from '../api/followUps';

export function localDateTime(iso: string): string {
  const date = new Date(iso); if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function localDateTimeToUtc(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && localDateTime(date.toISOString()) === value ? date.toISOString() : null;
}
export function isFollowUpDue(item: FollowUp, now = Date.now()): boolean {
  return item.status === 'pending' && item.projectAvailable && Date.parse(item.dueAt) <= now;
}
export function followUpsForToday(items: readonly FollowUp[], now = new Date()): FollowUp[] {
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return items.filter(item => item.status === 'pending' && Date.parse(item.dueAt) <= end.getTime())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
}

/** Server claims are persistent; this guard also avoids overlapping focus/interval checks. */
export function createFollowUpNotifier(claim: (id: string, revision: number) => Promise<boolean>, show: (item: FollowUp) => void) {
  let running = false;
  return async (items: readonly FollowUp[], now = Date.now()): Promise<void> => {
    if (running) return;
    running = true;
    try {
      let shown = 0; const seen = new Set<string>();
      for (const item of items) {
        const key = `${item.id}:${item.revision}`;
        if (!isFollowUpDue(item, now) || item.remindedRevision === item.revision || seen.has(key)) continue;
        seen.add(key);
        if (await claim(item.id, item.revision)) { show(item); shown += 1; }
        if (shown === 3) break;
      }
    } finally { running = false; }
  };
}
