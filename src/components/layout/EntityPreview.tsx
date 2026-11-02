import { useClient, useProject } from '../../hooks/queries';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { Avatar, DueChip, EmptyState, Money, SidePanel, Skeleton, StatusPill } from '../ui';
import { PaymentQuickForm } from '../payments/PaymentQuickForm';

export function EntityPreview() {
  const nav = useNav(); const route = nav.entries[nav.index]; const { projectId, clientId, payment } = route.params;
  const { data: project, isPending: loadingProject } = useProject(projectId); const { data: client, isPending: loadingClient } = useClient(clientId);
  const width = useUI(s => s.panelWidth); const setWidth = useUI(s => s.setPanelWidth);
  const close = () => { const { projectId: _p, clientId: _c, payment: _m, ...params } = route.params; nav.navigate(route.page, params); };
  return <SidePanel open={!!(projectId || clientId)} onOpenChange={open => { if (!open) close(); }} title={projectId ? '项目详情' : '客户详情'} width={width} onWidthChange={setWidth}>
    {((projectId && loadingProject) || (clientId && loadingClient)) ? <div className="space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" /></div> : project ? <div className="space-y-6">
      <div><h2 className="mb-2 text-xl font-semibold">{project.title}</h2><button type="button" className="text-accent hover:underline" onClick={() => nav.navigate('clients', { clientId: project.clientId })}>{project.clientName}</button></div>
      <div className="flex items-center gap-3"><StatusPill status={project.status} /><DueChip date={project.dueDate} status={project.status} /></div>
      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-subtle p-4"><div><dt className="text-xs text-fg-2">报价</dt><dd className="mt-1 text-lg"><Money cents={project.priceCents} /></dd></div><div><dt className="text-xs text-fg-2">已收</dt><dd className="mt-1 text-lg"><Money cents={project.receivedCents} /></dd></div></dl>
      {payment && <PaymentQuickForm key={project.id} project={project} />}
      <EmptyState title="项目已就绪" description="完整详情、文件与动态将在下一阶段实现" />
    </div> : client ? <div className="space-y-6"><div className="flex items-center gap-3"><Avatar id={client.id} name={client.name} size="lg" /><div><h2 className="text-xl font-semibold">{client.name}</h2><p className="text-fg-2">{client.company}</p></div></div><p className="text-fg-2">{client.projectCount} 个项目 · 累计收款 <Money cents={client.receivedCents} /></p><EmptyState title="客户已就绪" description="完整客户详情将在下一阶段实现" /></div> : <EmptyState title="记录暂不可用" description="该记录可能已被删除，请关闭后重新搜索。" />}
  </SidePanel>;
}
