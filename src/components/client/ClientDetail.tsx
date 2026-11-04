import { useState } from 'react';
import { MoreHorizontal, Pin, Plus, Star, Trash2 } from 'lucide-react';
import { useCreateTag, useDeleteClient, useProjects, useRestoreTrash, useSetClientTags, useTags, useUpdateClient } from '../../hooks/queries';
import type { Client, ClientPatch } from '../../api/types';
import { cooperationDate } from '../../lib/clients';
import { sortProjects } from '../../lib/filters';
import { cn } from '../../lib/cn';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { Avatar, Button, Card, ConfirmDialog, Dialog, DropdownMenu, DueChip, EmptyState, IconButton, InlineEdit, Money, Skeleton, StatusPill, Tabs, Tooltip, undoToast } from '../ui';
import { ActivityTimeline } from '../activity/ActivityTimeline';
import { FilesArea } from '../files/FilesArea';
import { useFilePaste } from '../../hooks/useFilePaste';
import { SnippetPicker } from '../snippets/SnippetPicker';
import { ClientContacts } from './ClientContacts';
import { ClientNotes } from './ClientNotes';
import { ClientTags } from './ClientTags';

export function ClientDetail({ client }: { client: Client }) {
  useFilePaste({ clientId: client.id });
  const [tab, setTab] = useState('projects'); const [deleting, setDeleting] = useState(false); const [rename, setRename] = useState<string | null>(null);
  const update = useUpdateClient(); const remove = useDeleteClient(); const restore = useRestoreTrash(); const setTags = useSetClientTags(); const createTag = useCreateTag();
  const { data: tags = [] } = useTags(); const projectsQuery = useProjects(); const nav = useNav(); const newProject = useUI(state => state.setNewProjectOpen);
  const save = (patch: ClientPatch) => update.mutateAsync({ id: client.id, patch });
  const projects = sortProjects((projectsQuery.data ?? []).filter(project => project.clientId === client.id), 'updatedAt');
  const startProject = () => { nav.navigate('clients', { clientId: client.id }); newProject(true); };
  async function changeName(name: string) {
    if (!name.trim()) throw new Error('客户名称不能为空');
    if (name.trim() === client.name) return;
    if (client.folder) setRename(name.trim()); else await save({ name: name.trim() });
  }
  async function confirmRename(renameFolder: boolean) {
    if (!rename) return;
    try { await save({ name: rename, renameFolder }); setRename(null); } catch { /* keep dialog for retry */ }
  }
  async function deleteClient() {
    await remove.mutateAsync(client.id);
    nav.navigate('clients');
    undoToast(`已将「${client.name}」及 ${client.projectCount} 个项目移入回收站`, async () => { await restore.mutateAsync({ type: 'client', id: client.id }); nav.navigate('clients', { clientId: client.id }); });
  }
  return <article data-drop-target={`client:${client.id}`} className="@container min-w-0 space-y-4">
    <Card className="p-4"><div className="flex flex-wrap items-start gap-3"><Avatar id={client.id} name={client.name} size="lg" /><div className="min-w-0 flex-1"><InlineEdit label="编辑客户名称" className="max-w-full px-1 text-2xl leading-8 font-semibold" value={client.name} onSave={changeName} /><InlineEdit label="编辑公司或店铺" className="block min-h-6 px-1 text-sm text-fg-2" value={client.company} placeholder="添加公司 / 店铺" onSave={company => save({ company: company.trim() })} /></div>
      <div className="ml-auto flex items-center gap-1"><Button size="sm" onClick={startProject}><Plus size={14} />新建项目</Button><SnippetPicker context={{ clientName: client.name, receivedCents: client.receivedCents, outstandingCents: client.outstandingCents }} /><IconButton label={client.pinned ? '取消客户置顶' : '置顶客户'} aria-pressed={client.pinned} disabled={update.isPending} onClick={() => void save({ pinned: !client.pinned }).catch(() => undefined)}><Pin size={18} className={cn(client.pinned && 'fill-current')} /></IconButton><DropdownMenu label="客户更多操作" trigger={<IconButton label="客户更多操作"><MoreHorizontal size={18} /></IconButton>} items={[{ label: '删除客户', icon: <Trash2 size={16} />, danger: true, onSelect: () => setDeleting(true) }]} /></div>
    </div><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2"><Tooltip content={client.rating ? `${client.rating} 星客户` : '未设置星级'}><div className="flex items-center gap-0.5" role="group" aria-label="客户星级">{[1, 2, 3, 4, 5].map(rating => <IconButton key={rating} label={`设为 ${rating} 星${client.rating === rating ? '，再次点击清除' : ''}`} size="sm" aria-pressed={client.rating === rating} disabled={update.isPending} onClick={() => void save({ rating: rating === client.rating ? 0 : rating }).catch(() => undefined)}><Star size={17} className={cn(rating <= client.rating ? 'fill-current text-warning-fg' : 'text-fg-3')} /></IconButton>)}</div></Tooltip><ClientTags tags={tags} value={client.tagIds} onChange={tagIds => setTags.mutate({ clientId: client.id, tagIds })} onCreate={(name, color) => createTag.mutateAsync({ name, color })} /></div>
    </Card>
    <Card className="grid grid-cols-5 divide-x divide-line py-3">{[
      { label: '项目数', value: `${client.projectCount} 个` }, { label: '累计收款', value: <Money cents={client.receivedCents} /> }, { label: '待收款', value: <Money cents={client.outstandingCents} /> },
      { label: '首次合作', value: cooperationDate(client.firstProjectAt) }, { label: '最近合作', value: cooperationDate(client.firstProjectAt ? client.lastActivityAt : null) },
    ].map(item => <div key={item.label} className="min-w-0 px-3"><p className="text-xs text-fg-2">{item.label}</p><p className="mt-1 truncate text-sm font-semibold tabular-nums">{item.value}</p></div>)}</Card>
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 @[720px]:grid-cols-[310px_minmax(0,1fr)]">
      <Card className="order-2 min-w-0 p-4 @[720px]:order-1"><ClientContacts client={client} save={save} /><ClientNotes value={client.notes} onSave={notes => save({ notes })} /></Card>
      <Card className="order-1 min-w-0 p-4 @[720px]:order-2"><Tabs label="客户详情分类" value={tab} onChange={setTab} items={[
        { value: 'projects', label: `项目 ${client.projectCount}`, content: projectsQuery.isPending ? <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : projectsQuery.isError ? <div role="alert" className="space-y-3 text-danger-fg"><p>{projectsQuery.error.message}</p><Button onClick={() => void projectsQuery.refetch()}>重新加载项目</Button></div> : projects.length ? <div className="divide-y divide-line">{projects.map(project => <button type="button" key={project.id} data-drop-target={`project:${project.id}`} className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-3 text-left hover:bg-hover" onClick={() => nav.navigate('clients', { clientId: client.id, projectId: project.id })}>
          <div className="w-full min-w-0 flex-1 basis-40"><p className="truncate font-medium">{project.title}</p><p className="mt-1 text-xs text-fg-2">{project.fileCount} 个文件 · <Money cents={project.priceCents} /></p></div><StatusPill status={project.status} /><DueChip date={project.dueDate} status={project.status} />
        </button>)}</div> : <EmptyState title="还没有合作项目" description="为这个客户创建第一个项目，开始记录每一次合作。" action={<Button onClick={startProject}>新建项目</Button>} /> },
        { value: 'files', label: '文件', content: <FilesArea target={{ clientId: client.id }} includeProjects /> },
        { value: 'activity', label: '动态', content: <ActivityTimeline clientId={client.id} /> },
      ]} /></Card>
    </div>
    <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={`删除客户「${client.name}」？`} description={`此客户及其 ${client.projectCount} 个项目将一起移入回收站，文件夹会保留。删除后 5 秒内可撤销，也可从回收站恢复。`} onConfirm={deleteClient} confirmLabel="移入回收站" />
    <Dialog open={rename !== null} onOpenChange={open => { if (!open && !update.isPending) setRename(null); }} title="同时重命名文件夹？" description={`客户名称将改为「${rename ?? ''}」。可同时更新客户文件夹名称。`} footer={<><Button disabled={update.isPending} onClick={() => void confirmRename(false)}>仅修改名称</Button><Button data-autofocus variant="primary" disabled={update.isPending} onClick={() => void confirmRename(true)}>{update.isPending ? '正在修改…' : '同时重命名'}</Button></>}><p className="break-all text-sm text-fg-2">当前文件夹：{client.folder}</p></Dialog>
  </article>;
}
