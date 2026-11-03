import * as Primitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Copy, ExternalLink, FolderOpen, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FileEntry } from '../../api/types';
import { thumbnail } from '../../api/client';
import { useCopyFiles, useFileThumbnail, useOpenFile, useRevealFile } from '../../hooks/queries';
import { canThumbnail, formatFileSize } from '../../lib/files';
import { FileTypeGraphic } from '../ui/FileItem';
import { Button, IconButton, Skeleton, toast } from '../ui';

function PreviewImage({ file }: { file: FileEntry }) {
  const system = !canThumbnail(file.kind, file.sizeBytes);
  const result = useFileThumbnail(file.path, 1024, system, `${file.modifiedAt}:${file.sizeBytes}`);
  const [direct, setDirect] = useState<string>(); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    if (!system) void thumbnail(file.path).then(url => { if (active) setDirect(url); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [file.path, system]);
  const url = system ? result.data : direct;
  const loading = !failed && (system ? result.isPending : !direct);
  return <div className="flex h-full min-h-60 items-center justify-center p-6">{url && !failed ? <img src={url} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain" onError={() => setFailed(true)} /> : loading ? <Skeleton className="h-64 w-80 max-w-full rounded-xl" /> : <div className="flex flex-col items-center gap-5"><div className="size-40"><FileTypeGraphic file={file} large /></div><p className="text-sm text-fg-2">这个文件暂时无法预览</p></div>}</div>;
}

export function FilePreview({ files, path, onPathChange, onClose, context, returnFocus }: { files: readonly FileEntry[]; path: string | null; onPathChange: (path: string) => void; onClose: () => void; context: (file: FileEntry) => string; returnFocus: HTMLElement | null }) {
  const index = files.findIndex(file => file.path === path); const file = files[index];
  const open = useOpenFile(); const reveal = useRevealFile(); const copy = useCopyFiles();
  // Focus the dialog itself so the close button's tooltip doesn't pop up on every open.
  const content = useRef<HTMLDivElement>(null);
  const change = (offset: number) => { if (files.length) onPathChange(files[(index + offset + files.length) % files.length].path); };
  return <Primitive.Root open={!!file} onOpenChange={value => { if (!value) onClose(); }}><Primitive.Portal><Primitive.Overlay className="fixed inset-0 z-50 bg-[var(--preview-overlay)] backdrop-blur-sm animate-pop" /><Primitive.Content ref={content} data-file-preview aria-modal="true" aria-describedby="file-preview-help" onOpenAutoFocus={event => { event.preventDefault(); content.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); returnFocus?.focus(); }} onKeyDownCapture={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); change(event.key === 'ArrowLeft' ? -1 : 1); } }} className="fixed top-1/2 left-1/2 z-50 flex h-[min(850px,90dvh)] w-[min(1200px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg outline-none animate-pop">{file && <><div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4"><Primitive.Title className="min-w-0 truncate text-lg font-semibold">{file.name}</Primitive.Title><div className="flex items-center gap-3"><span className="whitespace-nowrap text-xs text-fg-2 tabular-nums">{index + 1} / {files.length}</span><Primitive.Close asChild><IconButton label="关闭文件预览"><X size={20} /></IconButton></Primitive.Close></div></div><Primitive.Description id="file-preview-help" className="sr-only">左右方向键切换文件，按 Esc 关闭并回到原来的位置。</Primitive.Description><div className="relative min-h-0 flex-1 bg-subtle"><PreviewImage key={`${file.path}:${file.modifiedAt}`} file={file} />{files.length > 1 && <><IconButton label="上一个文件" className="absolute top-1/2 left-3 -translate-y-1/2 bg-surface shadow-md" onClick={() => change(-1)}><ChevronLeft size={22} /></IconButton><IconButton label="下一个文件" className="absolute top-1/2 right-3 -translate-y-1/2 bg-surface shadow-md" onClick={() => change(1)}><ChevronRight size={22} /></IconButton></>}</div><footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4"><div className="min-w-0 flex-1"><p className="truncate font-medium">{file.name}</p><p className="mt-1 truncate text-xs text-fg-2">{context(file)} · {formatFileSize(file.sizeBytes)}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => open.mutate(file.path)}><ExternalLink size={16} />用系统程序打开</Button><Button size="sm" onClick={() => reveal.mutate(file.path)}><FolderOpen size={16} />在文件夹中显示</Button><Button variant="primary" size="sm" disabled={copy.isPending} onClick={() => copy.mutate([file.path], { onSuccess: () => toast.success('已复制 1 个文件，可直接粘贴到微信') })}><Copy size={16} />复制文件</Button></div></footer></>}</Primitive.Content></Primitive.Portal></Primitive.Root>;
}
