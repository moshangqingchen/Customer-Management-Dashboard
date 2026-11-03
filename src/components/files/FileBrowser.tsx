import { Copy, Eye, FolderOpen, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FileEntry } from '../../api/types';
import { useClients, useCopyFiles, useOpenFile, useProjects } from '../../hooks/queries';
import { useFileSelection } from '../../hooks/useFileSelection';
import type { FileGroup } from '../../lib/files';
import { Button, FileRow, FileTile, toast, type MenuItem } from '../ui';
import { FilePreview } from './FilePreview';

export function FileBrowser({ files, groups, view, menu, context, showContext = false }: { files: readonly FileEntry[]; groups?: readonly FileGroup[]; view: 'grid' | 'list'; menu: (file: FileEntry) => MenuItem[]; context?: (file: FileEntry) => string; showContext?: boolean }) {
  const ordered = groups?.flatMap(group => group.files) ?? files;
  const selection = useFileSelection(ordered); const copy = useCopyFiles(); const open = useOpenFile();
  const [preview, setPreview] = useState<string | null>(null); const opener = useRef<HTMLElement | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const clients = useClients(); const projects = useProjects();
  const describe = context ?? ((file: FileEntry) => [clients.data?.find(client => client.id === file.clientId)?.name, file.projectId ? projects.data?.find(project => project.id === file.projectId)?.title : '客户资料'].filter(Boolean).join(' · '));
  function beginPreview(file: FileEntry) {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const source = [...(container.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(button => button.getAttribute('aria-label') === `打开文件：${file.name}`);
    opener.current = active?.getAttribute('aria-label') === `预览文件：${file.name}` ? active : source ?? active;
    setPreview(file.path);
  }
  function copyFiles(paths: string[]) { copy.mutate(paths, { onSuccess: () => toast.success(`已复制 ${paths.length} 个文件，可直接粘贴到微信`) }); }
  function renderFiles(entries: readonly FileEntry[]) {
    return <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3' : 'space-y-1'}>{entries.map(file => { const Item = view === 'grid' ? FileTile : FileRow; return <Item key={file.path} file={file} selected={selection.isSelected(file.path)} onSelect={event => selection.select(file.path, event)} onOpen={() => open.mutate(file.path)} onPreview={() => beginPreview(file)} context={showContext ? describe(file) : undefined} contextMenu={[{ label: '预览', icon: <Eye size={16} />, onSelect: () => beginPreview(file) }, { label: '复制文件', icon: <Copy size={16} />, onSelect: () => copyFiles([file.path]) }, ...menu(file)]} />; })}</div>;
  }
  return <div ref={container} className="space-y-5 pb-4">{groups ? groups.map(group => <div key={group.key} className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold text-fg-2"><FolderOpen size={16} />{group.label}<span className="text-xs font-normal text-fg-3">{group.files.length} 个文件</span></h3>{renderFiles(group.files)}</div>) : renderFiles(files)}{selection.selected.length > 0 && <div role="region" aria-label="文件选择操作" className="fixed bottom-6 left-1/2 z-40 flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-3 shadow-lg"><span className="text-sm text-fg-2">已选择 {selection.selected.length} 个文件</span><Button size="sm" variant="primary" disabled={copy.isPending} onClick={() => copyFiles(selection.selected.map(file => file.path))}><Copy size={16} />复制 {selection.selected.length} 个文件</Button><Button variant="ghost" size="sm" onClick={selection.clear}><X size={16} />取消选择</Button></div>}<FilePreview files={ordered} path={preview} onPathChange={setPreview} onClose={() => setPreview(null)} context={describe} returnFocus={opener.current} /></div>;
}
