import type { Client, Project } from '../api/types';
import { parseISO } from 'date-fns';
import { relativeDate, today } from './dates';
import { filterProjects, sortProjects } from './filters';
import { outstanding } from './money';

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

export function activityDate(value: string | null, base = today()): string {
  if (!value) return '暂无动态';
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? '暂无动态' : relativeDate(today(date), base);
}

export type ClientView = 'all' | 'active' | 'outstanding' | 'pinned' | 'empty';
export const clientViewOptions: { value: ClientView; label: string }[] = [
  { value: 'all', label: '全部客户' }, { value: 'active', label: '有进行中项目' },
  { value: 'outstanding', label: '待收款' }, { value: 'pinned', label: '置顶' },
  { value: 'empty', label: '暂无项目' },
];
export function filterClientView(clients: readonly Client[], view: ClientView): Client[] {
  return clients.filter(client => view === 'active' ? client.openProjectCount > 0
    : view === 'outstanding' ? client.outstandingCents > 0
      : view === 'pinned' ? client.pinned : view === 'empty' ? client.projectCount === 0 : true);
}

export type ClientProjectView = 'active' | 'outstanding' | 'history' | 'all';
export function clientProjectCounts(projects: readonly Project[]): Record<ClientProjectView, number> {
  return {
    active: projects.filter(project => project.status !== 'done' && project.status !== 'cancelled').length,
    outstanding: projects.filter(project => outstanding(project.priceCents, project.receivedCents, project.status) > 0).length,
    history: projects.filter(project => project.status === 'done' || project.status === 'cancelled').length,
    all: projects.length,
  };
}
export function filterClientProjects(projects: readonly Project[], view: ClientProjectView, query = ''): Project[] {
  const filtered = filterProjects(projects, { query }).filter(project => view === 'active'
    ? project.status !== 'done' && project.status !== 'cancelled'
    : view === 'history' ? project.status === 'done' || project.status === 'cancelled'
      : view === 'outstanding' ? outstanding(project.priceCents, project.receivedCents, project.status) > 0 : true);
  return sortProjects(filtered, view === 'history' ? 'updatedAt' : 'smart');
}
export function primaryClientContact(client: Client): { label: string; value: string } | null {
  if (client.wechat.trim()) return { label: '微信', value: client.wechat };
  if (client.phone.trim()) return { label: '电话', value: client.phone };
  if (client.email.trim()) return { label: '邮箱', value: client.email };
  const account = client.accounts.find(item => item.handle.trim());
  return account ? { label: account.platform || '平台账号', value: account.handle } : null;
}
