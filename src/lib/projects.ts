import type { Project, ProjectStatus } from '../api/types';
import type { RouteParams } from '../stores/nav';
import type { ProjectFilters } from './filters';
import { dayDifference, today } from './dates';
import { boardStatuses } from './status';

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
