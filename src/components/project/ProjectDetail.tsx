import { useState } from 'react';
import { CheckCheck, Copy, FolderOpen, MoreHorizontal, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '../../api/types';
import { useDeleteProject, useDuplicateProject, useOpenFolder, useProject, useRestoreTrash, useSetProjectStatus, useUpdateProject } from '../../hooks/queries';
import { projectMoney } from '../../lib/projectMoney';
import { useNav } from '../../stores/nav';
import { cn } from '../../lib/cn';
import { ActivityTimeline } from '../activity/ActivityTimeline';
import { FilesArea } from '../files/FilesArea';
import { ProjectMoneyCard } from '../payments/ProjectMoneyCard';
import { Avatar, Button, ConfirmDialog, Dialog, DropdownMenu, EmptyState, IconButton, InlineEdit, Skeleton, StatusSelect, Tabs, undoToast } from '../ui';
import { ProjectBrief } from './ProjectBrief';
import { ProjectProperties } from './ProjectProperties';

function ProjectContent({ project, initialPayment, onDeleted }: { project: Project; initialPayment: boolean; onDeleted?: () => void }) {
  const update = useUpdateProject(); const status = useSetProjectStatus(); const duplicate = useDuplicateProject();
  const remove = useDeleteProject(); const restore = useRestoreTrash(); const folder = useOpenFolder();
  const navigate = useNav(state => state.navigate);
  const [tab, setTab] = useState('files'); const [deleting, setDeleting] = useState(false); const [rename, setRename] = useState<string | null>(null);
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
  return <div className="space-y-5" data-drop-target={`project:${project.id}`}>
    <header className="space-y-3"><div className="flex items-start gap-2"><h2 className="-ml-3 min-w-0 flex-1 text-xl font-semibold"><InlineEdit label="编辑项目名称" className="w-full break-words text-xl font-semibold" value={project.title} onSave={saveTitle} /></h2><IconButton label={project.pinned ? '取消项目星标' : '星标项目'} aria-pressed={project.pinned} onClick={() => update.mutate({ id: project.id, patch: { pinned: !project.pinned } })}><Star size={18} className={cn(project.pinned && 'fill-warning-fg text-warning-fg')} /></IconButton><DropdownMenu label="项目更多操作" trigger={<IconButton label="项目更多操作"><MoreHorizontal size={18} /></IconButton>} items={[{ label: '复制项目', icon: <Copy size={16} />, onSelect: () => void copy(), disabled: duplicate.isPending }, { label: '打开文件夹', icon: <FolderOpen size={16} />, onSelect: () => folder.mutate({ projectId: project.id }) }, { label: '删除项目', icon: <Trash2 size={16} />, onSelect: () => setDeleting(true), danger: true, separator: true }]} /></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" aria-label={`查看客户：${project.clientName}`} className="flex items-center gap-2 text-sm text-primary hover:underline" onClick={() => navigate('clients', { clientId: project.clientId })}><Avatar id={project.clientId} name={project.clientName} size="sm" />{project.clientName}</button><div className="w-36"><StatusSelect value={project.status} label="项目详情状态" onChange={value => { if (!status.isPending) status.mutate({ id: project.id, status: value }); }} /></div></div>
    </header>
    {summary.canComplete && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success-border bg-success-bg p-3 text-sm text-success-fg"><span className="flex items-center gap-2"><CheckCheck size={18} />已交付且已收清，可以标记完成</span><Button size="sm" variant="secondary" disabled={status.isPending} onClick={() => status.mutate({ id: project.id, status: 'done' })}>标记完成</Button></div>}
    <ProjectProperties project={project} />
    <ProjectMoneyCard key={`${project.id}:${initialPayment}`} project={project} initialPayment={initialPayment} />
    <Tabs label="项目详情分类" value={tab} onChange={setTab} items={[
      { value: 'files', label: `文件 ${project.fileCount}`, content: <FilesArea target={{ projectId: project.id }} /> },
      { value: 'activity', label: '动态', content: <ActivityTimeline clientId={project.clientId} projectId={project.id} /> },
      { value: 'brief', label: '需求', content: <ProjectBrief projectId={project.id} value={project.brief} /> },
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
