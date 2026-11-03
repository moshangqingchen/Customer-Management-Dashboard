import { Archive, Eye, File, FileCode, FileImage, FileText, Film } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import type { FileEntry } from '../../api/types';
import { canThumbnail, fileKindLabels, fileModifiedDate, formatFileSize, middleEllipsis } from '../../lib/files';
import { useVisibleThumbnail } from '../../hooks/useVisibleThumbnail';
import { ContextMenu, type MenuItem } from './Menus';
import { IconTile, type IconTone } from './IconTile';
import { IconButton } from './Button';
import { cn } from '../../lib/cn';

export interface FileItemProps { file: FileEntry; thumbnailUrl?: string; onOpen?: () => void; onPreview?: () => void; onSelect?: (event: MouseEvent<HTMLButtonElement>) => void; selected?: boolean; contextMenu?: MenuItem[]; context?: string }
const fileTones: Record<FileEntry['kind'], IconTone> = { image: 'sky', design: 'sky', pdf: 'rose', doc: 'violet', archive: 'amber', video: 'peach', other: 'violet' };
export function FileTypeGraphic({ file, large = false }: { file: Pick<FileEntry, 'kind' | 'ext'>; large?: boolean }) {
  const Icon = { image: FileImage, design: FileCode, pdf: FileText, doc: FileText, archive: Archive, video: Film, other: File }[file.kind];
  return <div className="flex size-full flex-col items-center justify-center gap-3 text-fg-2"><IconTile tone={fileTones[file.kind]} size={large ? 'md' : 'sm'} className={cn(file.kind === 'other' && 'bg-hover text-fg-2', large && 'size-24 rounded-xl')}><Icon size={large ? 48 : 24} /></IconTile><span className="rounded-full bg-surface px-2 text-micro uppercase">{file.ext || fileKindLabels[file.kind]}</span></div>;
}
function Thumbnail({ file, thumbnailUrl }: Pick<FileItemProps, 'file' | 'thumbnailUrl'>) {
  const system = !canThumbnail(file.kind, file.sizeBytes); const { ref, url: resolved } = useVisibleThumbnail(file.path, system, `${file.modifiedAt}:${file.sizeBytes}`);
  const [failed, setFailed] = useState<string>(); const url = thumbnailUrl ?? resolved;
  return <div ref={ref} className="relative size-full">{url && failed !== url ? <><img src={url} alt={file.name} loading="lazy" onError={() => setFailed(url)} className="size-full object-cover" />{system && <span className="absolute right-2 bottom-2 rounded-full border border-line bg-surface px-2 py-0.5 text-micro text-fg-2 uppercase shadow-sm">{file.ext}</span>}</> : <FileTypeGraphic file={file} />}</div>;
}
export function FileTile({ file, thumbnailUrl, onOpen, onPreview, onSelect, selected, contextMenu, context }: FileItemProps) {
  const tile = <div className="group relative min-w-0"><button type="button" onClick={onSelect} onDoubleClick={onOpen} onKeyDown={event => { if (event.key === 'Enter') onOpen?.(); if (event.key === ' ' && onPreview) { event.preventDefault(); onPreview(); } }} aria-label={`打开文件：${file.name}`} aria-pressed={selected} title={file.name} className={cn('card-interactive w-full min-w-0 overflow-hidden rounded-lg border border-line bg-surface text-left shadow-sm hover:border-line-strong', selected && 'border-primary bg-primary-soft')}><div className="m-3 mb-0 h-36 overflow-hidden rounded-md bg-subtle"><Thumbnail file={file} thumbnailUrl={thumbnailUrl} /></div><div className="p-4"><p className="truncate text-base font-medium">{middleEllipsis(file.name, 30)}</p>{context && <p className="mt-1 truncate text-sm text-fg-2">{context}</p>}<p className="mt-2 flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs text-fg-2"><span>{formatFileSize(file.sizeBytes)}</span><span>{fileModifiedDate(file.modifiedAt)}</span></p></div></button>{onPreview && <IconButton label={`预览文件：${file.name}`} className="absolute top-5 right-5 bg-surface shadow-sm opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus:opacity-100" onClick={onPreview}><Eye size={18} /></IconButton>}</div>;
  return contextMenu ? <ContextMenu items={contextMenu}>{tile}</ContextMenu> : tile;
}
export function FileRow({ file, thumbnailUrl, onOpen, onPreview, onSelect, selected, contextMenu, context }: FileItemProps) {
  const row = <div className="group relative"><button type="button" onClick={onSelect} onDoubleClick={onOpen} onKeyDown={event => { if (event.key === 'Enter') onOpen?.(); if (event.key === ' ' && onPreview) { event.preventDefault(); onPreview(); } }} aria-label={`打开文件：${file.name}`} aria-pressed={selected} title={file.name} className={cn('flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-1.5 pr-14 text-left transition-colors transition-sky hover:bg-hover', selected && 'bg-primary-soft')}><span className="size-9 shrink-0 overflow-hidden rounded-md bg-subtle"><Thumbnail file={file} thumbnailUrl={thumbnailUrl} /></span><span className="min-w-0 flex-1"><span className="block truncate text-base">{middleEllipsis(file.name, 48)}</span>{context && <span className="block truncate text-xs text-fg-2">{context}</span>}</span><span className="rounded-full bg-subtle px-2 py-0.5 text-micro text-fg-2 uppercase">{file.ext}</span><span className="w-20 text-right text-xs text-fg-2 tabular-nums">{formatFileSize(file.sizeBytes)}</span><span className="w-28 shrink-0 text-right text-xs text-fg-2">{fileModifiedDate(file.modifiedAt)}</span></button>{onPreview && <IconButton label={`预览文件：${file.name}`} className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus:opacity-100" onClick={onPreview}><Eye size={18} /></IconButton>}</div>;
  return contextMenu ? <ContextMenu items={contextMenu}>{row}</ContextMenu> : row;
}
