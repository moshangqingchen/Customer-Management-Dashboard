import { useMemo, useState } from 'react';
import { useFileVersions } from '../../hooks/fileHistory';
import { Button, Input, Skeleton } from '../ui';
import { FileVersionList } from './FileVersionList';

export function FileHistoryPanel() {
  const versions = useFileVersions(); const [query, setQuery] = useState('');
  const visible = useMemo(() => { const text = query.trim().toLowerCase(); return (versions.data ?? []).filter(version => `${version.originalRelPath} ${version.note}`.toLowerCase().includes(text)); }, [versions.data, query]);
  return <div className="space-y-4"><div className="flex gap-2"><Input aria-label="搜索文件历史路径或备注" placeholder="搜索原文件路径或版本备注…" value={query} onChange={event => setQuery(event.target.value)} /><Button disabled={versions.isFetching} onClick={() => void versions.refetch()}>刷新</Button></div>
    <p className="text-xs text-fg-2">这里保存手动快照和替换前版本。快照文件位于文件库内，数据库备份不包含这些文件。</p>
    {versions.isPending ? <Skeleton className="h-32" /> : versions.isError ? <p role="alert" className="text-sm text-danger-fg">{versions.error.message}</p> : visible.length ? <FileVersionList versions={visible} showPath /> : <p className="py-6 text-center text-sm text-fg-2">{query ? '没有匹配的历史版本' : '当前文件库还没有历史版本'}</p>}
  </div>;
}
