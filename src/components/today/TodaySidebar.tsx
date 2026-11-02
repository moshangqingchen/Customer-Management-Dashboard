import { lazy, Suspense } from 'react';
import { CircleCheck, FilePlus2, MessageSquare, Plus, Wallet } from 'lucide-react';
import type { Activity, Project } from '../../api/types';
import { activityTime } from '../../lib/today';
import { outstanding } from '../../lib/money';
import { useNav } from '../../stores/nav';
import { Button, Card, EmptyState, IconTile, Money, Section, Skeleton } from '../ui';
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
const activityMeta = { note: { Icon: MessageSquare, tone: 'violet' }, status: { Icon: CircleCheck, tone: 'amber' }, payment: { Icon: Wallet, tone: 'mint' }, file: { Icon: FilePlus2, tone: 'sky' }, created: { Icon: Plus, tone: 'peach' } } as const;
export function TodayActivity({ activities, pending, error, onRetry, now }: { activities: Activity[]; pending: boolean; error: boolean; onRetry: () => void; now: Date }) {
  const navigate = useNav(s => s.navigate);
  return <Card className="min-w-0 p-5 md:col-span-2 xl:col-span-1 xl:p-6"><Section title="最近动态">
    {pending ? <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-9" />)}</div> : error ? <div className="space-y-2 text-sm text-fg-2"><p>动态暂时读取失败</p><Button size="sm" onClick={onRetry}>重新加载</Button></div> : activities.length === 0 ? <EmptyState illustrationName="empty-today" title="故事从这里开始" description="项目的新进展会记录在这里。" /> : <ol className="space-y-1">{activities.map((activity, i) => {
      const { Icon, tone } = activityMeta[activity.kind];
      return <li key={activity.id} className="relative flex gap-3 py-2">{i !== activities.length - 1 && <span className="absolute top-12 bottom-[-10px] left-[17px] w-px bg-line" />}<IconTile tone={tone} size="sm"><Icon size={17} /></IconTile><button type="button" className="min-w-0 flex-1 text-left" onClick={() => activity.projectId ? navigate('today', { projectId: activity.projectId }) : navigate('clients', { clientId: activity.clientId })}><p className="text-[13px] leading-5"><span className="font-medium">{activity.clientName}</span><span className="mx-1.5 text-fg-3">·</span>{activity.body}</p>{activity.projectTitle && <p className="mt-0.5 truncate text-xs text-fg-2">{activity.projectTitle}</p>}<time dateTime={activity.createdAt} className="mt-1 block text-xs text-fg-3">{activityTime(activity.createdAt, now)}</time></button></li>;
    })}</ol>}
  </Section></Card>;
}
