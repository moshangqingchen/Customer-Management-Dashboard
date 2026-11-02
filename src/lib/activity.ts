import { format, parseISO } from 'date-fns';
import type { Activity, ProjectStatus } from '../api/types';
import { dateOffset, today } from './dates';
import { formatMoney } from './money';
import { statuses, statusMeta } from './status';

export function activityStatus(value: unknown): ProjectStatus | null {
  return typeof value === 'string' && statuses.includes(value as ProjectStatus) ? value as ProjectStatus : null;
}

export function activitySummary(activity: Activity): string {
  if (activity.kind === 'status') {
    const from = activityStatus(activity.meta.from); const to = activityStatus(activity.meta.to);
    if (from && to) return `${statusMeta[from].label} → ${statusMeta[to].label}`;
  }
  if (activity.kind === 'payment' && typeof activity.meta.amountCents === 'number') {
    const amount = activity.meta.kind === 'refund' ? -activity.meta.amountCents : activity.meta.amountCents;
    return `${activity.body} ${formatMoney(amount)}`;
  }
  if (activity.kind === 'file' && Array.isArray(activity.meta.names) && !activity.body.includes('个文件')) return `${activity.body} · ${activity.meta.names.length} 个文件`;
  return activity.body;
}

export function activityDayLabel(date: string, base = today()): string {
  if (date === base) return '今天';
  if (date === dateOffset(-1, base)) return '昨天';
  return format(parseISO(date), date.slice(0, 4) === base.slice(0, 4) ? 'M月d日' : 'yyyy年M月d日');
}

export function groupActivities(activities: Activity[], base = today()) {
  const groups = new Map<string, Activity[]>();
  [...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach(activity => {
    const day = today(parseISO(activity.createdAt));
    const existing = groups.get(day) ?? []; existing.push(activity); groups.set(day, existing);
  });
  return [...groups].map(([date, items]) => ({ date, label: activityDayLabel(date, base), items }));
}

export function relativeActivityTime(timestamp: string, now = new Date()): string {
  const value = parseISO(timestamp); const minutes = Math.max(0, Math.floor((now.getTime() - value.getTime()) / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const day = today(value); const base = today(now);
  if (day === base) return `${Math.floor(minutes / 60)} 小时前`;
  if (day === dateOffset(-1, base)) return `昨天 ${format(value, 'HH:mm')}`;
  return format(value, day.slice(0, 4) === base.slice(0, 4) ? 'M月d日 HH:mm' : 'yyyy年M月d日 HH:mm');
}
