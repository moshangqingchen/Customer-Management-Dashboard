import { useState } from 'react';
import { Building2, MoreHorizontal, Plus, Star, Trash2 } from 'lucide-react';
import { useCreateTag, useDeleteClient, useProjects, useRestoreTrash, useSetClientTags, useTags, useUpdateClient } from '../../hooks/queries';
import type { Client, ClientPatch } from '../../api/types';
import { cooperationDate } from '../../lib/clients';
import { sortProjects } from '../../lib/filters';
import { cn } from '../../lib/cn';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { Avatar, Button, Card, ConfirmDialog, Dialog, DropdownMenu, DueChip, EmptyState, IconButton, InlineEdit, Money, Skeleton, StatusPill, Tabs, TagPicker, undoToast } from '../ui';
import { ActivityTimeline } from '../activity/ActivityTimeline';
import { FilesArea } from '../files/FilesArea';
import { ClientContacts } from './ClientContacts';
import { ClientNotes } from './ClientNotes';
import { EditableProperty } from '../ui/EditableProperty';

export function ClientDetail({ client }: { client: Client }) {
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
  return <article data-drop-target={`client:${client.id}`} className="min-w-0 space-y-5 rounded-xl">
    <Card className="p-6"><div className="flex items-start gap-4"><Avatar id={client.id} name={client.name} size="lg" /><div className="min-w-0 flex-1"><InlineEdit label="编辑客户名称" className="max-w-full text-[26px] leading-[34px] font-semibold" value={client.name} onSave={changeName} /><EditableProperty icon={<Building2 size={15} />} label="公司店铺" editLabel="编辑公司或店铺" className="mt-1" value={client.company} placeholder="添加公司 / 店铺" onSave={company => save({ company: company.trim() })} /></div>
      <IconButton label={client.pinned ? '取消客户星标' : '星标客户'} aria-pressed={client.pinned} disabled={update.isPending} onClick={() => void save({ pinned: !client.pinned }).catch(() => undefined)}><Star size={18} className={cn(client.pinned && 'fill-current text-warning-fg')} /></IconButton>
      <DropdownMenu label="客户更多操作" trigger={<IconButton label="客户更多操作"><MoreHorizontal size={18} /></IconButton>} items={[{ label: '删除客户', icon: <Trash2 size={16} />, danger: true, onSelect: () => setDeleting(true) }]} />
    </div><div className="mt-4 flex flex-wrap items-center gap-3"><div className="flex items-center gap-0.5" role="group" aria-label="客户星级">{[1, 2, 3, 4, 5].map(rating => <IconButton key={rating} label={`设为 ${rating} 星${client.rating === rating ? '，再次点击清除' : ''}`} size="sm" aria-pressed={client.rating === rating} disabled={update.isPending} onClick={() => void save({ rating: rating === client.rating ? 0 : rating }).catch(() => undefined)}><Star size={17} className={cn(rating <= client.rating ? 'fill-current text-warning-fg' : 'text-fg-3')} /></IconButton>)}</div><span className="text-sm text-fg-2">{client.rating ? `${client.rating} 星客户` : '未设置星级'}</span></div>
      <div className="mt-4 max-w-md"><TagPicker label="客户标签" tags={tags} value={client.tagIds} onChange={tagIds => setTags.mutate({ clientId: client.id, tagIds })} onCreate={(name, color) => createTag.mutateAsync({ name, color })} /></div>
    </Card>
    <div className="grid grid-cols-3 gap-3 xl:grid-cols-5">{[
      { label: '项目数', value: `${client.projectCount} 个` }, { label: '累计收款', value: <Money cents={client.receivedCents} /> }, { label: '待收款', value: <Money cents={client.outstandingCents} /> },
      { label: '首次合作', value: cooperationDate(client.firstProjectAt) }, { label: '最近合作', value: cooperationDate(client.firstProjectAt ? client.lastActivityAt : null) },
    ].map(item => <Card key={item.label} className="p-4"><p className="text-xs text-fg-2">{item.label}</p><p className="mt-2 text-base font-semibold tabular-nums">{item.value}</p></Card>)}</div>
    <ClientContacts client={client} save={save} />
    <ClientNotes value={client.notes} onSave={notes => save({ notes })} />
    <Card className="p-5"><Tabs label="客户详情分类" value={tab} onChange={setTab} items={[
      { value: 'projects', label: `项目 ${client.projectCount}`, content: <div className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">合作项目</h2><Button variant="primary" size="sm" onClick={startProject}><Plus size={14} />为他新建项目</Button></div>{projectsQuery.isPending ? <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : projectsQuery.isError ? <div role="alert" className="space-y-3 text-danger-fg"><p>{projectsQuery.error.message}</p><Button onClick={() => void projectsQuery.refetch()}>重新加载项目</Button></div> : projects.length ? <div className="divide-y divide-line">{projects.map(project => <button type="button" key={project.id} className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-hover" onClick={() => nav.navigate('clients', { clientId: client.id, projectId: project.id })}>
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{project.title}</p><p className="mt-1 text-xs text-fg-2">{project.fileCount} 个文件</p></div><StatusPill status={project.status} /><DueChip date={project.dueDate} status={project.status} /><Money cents={project.priceCents} />
      </button>)}</div> : <EmptyState title="还没有合作项目" description="为这个客户创建第一个项目，开始记录每一次合作。" action={<Button onClick={startProject}>新建项目</Button>} />}</div> },
      { value: 'files', label: '文件', content: <FilesArea target={{ clientId: client.id }} includeProjects /> },
      { value: 'activity', label: '动态', content: <ActivityTimeline clientId={client.id} /> },
    ]} /></Card>
    <ConfirmDialog open={deleting} onOpenChange={setDeleting} title={`删除客户「${client.name}」？`} description={`此客户及其 ${client.projectCount} 个项目将一起移入回收站，文件夹会保留。删除后 5 秒内可撤销，也可从回收站恢复。`} onConfirm={deleteClient} confirmLabel="移入回收站" />
    <Dialog open={rename !== null} onOpenChange={open => { if (!open && !update.isPending) setRename(null); }} title="同时重命名文件夹？" description={`客户名称将改为「${rename ?? ''}」。可同时更新客户文件夹名称。`} footer={<><Button disabled={update.isPending} onClick={() => void confirmRename(false)}>仅修改名称</Button><Button data-autofocus variant="primary" disabled={update.isPending} onClick={() => void confirmRename(true)}>{update.isPending ? '正在修改…' : '同时重命名'}</Button></>}><p className="break-all text-sm text-fg-2">当前文件夹：{client.folder}</p></Dialog>
  </article>;
}
