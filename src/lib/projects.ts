import type { Project, ProjectStatus } from '../api/types';
import type { RouteParams } from '../stores/nav';
import type { ProjectFilters } from './filters';
import { dayDifference, today } from './dates';
import { boardStatuses } from './status';
import { outstanding } from './money';
import { isOverdue } from './dates';

export function projectViewCounts(projects: readonly Project[], base = today()) {
  return { pinned: projects.filter(project => project.pinned).length,
    overdue: projects.filter(project => isOverdue(project.dueDate, project.status, base)).length,
    outstanding: projects.filter(project => project.status !== 'cancelled' && outstanding(project.priceCents, project.receivedCents) > 0).length };
}

export function routeProjectFilters(params: RouteParams): ProjectFilters {
  return { ...(params.view === 'pinned' ? { pinned: true } : params.view === 'overdue' ? { due: 'overdue' } : params.view === 'outstanding' ? { outstanding: true } : {}),
    ...(params.tagId ? { tagIds: [params.tagId] } : {}), ...(params.statuses ? { statuses: params.statuses } : {}), ...(params.due ? { due: params.due } : {}), ...params.filters };
}
export interface BoardGroup { status: ProjectStatus; projects: Project[]; totalCents: number; hiddenCount: number }
export function groupBoard(projects: readonly Project[], showAllDone = false, base = today()): BoardGroup[] {
  return boardStatuses.map(status => {
    const all = projects.filter(project => project.status === status);
    const visible = all.filter(project => status !== 'done' || showAllDone || !!project.completedAt && dayDifference(project.completedAt, base) >= -30);
    return { status, projects: visible, totalCents: visible.reduce((sum, project) => sum + project.priceCents, 0), hiddenCount: all.length - visible.length };
  });
}
