import { ChevronDown, Copy, Eye, FolderOpen, History, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { FileEntry } from '../../api/types';
import { useClients, useCopyFiles, useOpenFile, useProjects } from '../../hooks/queries';
import { useFileSelection } from '../../hooks/useFileSelection';
import { cn } from '../../lib/cn';
import { groupFiles, projectFileFolders, type FileGroup } from '../../lib/files';
import { Button, FileRow, FileTile, toast, type MenuItem } from '../ui';
import { FilePreview } from './FilePreview';
import { FileVersionDialog } from './FileVersionDialog';

interface FileBrowserProps {
  files: readonly FileEntry[];
  allFiles?: readonly FileEntry[];
  groups?: readonly FileGroup[];
  view: 'grid' | 'list';
  menu: (file: FileEntry) => MenuItem[];
  context?: (file: FileEntry) => string;
  showContext?: boolean;
  projectView?: boolean;
}

export function FileBrowser({ files, allFiles = files, groups, view, menu, context, showContext = false, projectView = false }: FileBrowserProps) {
  const folders = useMemo(() => projectView ? projectFileFolders(groups ?? groupFiles(files)) : undefined, [files, groups, projectView]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const ordered = useMemo(() => folders
    ? folders.filter(folder => !collapsed.has(folder.name)).flatMap(folder => folder.groups.flatMap(group => group.files))
    : groups ? groups.filter(group => !collapsed.has(group.key)).flatMap(group => group.files) : files,
  [files, groups, folders, collapsed]);
  const selection = useFileSelection(ordered); const copy = useCopyFiles(); const open = useOpenFile();
  const [preview, setPreview] = useState<string | null>(null); const opener = useRef<HTMLElement | null>(null);
  const [versionFile, setVersionFile] = useState<FileEntry | null>(null);
  const delivery = useMemo(() => allFiles.filter(file => /^交付成品(?:[\\/]|$)/.test(file.folderGroup)), [allFiles]);
  const container = useRef<HTMLDivElement>(null);
  const clients = useClients(); const projects = useProjects();
  const describe = context ?? ((file: FileEntry) => [clients.data?.find(client => client.id === file.clientId)?.name, file.projectId ? projects.data?.find(project => project.id === file.projectId)?.title : '客户资料'].filter(Boolean).join(' · '));
  function beginPreview(file: FileEntry) {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const source = [...(container.current?.querySelectorAll<HTMLButtonElement>('button[data-file-path]') ?? [])].find(button => button.dataset.filePath === file.path);
    opener.current = source?.parentElement?.contains(active) && active?.getAttribute('aria-label') === `预览文件：${file.name}` ? active : source ?? active;
    setPreview(file.path);
  }
  function copyFiles(entries: readonly FileEntry[], kind = '文件') {
    copy.mutate(entries.map(file => file.path), {
      onSuccess: () => toast.success(`已复制 ${entries.length} 个${kind}，可直接粘贴到微信`),
    });
  }
  function renderFiles(entries: readonly FileEntry[]) {
    const Item = view === 'grid' ? FileTile : FileRow;
    const grid = projectView ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))]';
    return <div className={view === 'grid' ? cn('grid gap-3', grid) : 'space-y-1'}>
      {entries.map(file => <Item key={file.path} file={file} projectView={projectView}
        selected={selection.isSelected(file.path)} onSelect={event => selection.select(file.path, event)}
        onOpen={() => open.mutate(file.path)} onPreview={() => beginPreview(file)}
        context={showContext ? describe(file) : undefined}
        contextMenu={[
          { label: '预览', icon: <Eye size={16} />, onSelect: () => beginPreview(file) },
          { label: '复制文件', icon: <Copy size={16} />, onSelect: () => copyFiles([file]) },
          { label: '版本历史', icon: <History size={16} />, onSelect: () => setVersionFile(file) },
          ...menu(file),
        ]} />)}
    </div>;
  }
  function folderButton(key: string, label: string) {
    const closed = collapsed.has(key);
    return <button type="button" aria-label={`${closed ? '展开' : '收起'}文件夹：${label}`} aria-expanded={!closed}
      className="flex min-w-0 items-center gap-2 rounded-sm text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; })}>
      <ChevronDown size={15} className={cn('shrink-0 transition-transform', closed && '-rotate-90')} />
      <FolderOpen size={17} className="shrink-0 text-fg-2" /><span className="break-all">{label}</span>
    </button>;
  }
  function renderGroups() {
    if (folders) return folders.map(folder => {
      const entries = folder.groups.flatMap(group => group.files);
      const label = folder.name || '项目根目录';
      return <section key={folder.name} aria-label={label} className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-2">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold">
            {folderButton(folder.name, label)}
          </h3>
          <span className="text-xs text-fg-2 tabular-nums">{entries.length} 个文件</span>
          {folder.name === '交付成品' && <Button size="sm" className="ml-auto" title="复制交付成品目录内的全部文件，不受搜索和折叠影响" disabled={copy.isPending} onClick={() => copyFiles(delivery, '交付文件')}>
            <Copy size={15} />复制全部 {delivery.length} 个交付文件
          </Button>}
        </div>
        {!collapsed.has(folder.name) && folder.groups.map(group => {
          const subfolder = group.folder.split('/').slice(1).join(' / ');
          return <div key={group.key} className="space-y-2">
            {subfolder && <h4 className="flex items-center gap-2 break-all text-sm font-medium text-fg-2"><FolderOpen size={14} />{subfolder}</h4>}
            {renderFiles(group.files)}
          </div>;
        })}
      </section>;
    });
    if (!groups) return renderFiles(files);
    return groups.map(group => <div key={group.key} className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg-2">{folderButton(group.key, group.label)}<span className="text-xs font-normal text-fg-3">{group.files.length} 个文件</span></h3>
      {!collapsed.has(group.key) && renderFiles(group.files)}
    </div>);
  }
  const count = selection.selected.length;
  return <div ref={container} className="space-y-5 pb-4">
    {renderGroups()}
    {count > 0 && <div role="region" aria-label="文件选择操作" className={cn(
      'flex w-max flex-wrap items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-3 shadow-lg',
      projectView ? 'sticky bottom-2 z-20 mx-auto max-w-full' : 'fixed bottom-6 left-1/2 z-40 max-w-[calc(100vw-32px)] -translate-x-1/2',
    )}>
      <span className="text-sm text-fg-2">已选择 {count} 个文件</span>
      <Button size="sm" variant="primary" disabled={copy.isPending} onClick={() => copyFiles(selection.selected)}>
        <Copy size={16} />{projectView ? `复制选中的 ${count} 个文件` : `复制 ${count} 个文件`}
      </Button>
      <Button variant="ghost" size="sm" onClick={selection.clear}><X size={16} />取消选择</Button>
    </div>}
    <FilePreview files={ordered} path={preview} onPathChange={setPreview} onClose={() => setPreview(null)} context={describe} returnFocus={opener.current} />
    <FileVersionDialog file={versionFile} onClose={() => setVersionFile(null)} />
  </div>;
}
