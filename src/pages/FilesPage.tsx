import { useMemo, useState } from 'react';
import { ArrowUpRight, Copy, ExternalLink, FolderOpen, Grid2X2, List, RefreshCw, Search } from 'lucide-react';
import type { FileEntry, FileKind } from '../api/types';
import { useClients, useLibraryStatus, useOpenFile, useProjects, useRecentFiles, useRevealFile } from '../hooks/queries';
import { useCopy } from '../hooks/useCopy';
import { fileKindLabels } from '../lib/files';
import { filterRecentFiles } from '../lib/recentFiles';
import { useNav } from '../stores/nav';
import { useUI } from '../stores/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { Button, Card, EmptyState, IconButton, Input, Select, Skeleton, type MenuItem } from '../components/ui';
import { FileBrowser } from '../components/files/FileBrowser';

export function FilesPage() {
  const [limit, setLimit] = useState(1000); const files = useRecentFiles(limit); const clients = useClients(); const projects = useProjects(); const library = useLibraryStatus();
  const open = useOpenFile(); const reveal = useRevealFile(); const { copy } = useCopy(); const navigate = useNav(state => state.navigate);
  const [query, setQuery] = useState(''); const [kind, setKind] = useState<FileKind>(); const [clientId, setClientId] = useState(''); const [view, setView] = useState<'grid' | 'list'>('grid');
  const visible = useMemo(() => filterRecentFiles(files.data ?? [], { query, kind, clientId }), [files.data, query, kind, clientId]);
  const clientNames = useMemo(() => new Map(clients.data?.map(client => [client.id, client.name])), [clients.data]);
  const projectNames = useMemo(() => new Map(projects.data?.map(project => [project.id, project.title])), [projects.data]);
  const loading = files.isPending || clients.isPending || projects.isPending || library.isPending;
  const error = files.error || clients.error || projects.error || library.error;
  const filtered = !!query.trim() || !!kind || !!clientId;
  const clearFilters = () => { setQuery(''); setKind(undefined); setClientId(''); };
  const refresh = () => { void files.refetch(); void clients.refetch(); void projects.refetch(); void library.refetch(); };
  function context(file: FileEntry): string { return [file.clientId ? clientNames.get(file.clientId) ?? '未知客户' : '未归属客户', file.projectId ? projectNames.get(file.projectId) ?? '项目文件' : file.clientId ? '客户资料' : '文件库文件'].join(' · '); }
  function menu(file: FileEntry): MenuItem[] {
    return [
      { label: '打开', icon: <ExternalLink size={16} />, onSelect: () => open.mutate(file.path) },
      { label: '在文件夹中显示', icon: <FolderOpen size={16} />, onSelect: () => reveal.mutate(file.path) },
      { label: '复制路径', icon: <Copy size={16} />, onSelect: () => { void copy(file.path); } },
      { label: '跳到项目', icon: <ArrowUpRight size={16} />, separator: true, disabled: !file.projectId, onSelect: () => { if (file.projectId) navigate('projects', { projectId: file.projectId }); } },
    ];
  }
  return <div className="min-w-0 space-y-4 p-6">
    <PageHeader title="文件" count={visible.length} info="按修改时间由近到远排列；空格预览，双击或回车打开，Ctrl / Shift 多选。" actions={<div className="flex items-center gap-1 rounded-full bg-subtle p-1"><IconButton label="文件网格视图" variant={view === 'grid' ? 'soft' : 'ghost'} aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={17} /></IconButton><IconButton label="文件列表视图" variant={view === 'list' ? 'soft' : 'ghost'} aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} /></IconButton><IconButton label="刷新最近文件" disabled={files.isFetching} onClick={refresh}><RefreshCw size={17} /></IconButton></div>} />
    <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-56 flex-1"><Search size={17} className="absolute top-3 left-3 text-fg-2" /><Input data-page-search aria-label="搜索文件名" placeholder="搜索文件名…" value={query} className="pl-9" onChange={event => setQuery(event.target.value)} /></div><Select label="筛选文件类型" className="w-44" value={kind ?? '__all__'} onChange={value => setKind(value === '__all__' ? undefined : value as FileKind)} options={[{ value: '__all__', label: '全部文件类型' }, ...(Object.entries(fileKindLabels) as [FileKind, string][]).map(([value, label]) => ({ value, label }))]} /><Select label="筛选文件客户" className="w-44" value={clientId || '__all__'} onChange={value => setClientId(value === '__all__' ? '' : value)} options={[{ value: '__all__', label: '全部客户' }, { value: '__unassigned__', label: '未归属客户' }, ...(clients.data ?? []).map(client => ({ value: client.id, label: client.name }))]} />{filtered && <Button size="sm" variant="ghost" onClick={clearFilters}>清除筛选</Button>}</div>
    {loading ? <div aria-label="正在加载最近文件" className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">{[0, 1, 2, 3, 4, 5].map(index => <Skeleton key={index} className="h-64 rounded-lg" />)}</div> : error ? <Card><EmptyState illustrationName="empty-files" title="暂时无法读取文件" description={error.message} action={<Button onClick={refresh}>重新加载</Button>} /></Card> : library.data?.state !== 'ready' ? <Card><EmptyState illustrationName="library-offline" title="文件库暂时不可用" description={library.data?.message || '请连接文件库所在磁盘，或在设置中重新选择位置。'} action={<Button onClick={() => { useUI.getState().setSettingsCategory('library'); navigate('settings'); }}>打开文件库设置</Button>} /></Card> : !visible.length ? <Card><EmptyState illustrationName={filtered ? 'empty-search' : 'empty-files'} title={filtered ? '没有找到这些文件' : '这里将收集你的每一份作品'} description={filtered ? '试试其他文件名、类型或客户。' : '在项目或客户详情中添加文件，之后就能在这里集中查看。'} action={<Button onClick={() => filtered ? clearFilters() : navigate('projects')}>{filtered ? '清除筛选' : '查看项目'}</Button>} /></Card> : <>
      <FileBrowser files={visible} view={view} context={context} showContext menu={menu} />
    </>}
    {!loading && !error && library.data?.state === 'ready' && (files.data?.length ?? 0) >= limit && <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-fg-2"><span>已读取最近 {limit.toLocaleString('zh-CN')} 个文件，继续加载可扩大筛选范围</span><Button disabled={files.isFetching} onClick={() => setLimit(value => value + 1000)}>加载更多文件</Button></div>}
  </div>;
}
