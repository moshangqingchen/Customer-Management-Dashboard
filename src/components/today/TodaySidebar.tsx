import { lazy, Suspense } from 'react';
import { ActivityIcon } from '../activity/ActivityEvent';
import { activitySummary } from '../../lib/activity';
import type { Activity, Project } from '../../api/types';
import { activityTime } from '../../lib/today';
import { outstanding } from '../../lib/money';
import { useNav } from '../../stores/nav';
import { Button, Card, EmptyState, Money, Section, Skeleton } from '../ui';
import type { TodayOverview } from './TodayProjects';

const IncomeChart = lazy(() => import('./TodayIncomeChart'));

export function TodayIncome({ overview }: { overview: TodayOverview }) {
  const navigate = useNav(s => s.navigate);
  return <Card className="min-w-0 p-5 xl:p-6"><Section title="本月收入" action={<Button variant="ghost" size="sm" onClick={() => navigate('income')}>查看全部 →</Button>}>
    <div className="flex flex-wrap items-center gap-3"><Money cents={overview.current} className="text-stat font-bold" /><span className={`rounded-sm px-2 py-1 text-xs ${overview.change.tone === 'success' ? 'bg-success-bg text-success-fg' : overview.change.tone === 'danger' ? 'bg-danger-bg text-danger-fg' : 'bg-subtle text-fg-2'}`}>{overview.change.label}</span></div>
    <Suspense fallback={<Skeleton className="h-[174px]" />}><IncomeChart months={overview.months} /></Suspense>
  </Section></Card>;
}
export function TodayPayments({ projects }: { projects: Project[] }) {
  const navigate = useNav(s => s.navigate);
  return <Card className="min-w-0 p-5 xl:p-6"><Section title="待收款" action={<Button variant="ghost" size="sm" onClick={() => navigate('projects', { view: 'outstanding' })}>查看全部 →</Button>}>
    {projects.length === 0 ? <p className="py-5 text-sm text-fg-2">每一份付出，都已好好收到。</p> : <div className="divide-y divide-line">{projects.map(p => <div key={p.id} className="flex items-center gap-2 py-3">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate('today', { projectId: p.id })}><span className="block truncate text-[13px] font-medium">{p.title}</span><span className="block truncate text-xs text-fg-2">{p.clientName}</span></button><Money cents={outstanding(p.priceCents, p.receivedCents, p.status)} className="text-[13px] font-semibold" /><Button variant="soft" size="sm" aria-label={`为${p.title}记一笔收款`} onClick={() => navigate('today', { projectId: p.id, payment: true })}>记一笔</Button>
    </div>)}</div>}
  </Section></Card>;
}
export function TodayActivity({ activities, pending, error, onRetry, now }: { activities: Activity[]; pending: boolean; error: boolean; onRetry: () => void; now: Date }) {
  const navigate = useNav(s => s.navigate);
  return <Card className="min-w-0 p-5 md:col-span-2 xl:col-span-1 xl:p-6"><Section title="最近动态">
    {pending ? <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-9" />)}</div> : error ? <div className="space-y-2 text-sm text-fg-2"><p>动态暂时读取失败</p><Button size="sm" onClick={onRetry}>重新加载</Button></div> : activities.length === 0 ? <EmptyState illustrationName="empty-today" title="故事从这里开始" description="项目的新进展会记录在这里。" /> : <ol className="space-y-1">{activities.slice(0, 8).map(activity => {
      return <li key={activity.id} className="flex items-center gap-2 py-2"><ActivityIcon kind={activity.kind} /><button type="button" className="min-w-0 flex-1 truncate text-left text-[13px]" title={activity.body} onClick={() => activity.projectId ? navigate('today', { projectId: activity.projectId }) : navigate('clients', { clientId: activity.clientId })}><span className="font-medium">{activity.clientName}</span><span className="mx-1 text-fg-3">·</span><span className="text-fg-2">{activitySummary(activity)}</span></button><time dateTime={activity.createdAt} className="shrink-0 text-[11px] text-fg-3">{activityTime(activity.createdAt, now)}</time></li>;
    })}</ol>}
  </Section></Card>;
}
