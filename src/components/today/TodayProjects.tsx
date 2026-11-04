import { ProjectCover } from '../project/ProjectCover';
import { useSetProjectStatus } from '../../hooks/queries';
import { statusMeta } from '../../lib/status';
import type { todayOverview } from '../../lib/today';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { Avatar, Button, Card, DueChip, EmptyState, Money, Section, StatusPill, StatusSelect } from '../ui';

export type TodayOverview = ReturnType<typeof todayOverview>;
export function TodayProjects({ overview, base }: { overview: TodayOverview; base: string }) {
  const navigate = useNav(s => s.navigate); const setStatus = useSetProjectStatus(); const newProject = useUI(s => s.setNewProjectOpen); const newClient = useUI(s => s.setNewClientOpen);
  const open = (id: string) => navigate('today', { projectId: id });
  return <Card className="min-w-0 p-5 xl:p-6">
    <Section title={`需要关注${overview.attention.length ? ` · ${overview.attention.length}` : ''}`} action={<Button variant="ghost" size="sm" onClick={() => navigate('projects', { filters: { due: 'attention' } })}>查看全部 →</Button>}>
      {overview.attention.length === 0 ? <EmptyState illustrationName="empty-today" title="今天没有着急的事" description="按自己的节奏，安心创作吧。" action={overview.groups.every(g => !g.projects.length) ? <Button onClick={() => newClient(true)}>新建第一个客户</Button> : undefined} /> : <div className="divide-y divide-line border-t border-line">
        {overview.attention.slice(0, 5).map(p => <button type="button" key={p.id} onClick={() => open(p.id)} className="group flex w-full flex-wrap items-center gap-3 rounded-md py-3 text-left transition-colors hover:bg-hover focus-visible:bg-hover" aria-label={`打开项目：${p.title}`}>
          <Avatar id={p.clientId} name={p.clientName} size="lg" /><span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold group-hover:text-accent">{p.title}</span><span className="mt-0.5 block truncate text-xs text-fg-2">{p.clientName}</span></span>
          <span className="flex flex-wrap items-center gap-2"><StatusPill status={p.status} /><DueChip date={p.dueDate} status={p.status} base={base} /></span><Money cents={p.priceCents} className="ml-auto text-[15px] font-semibold" />
        </button>)}
      </div>}
    </Section>
    <div className="mt-5 border-t border-line pt-5"><Section title="进行中" action={<Button variant="ghost" size="sm" onClick={() => navigate('projects', { statuses: ['active', 'review', 'lead'] })}>查看全部 →</Button>}>
      {overview.groups.every(g => g.projects.length === 0) ? <EmptyState illustrationName="empty-projects" title="留一点空间，给新的灵感" description="新项目会在这里陪你一起向前。" action={<Button variant="soft" onClick={() => newProject(true)}>新建项目</Button>} /> : <div className="space-y-5">{overview.groups.filter(g => g.projects.length > 0).map(group => <div key={group.status}>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-fg-2"><span className={`size-1.5 rounded-full ${statusMeta[group.status].dotClass}`} />{statusMeta[group.status].label}<span className="text-fg-3">{group.projects.length}</span></div>
        <div className="divide-y divide-line">{group.projects.map(p => <div key={p.id} className="flex min-h-16 items-center gap-3 rounded-md py-2 hover:bg-hover">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => open(p.id)} aria-label={`打开项目：${p.title}`}><ProjectCover project={p} className="size-11" /><span className="min-w-0"><span className="block truncate font-medium">{p.title}</span><span className="mt-0.5 block truncate text-xs text-fg-2">{p.clientName}</span></span></button>
          <div className="w-[116px] shrink-0"><StatusSelect value={p.status} label={`${p.title}的状态`} onChange={status => setStatus.mutate({ id: p.id, status })} /></div>
        </div>)}</div>
      </div>)}</div>}
    </Section></div>
  </Card>;
}
