import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Project } from '../../api/types';
import { clientProjectCounts, filterClientProjects, type ClientProjectView } from '../../lib/clients';
import { cn } from '../../lib/cn';
import { outstanding } from '../../lib/money';
import { useNav } from '../../stores/nav';
import { Button, DueChip, EmptyState, Input, Money, StatusPill } from '../ui';

const views: { value: ClientProjectView; label: string }[] = [
  { value: 'active', label: '进行中' }, { value: 'outstanding', label: '待收款' },
  { value: 'history', label: '历史' }, { value: 'all', label: '全部' },
];

export function ClientProjects({ clientId, projects, onCreate }: { clientId: string; projects: Project[]; onCreate: () => void }) {
  const [view, setView] = useState<ClientProjectView>('active');
  const [query, setQuery] = useState('');
  const navigate = useNav(state => state.navigate);
  const counts = useMemo(() => clientProjectCounts(projects), [projects]);
  const visible = useMemo(() => filterClientProjects(projects, view, query), [projects, view, query]);
  if (!projects.length) return <EmptyState title="还没有合作项目" description="为这个客户创建第一个项目，开始记录每一次合作。" action={<Button onClick={onCreate}>新建项目</Button>} />;
  return <section aria-label="客户项目" className="space-y-3">
    <div className="relative"><Search size={16} className="pointer-events-none absolute top-3 left-3 text-fg-3" /><Input aria-label="搜索此客户的项目" placeholder="搜索项目名称、需求或订单号" className="pl-9" value={query} onChange={event => setQuery(event.target.value)} /></div>
    <div role="group" aria-label="客户项目范围" className="flex flex-wrap gap-1 border-b border-line pb-3">
      {views.map(item => <button key={item.value} type="button" aria-pressed={view === item.value} className={cn('rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-hover', view === item.value ? 'bg-primary-soft font-medium text-primary' : 'text-fg-2')} onClick={() => setView(item.value)}>{item.label} <span className="tabular-nums">{counts[item.value]}</span></button>)}
    </div>
    {visible.length ? <div className="divide-y divide-line">{visible.map(project => {
      const unpaid = outstanding(project.priceCents, project.receivedCents, project.status);
      const open = (payment = false) => navigate('clients', { clientId, projectId: project.id, ...(payment ? { payment: true } : {}) });
      return <div key={project.id} data-drop-target={`project:${project.id}`} className="flex items-center gap-2 py-2">
        <button type="button" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-2 py-2 text-left hover:bg-hover" onClick={() => open()}>
          <div className="min-w-0 flex-1 basis-40"><p className="truncate font-medium">{project.title}</p><p className="mt-1 text-xs text-fg-2">{project.fileCount} 个文件 · 报价 <Money cents={project.priceCents} /></p></div>
          <div className="flex flex-wrap items-center gap-2"><StatusPill status={project.status} /><DueChip date={project.dueDate} status={project.status} /></div>
          <p className="w-full text-xs text-fg-2">已收 <Money cents={project.receivedCents} /> · 待收 <Money cents={unpaid} /></p>
        </button>
        {unpaid > 0 && <Button size="sm" variant="soft" aria-label={`为「${project.title}」记一笔`} onClick={() => open(true)}>记一笔</Button>}
      </div>;
    })}</div> : <div className="space-y-3 py-8 text-center"><p className="font-medium">{query ? '没有找到匹配项目' : view === 'active' ? '没有进行中项目' : view === 'outstanding' ? '没有待收款项目' : '还没有历史项目'}</p><p className="text-sm text-fg-2">{query ? '试试其他关键词，或切换项目范围。' : view === 'active' ? '已完成和已取消的项目都保留在历史中。' : '可以切换到全部，查看这个客户的所有项目。'}</p><Button size="sm" onClick={() => { setQuery(''); setView(view === 'active' && counts.history > 0 && !query ? 'history' : 'all'); }}>{view === 'active' && counts.history > 0 && !query ? '查看历史项目' : '查看全部项目'}</Button></div>}
  </section>;
}
