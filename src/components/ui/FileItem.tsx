import { Archive, File, FileCode, FileImage, FileText, Film } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FileEntry } from '../../api/types';
import { thumbnail } from '../../api/client';
import { canThumbnail, fileKindLabels, formatFileSize, middleEllipsis } from '../../lib/files';
import { relativeDate } from '../../lib/dates';
import { ContextMenu, type MenuItem } from './Menus';
import { IconTile, type IconTone } from './IconTile';
import { cn } from '../../lib/cn';

export interface FileItemProps { file: FileEntry; thumbnailUrl?: string; onOpen?: () => void; selected?: boolean; contextMenu?: MenuItem[]; context?: string }
const fileTones: Record<FileEntry['kind'], IconTone> = { image: 'sky', design: 'violet', pdf: 'rose', doc: 'sky', archive: 'amber', video: 'peach', other: 'mint' };
function Thumbnail({ file, thumbnailUrl }: Pick<FileItemProps, 'file' | 'thumbnailUrl'>) {
  const [failed, setFailed] = useState(false); const [resolved, setResolved] = useState<string>(); const Icon = { image: FileImage, design: FileCode, pdf: FileText, doc: FileText, archive: Archive, video: Film, other: File }[file.kind];
  useEffect(() => { let active = true; setFailed(false); setResolved(undefined); if (!thumbnailUrl && canThumbnail(file.kind, file.sizeBytes)) void thumbnail(file.path).then(url => { if (active) setResolved(url); }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, [file.path, file.kind, file.sizeBytes, thumbnailUrl]);
  const url = thumbnailUrl ?? resolved;
  return url && !failed && canThumbnail(file.kind, file.sizeBytes) ? <img src={url} alt={file.name} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" /> : <div className="flex size-full flex-col items-center justify-center gap-2 text-fg-2"><IconTile tone={fileTones[file.kind]} size="sm"><Icon size={24} /></IconTile><span className="rounded-full bg-surface px-2 text-micro uppercase">{file.ext || fileKindLabels[file.kind]}</span></div>;
}
export function FileTile({ file, thumbnailUrl, onOpen, selected, contextMenu, context }: FileItemProps) {
  const tile = <button type="button" onDoubleClick={onOpen} onKeyDown={event => { if (event.key === 'Enter') onOpen?.(); }} aria-label={`打开文件：${file.name}`} aria-pressed={selected} title={file.name} className={cn('card-interactive group w-full overflow-hidden rounded-lg border border-line bg-surface text-left shadow-sm hover:border-line-strong', selected && 'border-primary bg-primary-soft')}><div className="m-3 mb-0 h-36 overflow-hidden rounded-md bg-subtle"><Thumbnail file={file} thumbnailUrl={thumbnailUrl} /></div><div className="p-4"><p className="text-base font-medium">{middleEllipsis(file.name, 30)}</p>{context && <p className="mt-1 truncate text-sm text-fg-2">{context}</p>}<p className="mt-2 flex justify-between gap-2 text-xs text-fg-2"><span>{formatFileSize(file.sizeBytes)}</span><span>{relativeDate(file.modifiedAt.slice(0, 10))}</span></p></div></button>;
  return contextMenu ? <ContextMenu items={contextMenu}>{tile}</ContextMenu> : tile;
}
export function FileRow({ file, thumbnailUrl, onOpen, selected, contextMenu, context }: FileItemProps) {
  const row = <button type="button" onDoubleClick={onOpen} onKeyDown={event => { if (event.key === 'Enter') onOpen?.(); }} aria-label={`打开文件：${file.name}`} aria-pressed={selected} title={file.name} className={cn('flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left transition-colors transition-sky hover:bg-hover', selected && 'bg-primary-soft')}><span className="size-9 shrink-0 overflow-hidden rounded-md bg-subtle [&_span:last-child]:hidden"><Thumbnail file={file} thumbnailUrl={thumbnailUrl} /></span><span className="min-w-0 flex-1"><span className="block truncate text-base">{middleEllipsis(file.name, 48)}</span>{context && <span className="block truncate text-xs text-fg-2">{context}</span>}</span><span className="rounded-full bg-subtle px-2 py-0.5 text-micro text-fg-2 uppercase">{file.ext}</span><span className="w-20 text-right text-xs text-fg-2 tabular-nums">{formatFileSize(file.sizeBytes)}</span><span className="w-20 text-right text-xs text-fg-2">{relativeDate(file.modifiedAt.slice(0, 10))}</span></button>;
  return contextMenu ? <ContextMenu items={contextMenu}>{row}</ContextMenu> : row;
}
