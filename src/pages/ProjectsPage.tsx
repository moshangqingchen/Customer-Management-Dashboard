import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { FolderOpen, LayoutGrid, List, Pin, Plus, Search, Tags, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '../api/types';
import { useClients, useDeleteProject, useOpenFolder, useProjects, useRestoreTrash, useSetProjectStatus, useSetProjectTags, useSettings, useTags, useUpdateProject } from '../hooks/queries';
import { filterProjects, sortProjects, type ProjectFilters as Filters, type ProjectSort } from '../lib/filters';
import { routeProjectFilters } from '../lib/projects';
import { statuses, statusMeta } from '../lib/status';
import { useNav } from '../stores/nav';
import { useUI } from '../stores/ui';
import { Button, ConfirmDialog, Dialog, EmptyState, Input, Skeleton, TagPicker } from '../components/ui';
import type { MenuItem } from '../components/ui/Menus';
import { ProjectFilters } from '../components/project/ProjectFilters';
import { ProjectsTable } from '../components/project/ProjectsTable';
import { ProjectQuickViews } from '../components/project/ProjectQuickViews';
import { PageHeader } from '../components/layout/PageHeader';

const Kanban = lazy(() => import('../components/ui/Kanban').then(module => ({ default: module.Kanban })));

export function ProjectsPage() {
  const nav = useNav(); const route = nav.entries[nav.index]; const ui = useUI();
  const projects = useProjects(); const tags = useTags(); const clients = useClients(); const settings = useSettings();
  const update = useUpdateProject(); const status = useSetProjectStatus(); const remove = useDeleteProject(); const restore = useRestoreTrash(); const folder = useOpenFolder(); const setTags = useSetProjectTags();
  const [sort, setSort] = useState<ProjectSort>('smart'); const [allDone, setAllDone] = useState(false);
  const [tagProjectId, setTagProjectId] = useState<string>(); const [deleting, setDeleting] = useState<Project>();
  const filters = useMemo(() => routeProjectFilters(route.params), [route.params]);
  const visible = useMemo(() => sortProjects(filterProjects(projects.data ?? [], filters), sort), [projects.data, filters, sort]);
  const changeFilters = (next: Filters) => {
    const view = route.params.view === 'pinned' && next.pinned ? 'pinned' : route.params.view === 'overdue' && next.due === 'overdue' ? 'overdue' : route.params.view === 'outstanding' && next.outstanding ? 'outstanding' : undefined;
    nav.navigate('projects', { ...route.params, filters: next, view, tagId: undefined, statuses: undefined, due: undefined });
  };
  const changeView = (view: typeof route.params.view) => { const { pinned: _pin, outstanding: _outstanding, due: _due, ...rest } = filters; nav.navigate('projects', { ...route.params, filters: rest, view, tagId: undefined, statuses: undefined, due: undefined }); };
  const open = useCallback((project: Project) => { const state = useNav.getState(); const current = state.entries[state.index]; state.navigate('projects', { ...current.params, projectId: project.id, payment: undefined }); }, []);
  const pin = useCallback((project: Project) => update.mutate({ id: project.id, patch: { pinned: !project.pinned } }), [update.mutate]);
  const menu = useCallback((project: Project): MenuItem[] => [
    ...statuses.map(value => ({ label: `改为${statusMeta[value].label}`, disabled: project.status === value, onSelect: () => status.mutate({ id: project.id, status: value }) })),
    { label: '打标签', icon: <Tags size={16} />, separator: true, onSelect: () => setTagProjectId(project.id) },
    { label: '记一笔收款', icon: <Wallet size={16} />, onSelect: () => { const current = useNav.getState(); current.navigate('projects', { ...current.entries[current.index].params, projectId: project.id, payment: true }); } },
    { label: '打开文件夹', icon: <FolderOpen size={16} />, onSelect: () => folder.mutate({ projectId: project.id }) },
    { label: project.pinned ? '取消置顶' : '添加置顶', icon: <Pin size={16} />, onSelect: () => pin(project) },
    { label: '删除项目', icon: <Trash2 size={16} />, danger: true, separator: true, onSelect: () => setDeleting(project) },
  ], [status.mutate, folder.mutate, pin]);
  const tagProject = projects.data?.find(project => project.id === tagProjectId);
  return <div className="space-y-4 p-6">
    <PageHeader title="项目" count={visible.length} actions={<>
      <div className="relative w-64"><Search size={17} className="absolute top-3 left-3 text-fg-3" /><Input data-page-search aria-label="搜索项目" placeholder="搜索项目…" className="pl-9" value={filters.query ?? ''} onChange={event => changeFilters({ ...filters, query: event.target.value })} /></div>
      <div className="flex rounded-full bg-subtle p-1" role="group" aria-label="项目视图">{([{ value: 'list', label: '列表', Icon: List }, { value: 'kanban', label: '看板', Icon: LayoutGrid }] as const).map(view => <Button key={view.value} size="sm" variant="ghost" className={ui.projectView === view.value ? 'bg-surface text-primary shadow-sm' : ''} aria-pressed={ui.projectView === view.value} icon={<view.Icon size={16} />} onClick={() => ui.setProjectView(view.value)}>{view.label}</Button>)}</div>
      <Button variant="primary" icon={<Plus size={18} />} onClick={() => ui.setNewProjectOpen(true)}>新建项目</Button>
    </>} />
    <ProjectFilters quickViews={<ProjectQuickViews projects={projects.data ?? []} value={route.params.view} onChange={changeView} />} filters={filters} onChange={changeFilters} sort={sort} onSort={setSort} tags={tags.data ?? []} clients={clients.data ?? []} settings={settings.data} />
    {projects.isPending || tags.isPending || clients.isPending ? <div aria-label="项目加载中" className="space-y-3">{[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-16" />)}</div> : projects.isError || tags.isError || clients.isError ? <EmptyState title="项目暂时读取失败" description="请重新加载后继续。" action={<Button onClick={() => { void projects.refetch(); void tags.refetch(); void clients.refetch(); }}>重新加载</Button>} /> : visible.length === 0 ? <EmptyState illustrationName={projects.data?.length ? 'empty-search' : 'empty-projects'} title={projects.data?.length ? '没有找到符合条件的项目' : '从第一个项目开始'} description="每一个好点子，都值得一个自己的位置。" action={<Button onClick={() => projects.data?.length ? changeFilters({}) : ui.setNewProjectOpen(true)}>{projects.data?.length ? '清除筛选' : '新建项目'}</Button>} /> : ui.projectView === 'list' ? <ProjectsTable projects={visible} tags={tags.data ?? []} onOpen={open} onPin={pin} menu={menu} selectedId={route.params.projectId} /> : <>
      <Suspense fallback={<div role="status" aria-label="正在加载看板" className="grid grid-cols-5 gap-3">{[0, 1, 2, 3, 4].map(index => <Skeleton key={index} className="h-80" />)}</div>}><Kanban projects={visible} tags={tags.data ?? []} showAllDone={allDone} onOpen={open} contextMenu={menu} onTagClick={tagId => nav.navigate('projects', { tagId })} onStatusChange={(id, value) => status.mutate({ id, status: value })} /></Suspense>
      <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => setAllDone(!allDone)}>{allDone ? '仅显示近 30 天完成' : '查看全部已完成项目'}</Button></div>
    </>}
    <Dialog open={!!tagProject} onOpenChange={value => { if (!value) setTagProjectId(undefined); }} title="项目标签" description={tagProject?.title}>{tagProject && <TagPicker tags={tags.data ?? []} value={tagProject.tagIds} onChange={tagIds => setTags.mutate({ projectId: tagProject.id, tagIds })} />}</Dialog>
    <ConfirmDialog open={!!deleting} onOpenChange={value => { if (!value) setDeleting(undefined); }} title="删除项目？" description={`「${deleting?.title ?? ''}」将移入回收站，可以恢复。`} danger onConfirm={async () => { if (!deleting) return; const id = deleting.id; await remove.mutateAsync(id); setDeleting(undefined); toast.success('项目已移入回收站', { duration: 5000, action: { label: '撤销', onClick: () => restore.mutate({ type: 'project', id }) } }); }} />
  </div>;
}
