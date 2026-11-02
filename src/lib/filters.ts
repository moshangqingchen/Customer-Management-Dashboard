import type { Client, Project, ProjectStatus } from '../api/types';
import { isOverdue, monthEnd, monthStart, today, weekEnd, weekStart } from './dates';
import { outstanding, paymentStatus, type PaymentStatus } from './money';
import { matchesSearch } from './search';

export interface ProjectFilters {
  query?: string; statuses?: ProjectStatus[]; tagIds?: string[]; clientId?: string;
  paymentStatus?: PaymentStatus; due?: 'overdue' | 'week' | 'month' | 'none';
  sourcePlatform?: string; pinned?: boolean; outstanding?: boolean;
}
export type ProjectSort = 'dueDate' | 'updatedAt' | 'price' | 'createdAt';
export type ClientSort = 'recent' | 'received' | 'name' | 'createdAt';
export function filterProjects(projects: readonly Project[], filters: ProjectFilters = {}, base = today()): Project[] {
  return projects.filter(project => {
    if (filters.query && !matchesSearch(`${project.title} ${project.clientName} ${project.brief} ${project.sourceOrderNo}`, filters.query)) return false;
    if (filters.statuses?.length && !filters.statuses.includes(project.status)) return false;
    if (filters.tagIds?.some(id => !project.tagIds.includes(id))) return false;
    if (filters.clientId && project.clientId !== filters.clientId) return false;
    if (filters.paymentStatus && paymentStatus(project.priceCents, project.receivedCents) !== filters.paymentStatus) return false;
    if (filters.sourcePlatform && project.sourcePlatform !== filters.sourcePlatform) return false;
    if (filters.pinned !== undefined && project.pinned !== filters.pinned) return false;
    if (filters.outstanding && outstanding(project.priceCents, project.receivedCents, project.status) <= 0) return false;
    if (filters.due === 'overdue' && !isOverdue(project.dueDate, project.status, base)) return false;
    if (filters.due === 'none' && project.dueDate !== null) return false;
    if ((filters.due === 'week' || filters.due === 'month') && (!project.dueDate || project.dueDate < (filters.due === 'week' ? weekStart(base) : monthStart(base)) || project.dueDate > (filters.due === 'week' ? weekEnd(base) : monthEnd(base)))) return false;
    return true;
  });
}
export function sortProjects(projects: readonly Project[], sort: ProjectSort = 'dueDate'): Project[] {
  return [...projects].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    let order = 0;
    if (sort === 'dueDate') order = (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
    if (sort === 'updatedAt') order = b.updatedAt.localeCompare(a.updatedAt);
    if (sort === 'createdAt') order = b.createdAt.localeCompare(a.createdAt);
    if (sort === 'price') order = b.priceCents - a.priceCents;
    return order || a.title.localeCompare(b.title, 'zh-CN') || a.id.localeCompare(b.id);
  });
}
export function filterClients(clients: readonly Client[], query = '', tagIds: readonly string[] = []): Client[] {
  return clients.filter(client => tagIds.every(id => client.tagIds.includes(id)) && matchesSearch([client.name, client.company, client.phone, client.wechat, client.email, client.address, client.notes, ...client.accounts.flatMap(account => [account.platform, account.handle])].join(' '), query));
}
export function sortClients(clients: readonly Client[], sort: ClientSort = 'recent'): Client[] {
  return [...clients].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const order = sort === 'received' ? b.receivedCents - a.receivedCents : sort === 'name' ? a.name.localeCompare(b.name, 'zh-CN') : sort === 'createdAt' ? b.createdAt.localeCompare(a.createdAt) : b.lastActivityAt.localeCompare(a.lastActivityAt);
    return order || a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id);
  });
}
