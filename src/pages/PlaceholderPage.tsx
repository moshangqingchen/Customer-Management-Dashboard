import { Plus } from 'lucide-react';
import { useClients, useProjects, useTags } from '../hooks/queries';
import { useNav, pageLabels } from '../stores/nav';
import { useUI } from '../stores/ui';
import { Button, EmptyState } from '../components/ui';
import * as Illustrations from '../components/illustrations';
import { PageHeader } from '../components/layout/PageHeader';
import { statusMeta } from '../lib/status';

export function PlaceholderPage() {
  const nav = useNav(); const route = nav.entries[nav.index]; const { page, params } = route;
  const ui = useUI(); const { data: projects = [] } = useProjects(); const { data: clients = [] } = useClients(); const { data: tags = [] } = useTags();
  const names = { pinned: '置顶', overdue: '逾期', outstanding: '待收款' };
  const filter = [params.view ? names[params.view] : undefined, tags.find(t => t.id === params.tagId)?.name,
    params.statuses?.map(status => statusMeta[status].label).join('、'), params.due === 'week' ? '本周到期' : undefined].filter(Boolean).join(' · ');
  const title = pageLabels[page];
  const illustrationKey = page === 'clients' ? 'clients' : page === 'projects' ? 'projects' : page === 'files' ? 'files' : page === 'snippets' ? 'snippets' : page === 'settings' ? 'offline' : 'today';
  return <div className="flex min-h-full flex-col gap-6 p-7">
    <PageHeader title={title} meta={filter || undefined} count={page === 'projects' ? projects.length : page === 'clients' ? clients.length : undefined}
      actions={page === 'today' || page === 'projects' ? <Button variant="primary" onClick={() => ui.setNewProjectOpen(true)}><Plus size={16} />新建项目</Button> : page === 'clients' ? <Button variant="primary" onClick={() => ui.setNewClientOpen(true)}><Plus size={16} />新建客户</Button> : undefined} />
    <div className="flex min-h-[400px] flex-1 items-center justify-center rounded-xl border border-line/60 bg-surface shadow-sm">
      <EmptyState title={`${title}，已准备就绪`} description="这里将收纳你的工作日常，更多功能即将到来。" illustration={<Illustrations.Illustration kind={illustrationKey} />}
        action={page === 'today' ? <Button variant="secondary" onClick={() => ui.setNewClientOpen(true)}>新建第一个客户</Button> : undefined} />
    </div>
    <p className="text-center text-xs text-fg-3">随时按 Ctrl+K 搜索客户、项目和话术</p>
  </div>;
}
