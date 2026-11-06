import { useState } from 'react';
import { useEffect } from 'react';
import { Copy, FolderOpen, MoreHorizontal, Pin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '../../api/types';
import { useDeleteProject, useDuplicateProject, useOpenFolder, useProject, useRestoreTrash, useSetProjectStatus, useUpdateProject } from '../../hooks/queries';
import { projectMoney } from '../../lib/projectMoney';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { cn } from '../../lib/cn';
import { ActivityTimeline } from '../activity/ActivityTimeline';
import { FilesArea } from '../files/FilesArea';
import { useFileDestination, useFilePaste } from '../../hooks/useFilePaste';
import { SnippetPicker } from '../snippets/SnippetPicker';
import { ProjectMoneyCard } from '../payments/ProjectMoneyCard';
import { Avatar, Button, ConfirmDialog, Dialog, DropdownMenu, EmptyState, IconButton, InlineEdit, Skeleton, StatusSelect, Tabs, undoToast } from '../ui';
import { ProjectBrief } from './ProjectBrief';
import { ProjectDueDate, ProjectProperties } from './ProjectProperties';
import { ProjectMoneySummary } from './ProjectMoneySummary';

function ProjectContent({ project, initialPayment, onDeleted }: { project: Project; initialPayment: boolean; onDeleted?: () => void }) {
  useFilePaste({ projectId: project.id });
  const { subfolder } = useFileDestination({ projectId: project.id });
  const update = useUpdateProject(); const status = useSetProjectStatus(); const duplicate = useDuplicateProject();
  const remove = useDeleteProject(); const restore = useRestoreTrash(); const folder = useOpenFolder();
  const navigate = useNav(state => state.navigate);
  const startProjectFrom = useUI(state => state.startProjectFrom);
  const [tab, setTab] = useState(initialPayment ? 'payments' : 'files'); const [paymentRequest, setPaymentRequest] = useState(initialPayment ? 1 : 0);
  const [deleting, setDeleting] = useState(false); const [rename, setRename] = useState<string | null>(null);
  useEffect(() => { if (initialPayment) { setTab('payments'); setPaymentRequest(value => value + 1); } }, [initialPayment]);
  const summary = projectMoney(project);
  async function saveTitle(title: string) {
    if (!title.trim()) throw new Error('请填写项目名称');
    if (title.trim() === project.title) return;
    if (project.folder) setRename(title.trim());
    else await update.mutateAsync({ id: project.id, patch: { title: title.trim() } });
  }
  async function renameTitle(renameFolder: boolean) {
    if (!rename) return;
    try { await update.mutateAsync({ id: project.id, patch: { title: rename, renameFolder } }); setRename(null); } catch { /* hook reports errors */ }
  }
  async function copy() {
    try {
      const value = await duplicate.mutateAsync(project.id); const nav = useNav.getState(); const route = nav.entries[nav.index];
      navigate(route.page, { ...route.params, projectId: value.id, payment: false }); toast.success('已复制项目');
    } catch { /* hook reports errors */ }
  }
  async function deleteProject() {
    await remove.mutateAsync(project.id);
    if (onDeleted) onDeleted();
    else { const nav = useNav.getState(); const route = nav.entries[nav.index]; const { projectId: _id, payment: _payment, ...params } = route.params; navigate(route.page, params); }
    undoToast('项目已移入回收站', async () => { await restore.mutateAsync({ type: 'project', id: project.id }); });
  }
  return <div className="@container space-y-3" data-drop-target={`project:${project.id}`} data-drop-subfolder={subfolder}>
    <header className="space-y-1"><div className="flex items-start gap-2"><h2 className="-ml-3 min-w-0 flex-1 text-xl font-semibold"><InlineEdit label="编辑项目名称" className="w-full break-words text-xl font-semibold" value={project.title} onSave={saveTitle} /></h2><SnippetPicker context={{ clientName: project.clientName, projectTitle: project.title, priceCents: project.priceCents, receivedCents: project.receivedCents, outstandingCents: summary.outstandingCents, dueDate: project.dueDate }} /><IconButton label={project.pinned ? '取消项目置顶' : '置顶项目'} aria-pressed={project.pinned} onClick={() => update.mutate({ id: project.id, patch: { pinned: !project.pinned } })}><Pin size={18} className={cn(project.pinned && 'fill-current text-fg')} /></IconButton><DropdownMenu label="项目更多操作" trigger={<IconButton label="项目更多操作"><MoreHorizontal size={18} /></IconButton>} items={[{ label: '按此项目新建', icon: <Plus size={16} />, onSelect: () => startProjectFrom(project) }, { label: '复制项目（保留原信息）', icon: <Copy size={16} />, onSelect: () => void copy(), disabled: duplicate.isPending }, { label: '打开文件夹', icon: <FolderOpen size={16} />, onSelect: () => folder.mutate({ projectId: project.id }) }, { label: '删除项目', icon: <Trash2 size={16} />, onSelect: () => setDeleting(true), danger: true, separator: true }]} /></div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><button type="button" aria-label={`查看客户：${project.clientName}`} className="flex min-w-0 max-w-44 items-center gap-2 text-sm text-primary hover:underline" onClick={() => navigate('clients', { clientId: project.clientId })}><Avatar id={project.clientId} name={project.clientName} size="sm" /><span className="truncate">{project.clientName}</span></button><StatusSelect value={project.status} label="项目详情状态" onChange={value => { if (!status.isPending) status.mutate({ id: project.id, status: value }); }} /><ProjectDueDate project={project} /></div>
    </header>
    <ProjectMoneySummary project={project} onPayment={() => { setTab('payments'); setPaymentRequest(value => value + 1); }} completing={status.isPending} onComplete={() => status.mutate({ id: project.id, status: 'done' })} />
    <Tabs label="项目详情分类" value={tab} onChange={value => { setTab(value); if (value !== 'payments') setPaymentRequest(0); }} items={[
      { value: 'files', label: `文件 ${project.fileCount}`, content: <FilesArea target={{ projectId: project.id }} /> },
      { value: 'payments', label: `收款 ${project.paymentCount}`, content: <ProjectMoneyCard key={paymentRequest} project={project} initialPayment={paymentRequest > 0} onFormClosed={() => setPaymentRequest(0)} /> },
      { value: 'brief', label: '需求', content: <ProjectBrief projectId={project.id} value={project.brief} /> },
      { value: 'activity', label: '动态', content: <ActivityTimeline clientId={project.clientId} projectId={project.id} /> },
      { value: 'information', label: '信息', content: <ProjectProperties project={project} /> },
    ]} />
    <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="删除这个项目？" description={`「${project.title}」将移入回收站，文件夹仍会保留。`} onConfirm={deleteProject} confirmLabel="移入回收站" />
    <Dialog open={rename !== null} onOpenChange={open => { if (!open && !update.isPending) setRename(null); }} title="同时重命名项目文件夹？" description="项目名称修改后，可以同步更新对应的文件夹名称。" footer={<><Button disabled={update.isPending} onClick={() => void renameTitle(false)}>仅修改名称</Button><Button data-autofocus variant="primary" disabled={update.isPending} onClick={() => void renameTitle(true)}>同时重命名</Button></>}><p className="break-words text-sm text-fg-2">新名称：{rename}</p></Dialog>
  </div>;
}

export function ProjectDetail({ projectId, initialPayment = false, onDeleted }: { projectId: string; initialPayment?: boolean; onDeleted?: () => void }) {
  const project = useProject(projectId);
  if (project.isPending) return <div className="space-y-5" aria-label="正在加载项目详情"><Skeleton className="h-9 w-3/4" /><Skeleton className="h-40" /><Skeleton className="h-52" /></div>;
  if (project.isError) return <EmptyState title="项目暂不可用" description={project.error.message} action={<Button onClick={() => void project.refetch()}>重新加载</Button>} />;
  return <ProjectContent key={project.data.id} project={project.data} initialPayment={initialPayment} onDeleted={onDeleted} />;
}
