import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Copy, ExternalLink, FolderOpen, Grid2X2, History, List, RefreshCw, RotateCcw, UserRound } from 'lucide-react';
import type { FileEntry } from '../api/types';
import { useClients, useLibraryStatus, useOpenFile, useProjects, useRecentFiles, useRevealFile } from '../hooks/queries';
import { useCopy } from '../hooks/useCopy';
import { ALL_LIBRARY_FILES_LIMIT, FILE_PAGE_SIZE, RECENT_FILES_LIMIT, filterRecentFiles, type RecentFileFilters } from '../lib/recentFiles';
import { useNav } from '../stores/nav';
import { useUI } from '../stores/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { Button, Card, DropdownMenu, EmptyState, IconButton, Skeleton, type MenuItem } from '../components/ui';
import { FileBrowser } from '../components/files/FileBrowser';
import { LibraryFileFilters } from '../components/files/LibraryFileFilters';

export function FilesPage() {
  const [filters, setFilters] = useState<RecentFileFilters>({}); const [browseAll, setBrowseAll] = useState(false); const [page, setPage] = useState(0);
  const [view, setView] = useState<'grid' | 'list'>('grid'); const clients = useClients(); const projects = useProjects(); const library = useLibraryStatus();
  const filtered = Object.values(filters).some(value => typeof value === 'string' && value.trim());
  const fullLibrary = browseAll || filtered;
  const files = useRecentFiles(fullLibrary ? ALL_LIBRARY_FILES_LIMIT : RECENT_FILES_LIMIT, library.data?.state === 'ready');
  const open = useOpenFile(); const reveal = useRevealFile(); const { copy } = useCopy(); const navigate = useNav(state => state.navigate);
  const invalidDates = !!filters.from && !!filters.to && filters.from > filters.to;
  const visible = useMemo(() => filterRecentFiles(files.data ?? [], filters), [files.data, filters]);
  const pages = Math.max(1, Math.ceil(visible.length / FILE_PAGE_SIZE)); const currentPage = Math.min(page, pages - 1);
  useEffect(() => { if (files.isSuccess) setPage(value => Math.min(value, pages - 1)); }, [pages, files.isSuccess]);
  const pageFiles = useMemo(() => visible.slice(currentPage * FILE_PAGE_SIZE, (currentPage + 1) * FILE_PAGE_SIZE), [visible, currentPage]);
  const clientNames = useMemo(() => new Map(clients.data?.map(client => [client.id, client.name])), [clients.data]);
  const projectNames = useMemo(() => new Map(projects.data?.map(project => [project.id, project.title])), [projects.data]);
  const loading = clients.isPending || projects.isPending || library.isPending || library.data?.state === 'ready' && files.isPending;
  const error = clients.error || projects.error || library.error || library.data?.state === 'ready' && files.error;
  const complete = fullLibrary || (files.data?.length ?? 0) < RECENT_FILES_LIMIT;
  const clearFilters = () => { setFilters({}); setPage(0); };
  const refresh = () => { if (library.data?.state === 'ready') void files.refetch(); void clients.refetch(); void projects.refetch(); void library.refetch(); };
  function context(file: FileEntry): string { return [file.clientId ? clientNames.get(file.clientId) ?? '未知客户' : '未归属客户', file.projectId ? projectNames.get(file.projectId) ?? '项目文件' : file.clientId ? '客户资料' : '文件库文件'].join(' · '); }
  function menu(file: FileEntry): MenuItem[] {
    return [
      { label: '打开', icon: <ExternalLink size={16} />, onSelect: () => open.mutate(file.path) },
      { label: '在文件夹中显示', icon: <FolderOpen size={16} />, onSelect: () => reveal.mutate(file.path) },
      { label: '复制路径', icon: <Copy size={16} />, onSelect: () => { void copy(file.path); } },
      { label: '跳到项目', icon: <ArrowUpRight size={16} />, separator: true, disabled: !file.projectId, onSelect: () => { if (file.projectId) navigate('projects', { projectId: file.projectId }); } },
      { label: '查看客户', icon: <UserRound size={16} />, disabled: !file.clientId, onSelect: () => { if (file.clientId) navigate('clients', { clientId: file.clientId }); } },
    ];
  }
  return <div className="min-w-0 space-y-4 p-6">
    <PageHeader title="文件" count={loading ? undefined : visible.length} info="搜索和筛选覆盖整个文件库。按修改时间由近到远排列；空格预览，双击打开，Ctrl / Shift 多选当前页文件。" actions={<div className="flex items-center gap-1 rounded-full bg-subtle p-1"><IconButton label="文件网格视图" variant={view === 'grid' ? 'soft' : 'ghost'} aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={17} /></IconButton><IconButton label="文件列表视图" variant={view === 'list' ? 'soft' : 'ghost'} aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} /></IconButton><IconButton label="刷新最近文件" disabled={files.isFetching} onClick={refresh}><RefreshCw size={17} /></IconButton><DropdownMenu label="文件版本与恢复" trigger={<Button size="sm" variant="ghost">版本与恢复</Button>} items={[{ label: '全部文件版本', icon: <History size={16} />, onSelect: () => { useUI.getState().setSettingsCategory('backup'); navigate('settings', { recoveryTab: 'versions' }); } }, { label: '文件回收站', icon: <RotateCcw size={16} />, onSelect: () => { useUI.getState().setSettingsCategory('backup'); navigate('settings', { recoveryTab: 'files' }); } }]} /></div>} />
    <LibraryFileFilters filters={filters} clients={clients.data ?? []} projects={projects.data ?? []} onChange={value => { setFilters(value); setPage(0); }} onClear={clearFilters} />
    {invalidDates ? <p role="alert" className="text-sm text-danger-fg">结束日期不能早于开始日期</p> : loading ? <div aria-label={fullLibrary ? '正在搜索全部文件' : '正在加载最近文件'}><p role="status" className="mb-3 text-sm text-fg-2">{fullLibrary ? '正在读取整个文件库…' : '正在读取最近文件…'}</p><div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">{[0, 1, 2, 3, 4, 5].map(index => <Skeleton key={index} className="h-64 rounded-lg" />)}</div></div> : error ? <Card><EmptyState illustrationName="empty-files" title="暂时无法读取文件" description={error.message} action={<Button onClick={refresh}>重新加载</Button>} /></Card> : library.data?.state !== 'ready' ? <Card><EmptyState illustrationName="library-offline" title="文件库暂时不可用" description={library.data?.message || '请连接文件库所在磁盘，或在设置中重新选择位置。'} action={<Button onClick={() => { useUI.getState().setSettingsCategory('library'); navigate('settings'); }}>打开文件库设置</Button>} /></Card> : <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-fg-2"><p role="status">{filtered ? `全库找到 ${visible.length.toLocaleString('zh-CN')} 个文件` : complete ? `全部 ${visible.length.toLocaleString('zh-CN')} 个文件` : `最近 ${RECENT_FILES_LIMIT.toLocaleString('zh-CN')} 个文件`}{pages > 1 ? ` · 第 ${currentPage + 1} / ${pages} 页` : ''}</p>{!complete && <Button size="sm" onClick={() => { setBrowseAll(true); setPage(0); }}>浏览全部文件</Button>}</div>
      {!visible.length ? <Card><EmptyState illustrationName={filtered ? 'empty-search' : 'empty-files'} title={filtered ? '没有找到这些文件' : '这里将收集你的每一份作品'} description={filtered ? '已搜索整个文件库，试试其他关键词或筛选条件。' : '在项目或客户详情中添加文件，之后就能在这里集中查看。'} action={<Button onClick={() => filtered ? clearFilters() : navigate('projects')}>{filtered ? '清除筛选' : '查看项目'}</Button>} /></Card> : <FileBrowser key={`${currentPage}:${JSON.stringify(filters)}`} files={pageFiles} view={view} context={context} showContext menu={menu} />}
      {pages > 1 && <nav aria-label="文件结果分页" className="flex items-center justify-center gap-3"><Button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</Button><span className="text-sm text-fg-2">第 {currentPage + 1} / {pages} 页 · 每页 {FILE_PAGE_SIZE} 个</span><Button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>下一页</Button></nav>}
    </>}
  </div>;
}
