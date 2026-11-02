import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, format, isValid, nextMonday, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { ProjectStatus } from '../api/types';
export const today = (now: Date = new Date()): string => format(now, 'yyyy-MM-dd');
export const dateOffset = (days: number, base = today()): string => today(addDays(parseISO(base), days));
export const validDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value)) && today(parseISO(value)) === value;
export const dayDifference = (date: string, base = today()) => differenceInCalendarDays(parseISO(date), parseISO(base));
export const isOpen = (status?: ProjectStatus) => status !== 'done' && status !== 'cancelled';
export const isOverdue = (date: string | null, status?: ProjectStatus, base = today()): boolean => !!date && isOpen(status) && dayDifference(date, base) < 0;
export const isDueSoon = (date: string | null, status?: ProjectStatus, base = today(), days = 3): boolean => !!date && isOpen(status) && dayDifference(date, base) >= 0 && dayDifference(date, base) <= days;
export function relativeDate(date: string | null, base = today(), overdue = false): string {
  if (!date) return '无截止日';
  const delta = dayDifference(date, base);
  if (overdue && delta < 0) return `逾期 ${-delta} 天`;
  if (delta === 0) return '今天';
  if (delta === 1) return '明天';
  if (delta === -1) return '昨天';
  if (delta > 1 && delta <= 7) return `${delta} 天后`;
  if (delta < -1 && delta >= -7) {
    const lastWeek = startOfWeek(addDays(parseISO(base), -7), { weekStartsOn: 1 });
    if (parseISO(date) >= lastWeek && parseISO(date) < startOfWeek(parseISO(base), { weekStartsOn: 1 })) return `上${format(parseISO(date), 'EEEE', { locale: zhCN }).replace('星期', '周')}`;
    return `${-delta} 天前`;
  }
  return format(parseISO(date), date.slice(0, 4) === base.slice(0, 4) ? 'M月d日' : 'yyyy年M月d日', { locale: zhCN });
}
export function quickDates(base = today()) {
  return [{ label: '今天', value: base }, { label: '明天', value: dateOffset(1, base) }, { label: '3天后', value: dateOffset(3, base) }, { label: '下周一', value: today(nextMonday(parseISO(base))) }];
}
export const weekEnd = (base = today()) => today(endOfWeek(parseISO(base), { weekStartsOn: 1 }));
export const monthEnd = (base = today()) => today(endOfMonth(parseISO(base)));
export const weekStart = (base = today()) => today(startOfWeek(parseISO(base), { weekStartsOn: 1 }));
export const monthStart = (base = today()) => today(startOfMonth(parseISO(base)));
