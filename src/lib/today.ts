import { format, formatDistance, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { PaymentWithContext, Project } from '../api/types';
import { isDueSoon, isOpen, isOverdue, today, weekEnd, weekStart } from './dates';
import { outstanding } from './money';
import { monthlyStats } from './stats';

export const workingStatuses = ['active', 'review', 'lead'] as const;
export function attentionProjects(projects: readonly Project[], base = today()): Project[] {
  return projects.filter(p => isOverdue(p.dueDate, p.status, base) || isDueSoon(p.dueDate, p.status, base))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.id.localeCompare(b.id));
}
export function dueThisWeek(projects: readonly Project[], base = today()): Project[] {
  const from = weekStart(base); const to = weekEnd(base);
  return projects.filter(p => isOpen(p.status) && !!p.dueDate && p.dueDate >= from && p.dueDate <= to);
}
export interface IncomeChange { label: string; tone: 'success' | 'danger' | 'neutral'; percent: number | null }
export function incomeChange(current: number, previous: number): IncomeChange {
  if (previous === 0) return { label: current === 0 ? '与上月持平' : current > 0 ? '本月新增收入' : '本月净退款', tone: current === 0 ? 'neutral' : current > 0 ? 'success' : 'danger', percent: null };
  const percent = Math.round((current - previous) / Math.abs(previous) * 100);
  return { label: percent === 0 ? '与上月持平' : `较上月 ${percent > 0 ? '+' : ''}${percent}%`, tone: percent === 0 ? 'neutral' : percent > 0 ? 'success' : 'danger', percent };
}
export function todayOverview(projects: readonly Project[], payments: readonly PaymentWithContext[], base = today()) {
  const months = monthlyStats(projects, payments, 6, base);
  const current = months.at(-1)?.receivedCents ?? 0; const previous = months.at(-2)?.receivedCents ?? 0;
  const unpaid = projects.filter(p => outstanding(p.priceCents, p.receivedCents, p.status) > 0)
    .sort((a, b) => outstanding(b.priceCents, b.receivedCents, b.status) - outstanding(a.priceCents, a.receivedCents, a.status) || a.id.localeCompare(b.id));
  return { attention: attentionProjects(projects, base), activeCount: projects.filter(p => p.status === 'active').length,
    dueCount: dueThisWeek(projects, base).length, outstandingCents: unpaid.reduce((sum, p) => sum + outstanding(p.priceCents, p.receivedCents, p.status), 0),
    unpaid: unpaid.slice(0, 5), months, current, change: incomeChange(current, previous),
    groups: workingStatuses.map(status => ({ status, projects: projects.filter(p => p.status === status).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.id.localeCompare(b.id)) })),
  };
}
const dailyMessages = ['今天也闪闪发光', '慢慢来，比较快', '让好想法，慢慢发生', '认真生活，尽兴创作', '每一份用心，都有回响', '把灵感，变成喜欢的样子', '收个尾就去休息吧'];
export function heroContent(now: Date, dark = false) {
  const hour = now.getHours(); const period = hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 18 ? 'afternoon' : 'night';
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  return { image: `hero-${dark ? 'night' : period}`, greeting: period === 'morning' ? '早上好' : period === 'afternoon' ? '下午好' : '晚上好', message: dailyMessages[day % dailyMessages.length], date: format(now, 'EEEE，M月d日', { locale: zhCN }).replace('星期', '周') };
}
export const activityTime = (date: string, now = new Date()) => formatDistance(parseISO(date), now, { locale: zhCN, addSuffix: true });
