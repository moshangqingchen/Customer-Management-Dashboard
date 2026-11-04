import type { Project } from '../../api/types';
import type { RouteParams } from '../../stores/nav';
import { projectViewCounts } from '../../lib/projects';
import { cn } from '../../lib/cn';

export function ProjectQuickViews({ projects, value, onChange }: { projects: Project[]; value?: RouteParams['view']; onChange: (value: RouteParams['view']) => void }) {
  const counts = projectViewCounts(projects);
  const items = [{ value: undefined, label: '全部' }, { value: 'pinned', label: `置顶 ${counts.pinned}` }, { value: 'overdue', label: `逾期 ${counts.overdue}` }, { value: 'outstanding', label: `待收款 ${counts.outstanding}` }] as const;
  return <div role="group" aria-label="项目快捷视图" className="inline-flex shrink-0 gap-1 rounded-full bg-subtle p-1">{items.map(item => <button key={item.value ?? 'all'} type="button" aria-pressed={value === item.value} onClick={() => onChange(item.value)} className={cn('h-8 rounded-full px-3 text-sm font-medium text-fg-2 hover:text-fg', value === item.value && 'bg-surface text-primary shadow-sm')}>{item.label}</button>)}</div>;
}
