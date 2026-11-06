import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardPaste, Copy, ExternalLink, FolderOpen, Grid2X2, Info, List, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { FileEntry, FileTarget } from '../../api/types';
import { useFiles, useLibraryStatus, useOpenFile, useOpenFolder, usePasteFiles, usePickAndAddFiles, usePickFolder, useProjects, useRenameFile, useRevealFile, useSetLibraryRoot, useSettings, useTrashFile } from '../../hooks/queries';
import { useFileDestination } from '../../hooks/useFilePaste';
import { useCopy } from '../../hooks/useCopy';
import { destinationFolders, filterFiles, groupFiles } from '../../lib/files';
import { useUI } from '../../stores/ui';
import { Button, ConfirmDialog, Dialog, EmptyState, IconButton, Input, Select, Skeleton, Tooltip, toast, type MenuItem } from '../ui';
import { filesAddedToast } from './fileFeedback';
import { FileBrowser } from './FileBrowser';
import { FileSearchBar } from './FileSearchBar';

export interface FilesAreaProps { target: FileTarget; includeProjects?: boolean; }
export function FilesArea({ target, includeProjects = false }: FilesAreaProps) {
  const files = useFiles(target, includeProjects); const library = useLibraryStatus(); const settings = useSettings(); const projects = useProjects();
  const add = usePickAndAddFiles(); const paste = usePasteFiles(); const openFolder = useOpenFolder(); const open = useOpenFile(); const reveal = useRevealFile(); const rename = useRenameFile(); const trash = useTrashFile();
  const pickFolder = usePickFolder(); const setRoot = useSetLibraryRoot(); const { copy } = useCopy();
  const [view, setView] = useState<'grid' | 'list'>('grid'); const { subfolder, setSubfolder } = useFileDestination(target);
  const [renaming, setRenaming] = useState<FileEntry | null>(null); const [name, setName] = useState(''); const [deleting, setDeleting] = useState<FileEntry | null>(null);
  const [query, setQuery] = useState(''); const [owner, setOwner] = useState('');
  const sort = useUI(state => state.detailFileSort); const setSort = useUI(state => state.setDetailFileSort);
  const isProject = 'projectId' in target;
  const targetKey = isProject ? `project:${target.projectId}` : `client:${target.clientId}`;
  useEffect(() => { setRenaming(null); setDeleting(null); setQuery(''); setOwner(''); }, [targetKey]);
  useEffect(() => {
    const refresh = () => { void files.refetch(); void library.refetch(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [files.refetch, library.refetch]);
  useEffect(() => { if (files.error) toast.error(files.error.message); }, [files.error]);
  const visible = useMemo(() => filterFiles(files.data?.files ?? [], query, owner === '__client__' ? null : owner || undefined), [files.data, query, owner]);
  const groups = useMemo(() => groupFiles(visible, includeProjects, projects.data, sort), [visible, includeProjects, projects.data, sort]);
  const clientProjects = useMemo(() => !isProject && includeProjects ? (projects.data ?? []).filter(project => project.clientId === target.clientId) : undefined, [projects.data, isProject, includeProjects, target]);
  const filtered = !!query.trim() || !!owner;
  const folders = useMemo(() => destinationFolders((files.data?.files ?? []).filter(file => isProject || !file.projectId), isProject ? settings.data?.subfolderTemplate : []), [files.data, settings.data, isProject]);
  const offline = library.data?.state !== 'ready';
  const blocked = offline || !!files.data?.folderMissing;
  const addFiles = () => add.mutate({ target, subfolder }, { onSuccess: filesAddedToast });
  const pasteFiles = () => paste.mutate({ target, subfolder }, { onSuccess: filesAddedToast });
  async function chooseLibrary() { const path = await pickFolder.mutateAsync('重新选择文件库位置'); if (path) await setRoot.mutateAsync(path); }
  function menu(file: FileEntry): MenuItem[] {
    return [
      { label: '打开', icon: <ExternalLink size={16} />, onSelect: () => open.mutate(file.path) },
      { label: '在文件夹中显示', icon: <FolderOpen size={16} />, onSelect: () => reveal.mutate(file.path) },
      { label: '重命名', icon: <Pencil size={16} />, onSelect: () => { setRenaming(file); setName(file.name); } },
      { label: '复制路径', icon: <Copy size={16} />, onSelect: () => { void copy(file.path); } },
      { label: '删除到回收站', icon: <Trash2 size={16} />, danger: true, separator: true, onSelect: () => setDeleting(file) },
    ];
  }
  const destination = <Select label={isProject ? '新文件存入' : '目标子文件夹'} className={isProject ? 'h-8 w-auto min-w-28 max-w-52 text-sm [&>span]:truncate' : 'max-w-52'}
    disabled={blocked} value={subfolder || '/'} onChange={value => setSubfolder(value === '/' ? '' : value)}
    options={folders.map(folder => ({ value: folder || '/', label: folder || (isProject ? '项目根目录' : '根目录') }))} />;
  const importButtons = <>
    <Button variant="soft" size="sm" disabled={blocked || add.isPending} onClick={addFiles}>
      <Plus size={16} />{add.isPending ? '正在添加…' : isProject ? '从电脑添加' : '添加文件'}
    </Button>
    <Button size="sm" disabled={blocked || paste.isPending} onClick={pasteFiles}><ClipboardPaste size={16} />从剪贴板粘贴</Button>
  </>;
  const refresh = <IconButton size={isProject ? 'sm' : 'md'} label="刷新文件" disabled={files.isFetching} onClick={() => { void files.refetch(); }}><RefreshCw size={16} /></IconButton>;
  const changeView = (['grid', 'list'] as const).map(mode => {
    const label = mode === 'grid' ? '网格视图' : '列表视图';
    const icon = mode === 'grid' ? <Grid2X2 size={16} /> : <List size={16} />;
    return isProject
      ? <Button key={mode} size="sm" variant={view === mode ? 'secondary' : 'ghost'} aria-label={label} aria-pressed={view === mode} className="gap-1.5 px-2" onClick={() => setView(mode)}>{icon}{mode === 'grid' ? '网格' : '列表'}</Button>
      : <IconButton key={mode} label={label} aria-pressed={view === mode} variant={view === mode ? 'soft' : 'ghost'} onClick={() => setView(mode)}>{icon}</IconButton>;
  });
  return <section data-drop-target={targetKey} data-drop-subfolder={subfolder} aria-label="文件区" className="min-h-64 space-y-4 rounded-lg p-1 transition-colors transition-sky">
    {isProject ? <>
      <div role="group" aria-label="添加项目文件" className="flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-lg border border-line bg-surface px-4 py-3 shadow-sm">
        <div className="flex min-w-0 max-w-full items-center gap-2.5">
          <span className="shrink-0 font-medium" title="从电脑添加、粘贴和拖入的文件都存到这里；模板目录不存在时会在当前项目内创建。">新文件存入</span>
          {destination}
        </div>
        <div className="flex flex-wrap items-center gap-2">{importButtons}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">已存文件</h3>
          <Tooltip content="单击选择文件，按住 Ctrl 可逐个多选，按住 Shift 可连续选择。空格预览，双击打开。">
            <button type="button" aria-label="文件操作说明" className="rounded-full text-fg-2"><Info size={15} /></button>
          </Tooltip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="文件显示方式" className="flex items-center gap-0.5 rounded-md bg-subtle p-0.5">{changeView}</div>
          {refresh}
          <Button size="sm" variant="ghost" disabled={offline || openFolder.isPending} onClick={() => openFolder.mutate(target)}><FolderOpen size={16} />打开项目文件夹</Button>
        </div>
      </div>
    </> : <>
      <div className="flex flex-wrap items-center gap-2">{importButtons}</div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!blocked && <div className="flex min-w-0 flex-1 items-center gap-3 text-sm text-fg-2"><span className="shrink-0">添加到 _客户资料</span>{destination}</div>}
        <div className="ml-auto flex items-center gap-1 rounded-full bg-subtle p-1">
          {changeView}{refresh}<IconButton label="打开文件夹" disabled={offline || openFolder.isPending} onClick={() => openFolder.mutate(target)}><FolderOpen size={16} /></IconButton>
        </div>
      </div>
    </>}
    {!offline && !files.isPending && !files.isError && <FileSearchBar query={query} onQueryChange={setQuery} owner={owner} onOwnerChange={setOwner} sort={sort} onSortChange={setSort} projects={clientProjects} total={files.data?.files.length ?? 0} visible={visible.length} />}
    {!offline && files.data?.folderMissing && <div role="alert" className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-bg p-5"><AlertTriangle className="shrink-0 text-warning-fg" size={20} /><div><h3 className="font-semibold">找不到原文件夹</h3><p className="mt-1 break-all text-sm text-fg-2">{files.data.folder}。请先在资源管理器恢复原位置，再刷新文件。</p><Button size="sm" className="mt-3" onClick={() => { void files.refetch(); }}>重新检查</Button></div></div>}
    {library.isPending || files.isPending ? <div aria-label="正在加载文件" className="grid grid-cols-2 gap-4">{[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-40 rounded-lg" />)}</div>
      : offline ? <EmptyState illustrationName="library-offline" title="文件库暂时不可用" description={library.data?.message || '请连接文件库所在磁盘，或重新选择位置。客户和项目数据仍可使用。'} action={<Button disabled={pickFolder.isPending || setRoot.isPending} onClick={() => { void chooseLibrary().catch(() => undefined); }}>重新选择位置</Button>} />
      : files.isError ? <EmptyState illustrationName="empty-files" title="暂时无法读取文件" description={files.error.message} action={<Button onClick={() => { void files.refetch(); }}>重试</Button>} />
      : groups.length ? <FileBrowser key={`${targetKey}:${query}:${owner}`} files={visible} allFiles={files.data?.files} groups={groups} projectView={isProject} view={view} menu={menu} />
      : filtered ? <EmptyState illustrationName="empty-search" title="没有符合条件的文件" description="调整上方的文件名、目录或项目筛选，也可以清除筛选查看全部文件。" />
      : isProject ? !files.data?.folderMissing && <EmptyState illustrationName="empty-files" title="项目里还没有文件" description={`可从上方添加文件，也可以直接拖入。新文件会存入「${subfolder || '项目根目录'}」。`} />
      : <EmptyState illustrationName="empty-files" title="把设计稿放在这里" description="拖入图片、源文件或资料，也可以点击添加文件。" action={<Button disabled={blocked || add.isPending} onClick={addFiles}>添加文件</Button>} />}
    <Dialog open={!!renaming} onOpenChange={value => { if (!value) setRenaming(null); }} title="重命名文件" description="保留扩展名可以让文件继续被正确识别。" footer={<><Button onClick={() => setRenaming(null)}>取消</Button><Button variant="primary" disabled={!name.trim() || rename.isPending} onClick={() => { if (renaming) rename.mutate({ path: renaming.path, newName: name.trim() }, { onSuccess: () => { setRenaming(null); toast.success('文件已重命名'); } }); }}>确认</Button></>}><Input aria-label="文件名" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && renaming && name.trim() && !rename.isPending) rename.mutate({ path: renaming.path, newName: name.trim() }, { onSuccess: () => setRenaming(null) }); }} /></Dialog>
    <ConfirmDialog open={!!deleting} onOpenChange={value => { if (!value) setDeleting(null); }} title="将文件移到回收站？" description={deleting?.name} confirmLabel="移到回收站" onConfirm={async () => { if (deleting) { await trash.mutateAsync(deleting.path); setDeleting(null); } }} />
  </section>;
}
