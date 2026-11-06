import type { Activity } from '../api/types';
import { activitySummary } from './activity';

export type ActivityScope = 'all' | 'notes' | 'system';

export function filterActivities(activities: readonly Activity[], scope: ActivityScope, query: string): Activity[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return activities.filter(activity => {
    if (scope === 'notes' && activity.kind !== 'note') return false;
    if (scope === 'system' && activity.kind === 'note') return false;
    const names = Array.isArray(activity.meta.names) ? activity.meta.names.filter((name): name is string => typeof name === 'string') : [];
    const method = typeof activity.meta.method === 'string' ? activity.meta.method : '';
    const text = [activity.body, activitySummary(activity), activity.clientName, activity.projectTitle ?? '', method, ...names].join(' ').toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}
