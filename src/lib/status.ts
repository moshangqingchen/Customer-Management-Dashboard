import type { ProjectStatus } from '../api/types';
export const statusMeta: Record<ProjectStatus, { label: string; className: string; dotClass: string; board: boolean }> = {
  lead: { label: '洽谈中', className: 'bg-lead-bg text-lead-fg border-lead-border', dotClass: 'bg-lead-fg', board: true },
  active: { label: '进行中', className: 'bg-info-bg text-info-fg border-info-border', dotClass: 'bg-info-fg', board: true },
  review: { label: '待确认', className: 'bg-warning-bg text-warning-fg border-warning-border', dotClass: 'bg-warning-fg', board: true },
  delivered: { label: '已交付', className: 'bg-delivered-bg text-delivered-fg border-delivered-border', dotClass: 'bg-delivered-fg', board: true },
  done: { label: '已完成', className: 'bg-success-bg text-success-fg border-success-border', dotClass: 'bg-success-fg', board: true },
  cancelled: { label: '已取消', className: 'bg-subtle text-fg-2 border-line', dotClass: 'bg-fg-3', board: false },
};
export const statuses = Object.keys(statusMeta) as ProjectStatus[];
export const boardStatuses = statuses.filter(s => statusMeta[s].board);
