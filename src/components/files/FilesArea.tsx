import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, ExternalLink, FolderOpen, Grid2X2, List, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { FileEntry, FileTarget } from '../../api/types';
import { useFiles, useLibraryStatus, useOpenFile, useOpenFolder, usePickAndAddFiles, usePickFolder, useProjects, useRenameFile, useRevealFile, useSetLibraryRoot, useSettings, useTrashFile } from '../../hooks/queries';
import { useCopy } from '../../hooks/useCopy';
import { destinationFolders, groupFiles } from '../../lib/files';
import { Button, ConfirmDialog, Dialog, EmptyState, FileRow, FileTile, IconButton, Input, Select, Skeleton, toast, type MenuItem } from '../ui';
import { filesAddedToast } from './fileFeedback';

export interface FilesAreaProps { target: FileTarget; includeProjects?: boolean; }
export function FilesArea({ target, includeProjects = false }: FilesAreaProps) {
  const files = useFiles(target, includeProjects); const library = useLibraryStatus(); const settings = useSettings(); const projects = useProjects();
  const add = usePickAndAddFiles(); const openFolder = useOpenFolder(); const open = useOpenFile(); const reveal = useRevealFile(); const rename = useRenameFile(); const trash = useTrashFile();
  const pickFolder = usePickFolder(); const setRoot = useSetLibraryRoot(); const { copy } = useCopy();
  const [view, setView] = useState<'grid' | 'list'>('grid'); const [subfolder, setSubfolder] = useState('');
  const [renaming, setRenaming] = useState<FileEntry | null>(null); const [name, setName] = useState(''); const [deleting, setDeleting] = useState<FileEntry | null>(null);
  const targetKey = 'projectId' in target ? `project:${target.projectId}` : `client:${target.clientId}`;
  useEffect(() => { setSubfolder(''); setRenaming(null); setDeleting(null); }, [targetKey]);
  useEffect(() => {
    const refresh = () => { void files.refetch(); void library.refetch(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [files.refetch, library.refetch]);
  useEffect(() => { if (files.error) toast.error(files.error.message); }, [files.error]);
  const groups = useMemo(() => groupFiles(files.data?.files ?? [], includeProjects, projects.data), [files.data, includeProjects, projects.data]);
  const folders = useMemo(() => destinationFolders((files.data?.files ?? []).filter(file => 'projectId' in target || !file.projectId), 'projectId' in target ? settings.data?.subfolderTemplate : []), [files.data, settings.data, target]);
  const offline = library.data?.state !== 'ready';
  const blocked = offline || !!files.data?.folderMissing;
  const addFiles = () => add.mutate({ target, subfolder }, { onSuccess: filesAddedToast });
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
  return <section data-drop-target={targetKey} data-drop-subfolder={subfolder} aria-label="文件区" className="min-h-64 space-y-5 rounded-lg p-1 transition-colors transition-sky">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Button variant="primary" size="sm" disabled={blocked || add.isPending} onClick={addFiles}><Plus size={16} />{add.isPending ? '正在添加…' : '添加文件'}</Button><Button size="sm" disabled={offline || openFolder.isPending} onClick={() => openFolder.mutate(target)}><FolderOpen size={16} />打开文件夹</Button></div>
      <div className="flex items-center gap-1 rounded-full bg-subtle p-1"><IconButton label="网格视图" aria-pressed={view === 'grid'} variant={view === 'grid' ? 'soft' : 'ghost'} onClick={() => setView('grid')}><Grid2X2 size={16} /></IconButton><IconButton label="列表视图" aria-pressed={view === 'list'} variant={view === 'list' ? 'soft' : 'ghost'} onClick={() => setView('list')}><List size={16} /></IconButton><IconButton label="刷新文件" disabled={files.isFetching} onClick={() => { void files.refetch(); }}><RefreshCw size={16} /></IconButton></div>
    </div>
    {!blocked && <div className="flex flex-wrap items-center gap-3 text-sm text-fg-2"><span>{'projectId' in target ? '添加到' : '添加到 _客户资料'}</span><Select label="目标子文件夹" className="max-w-52" value={subfolder || '__root__'} onChange={value => setSubfolder(value === '__root__' ? '' : value)} options={folders.map(folder => ({ value: folder || '__root__', label: folder || '根目录' }))} /><span>拖入文件即可复制，原文件保留</span></div>}
    {!offline && files.data?.folderMissing && <div role="alert" className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-bg p-5"><AlertTriangle className="shrink-0 text-warning-fg" size={20} /><div><h3 className="font-semibold">找不到原文件夹</h3><p className="mt-1 break-all text-sm text-fg-2">{files.data.folder}。请先在资源管理器恢复原位置，再刷新文件。</p><Button size="sm" className="mt-3" onClick={() => { void files.refetch(); }}>重新检查</Button></div></div>}
    {library.isPending || files.isPending ? <div aria-label="正在加载文件" className="grid grid-cols-2 gap-4">{[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-40 rounded-lg" />)}</div> : offline ? <EmptyState illustrationName="library-offline" title="文件库暂时不可用" description={library.data?.message || '请连接文件库所在磁盘，或重新选择位置。客户和项目数据仍可使用。'} action={<Button disabled={pickFolder.isPending || setRoot.isPending} onClick={() => { void chooseLibrary().catch(() => undefined); }}>重新选择位置</Button>} /> : files.isError ? <EmptyState illustrationName="empty-files" title="暂时无法读取文件" description={files.error.message} action={<Button onClick={() => { void files.refetch(); }}>重试</Button>} /> : !groups.length ? <EmptyState illustrationName="empty-files" title="把设计稿放在这里" description="拖入图片、源文件或资料，也可以点击添加文件。" action={<Button variant="primary" disabled={blocked || add.isPending} onClick={addFiles}>添加文件</Button>} /> : groups.map(group => <div key={group.key} className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-fg-2"><FolderOpen size={16} />{group.label}<span className="text-xs font-normal text-fg-3">{group.files.length} 个文件</span></h3><div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3' : 'space-y-1'}>{group.files.map(file => { const Item = view === 'grid' ? FileTile : FileRow; return <Item key={file.path} file={file} onOpen={() => open.mutate(file.path)} contextMenu={menu(file)} />; })}</div></div>)}
    <Dialog open={!!renaming} onOpenChange={value => { if (!value) setRenaming(null); }} title="重命名文件" description="保留扩展名可以让文件继续被正确识别。" footer={<><Button onClick={() => setRenaming(null)}>取消</Button><Button variant="primary" disabled={!name.trim() || rename.isPending} onClick={() => { if (renaming) rename.mutate({ path: renaming.path, newName: name.trim() }, { onSuccess: () => { setRenaming(null); toast.success('文件已重命名'); } }); }}>确认</Button></>}><Input aria-label="文件名" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && renaming && name.trim() && !rename.isPending) rename.mutate({ path: renaming.path, newName: name.trim() }, { onSuccess: () => setRenaming(null) }); }} /></Dialog>
    <ConfirmDialog open={!!deleting} onOpenChange={value => { if (!value) setDeleting(null); }} title="将文件移到回收站？" description={deleting?.name} confirmLabel="移到回收站" onConfirm={async () => { if (deleting) { await trash.mutateAsync(deleting.path); setDeleting(null); } }} />
  </section>;
}
