import { useMemo, useState } from 'react';
import { useRecycledFiles, useRestoreRecycledFile } from '../../hooks/fileHistory';
import { useRevealFile } from '../../hooks/queries';
import { formatDateTime } from '../../lib/dates';
import { formatFileSize } from '../../lib/files';
import { Button, Input, Skeleton, toast } from '../ui';

export function FileRecyclePanel() {
  const files = useRecycledFiles(); const restore = useRestoreRecycledFile(); const reveal = useRevealFile(); const [query, setQuery] = useState('');
  const visible = useMemo(() => (files.data ?? []).filter(file => file.originalRelPath.toLowerCase().includes(query.trim().toLowerCase())), [files.data, query]);
  return <div className="space-y-4"><div className="flex gap-2"><Input aria-label="搜索回收文件" placeholder="搜索原文件名或目录…" value={query} onChange={event => setQuery(event.target.value)} /><Button disabled={files.isFetching} onClick={() => void files.refetch()}>刷新</Button></div>
    <p className="text-xs text-fg-2">恢复到原目录；遇到同名文件自动编号，不覆盖现有文件。旧回收文件保留当前文件名，显示时间来自文件修改时间。</p>
    {files.isPending ? <Skeleton className="h-32" /> : files.isError ? <p role="alert" className="text-sm text-danger-fg">{files.error.message}</p> : !visible.length ? <p className="py-6 text-center text-sm text-fg-2">{query ? '没有匹配的回收文件' : '文件回收站是空的'}</p>
      : <div className="space-y-2">{visible.map(file => <div key={file.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-b-0"><div className="min-w-0 flex-1"><p className="break-all font-medium">{file.name}</p><p className="mt-1 break-all text-xs text-fg-2">{file.originalRelPath}</p><p className="mt-1 text-xs text-fg-2">{file.legacy ? '旧回收文件 · ' : ''}{formatDateTime(file.deletedAt)} · {formatFileSize(file.sizeBytes)}</p></div>
        <Button size="sm" variant="ghost" onClick={() => reveal.mutate(file.storedPath)}>定位</Button><Button size="sm" disabled={restore.isPending} onClick={() => restore.mutate(file.id, { onSuccess: result => toast.success(`已恢复：${result.relPath}`) })}>恢复文件</Button></div>)}</div>}
  </div>;
}
