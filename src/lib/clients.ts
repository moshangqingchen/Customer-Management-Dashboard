import type { Client } from '../api/types';
import { parseISO } from 'date-fns';
import { relativeDate, today } from './dates';

export const contactFields = [
  { key: 'phone', label: '电话' }, { key: 'wechat', label: '微信' },
  { key: 'email', label: '邮箱' }, { key: 'address', label: '地址' },
] as const;
export type ContactField = typeof contactFields[number]['key'];
export const clientContactFields = (client: Client, includeEmpty = false) => contactFields.filter(field => includeEmpty || !!client[field.key]);
export function cooperationDate(value: string | null, base = today()): string {
  if (!value) return '暂无合作';
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? '暂无合作' : relativeDate(today(date), base);
}
