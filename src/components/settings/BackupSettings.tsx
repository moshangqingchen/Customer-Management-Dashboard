import { useEffect, useState } from 'react';
import { ArchiveRestore, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { BackupInfo, TrashItem } from '../../api/types';
import { useBackups, useCreateBackup, usePurgeTrash, useRestoreBackup, useRestoreTrash, useTrash } from '../../hooks/queries';
import { formatFileSize } from '../../lib/files';
import { formatDate, formatDateTime } from '../../lib/dates';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/Dialog';
import { EmptyState, Skeleton } from '../ui/Surfaces';
import { SettingsCard } from './SettingsCard';
import { Tabs } from '../ui';
import { FileRecyclePanel } from '../files/FileRecyclePanel';
import { FileHistoryPanel } from '../files/FileHistoryPanel';
import { useNav } from '../../stores/nav';

const backupKinds = { auto: '自动', manual: '手动', beforeRestore: '恢复前' };
export function BackupSettings() {
  const backups = useBackups(); const create = useCreateBackup(); const restore = useRestoreBackup(); const [selected, setSelected] = useState<BackupInfo>();
  return <SettingsCard title="数据库备份" description="每日首次启动自动备份，保留最近 30 份自动备份。" action={<Button size="sm" disabled={create.isPending} onClick={() => { void create.mutateAsync(undefined).then(() => toast.success('备份已创建')).catch(() => undefined); }}>立即备份</Button>}>
    <p className="mb-4 text-xs leading-5 text-fg-2">备份保存在文件库的「_备份」目录；未设置文件库时存入应用数据目录。备份只包含客户、项目、收款与设置等数据库内容，设计文件请另行备份。</p>
    {backups.isPending ? <Skeleton className="h-32" /> : backups.isError ? <Button onClick={() => void backups.refetch()}>备份读取失败，重新加载</Button> : backups.data.length === 0 ? <p className="py-5 text-sm text-fg-2">还没有备份，点击「立即备份」保存一份安心。</p> : <div className="max-h-72 space-y-2 overflow-y-auto">{backups.data.map(backup => <div key={backup.fileName} className="flex min-w-0 items-center gap-3 rounded-md bg-subtle px-3 py-3"><ArchiveRestore size={18} className="shrink-0 text-fg-2" /><div className="min-w-0 flex-1"><p className="truncate text-sm" title={backup.path}>{backup.fileName}</p><p className="mt-1 text-xs text-fg-2">{backupKinds[backup.kind]} · {formatFileSize(backup.sizeBytes)} · {formatDateTime(backup.createdAt)}</p></div><Button size="sm" onClick={() => setSelected(backup)}>恢复</Button></div>)}</div>}
    <ConfirmDialog open={!!selected} onOpenChange={value => { if (!value) setSelected(undefined); }} title="从备份恢复？" description={`将恢复「${selected?.fileName ?? ''}」中的全部数据库内容，当前数据会先自动另存一份恢复前备份。设计文件不受此操作影响。`} confirmLabel="确认恢复" danger={false} onConfirm={async () => { if (selected) { await restore.mutateAsync(selected.fileName); toast.success('备份已恢复，工作空间已刷新'); } }} />
  </SettingsCard>;
}
function RecordTrashPanel() {
  const trash = useTrash(); const restore = useRestoreTrash(); const purge = usePurgeTrash(); const [selected, setSelected] = useState<TrashItem>();
  return <div>
    {trash.isPending ? <Skeleton className="h-32" /> : trash.isError ? <Button onClick={() => void trash.refetch()}>回收站读取失败，重新加载</Button> : trash.data.length === 0 ? <EmptyState illustrationName="empty-projects" title="回收站是空的" description="删除的客户与项目会暂存在这里。" /> : <div className="max-h-80 space-y-2 overflow-y-auto">{trash.data.map(item => <div key={`${item.type}:${item.id}`} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-subtle px-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm" title={item.title}>{item.title}</p><p className="mt-1 truncate text-xs text-fg-2">{item.type === 'client' ? '客户' : '项目'} · {item.subtitle || '无备注'} · {formatDate(item.deletedAt)}</p></div><Button size="sm" icon={<RotateCcw size={14} />} disabled={restore.isPending} onClick={() => { void restore.mutateAsync({ type: item.type, id: item.id }).then(() => toast.success('已恢复')).catch(() => undefined); }}>恢复</Button><Button variant="ghost" size="sm" onClick={() => setSelected(item)}>彻底删除</Button></div>)}</div>}
    <ConfirmDialog open={!!selected} onOpenChange={value => { if (!value) setSelected(undefined); }} title="彻底删除？" description={`「${selected?.title ?? ''}」${selected?.type === 'client' ? '及其所有项目、收款和动态' : '及其收款和动态'}将被永久删除，无法撤销。磁盘中的文件夹会保留，请自行处理。`} confirmLabel="彻底删除" onConfirm={async () => { if (selected) { await purge.mutateAsync({ type: selected.type, id: selected.id }); toast.success('记录已彻底删除，文件夹已保留'); } }} />
  </div>;
}

export function TrashSettings() {
  const requested = useNav(state => state.entries[state.index].params.recoveryTab);
  const [tab, setTab] = useState<string>(requested ?? 'records');
  useEffect(() => { if (requested) setTab(requested); }, [requested]);
  return <SettingsCard title="回收站与文件版本"><Tabs label="恢复内容分类" value={tab} onChange={setTab} items={[
    { value: 'records', label: '客户与项目', content: <RecordTrashPanel /> },
    { value: 'files', label: '文件回收站', content: <FileRecyclePanel /> },
    { value: 'versions', label: '文件版本', content: <FileHistoryPanel /> },
  ]} /></SettingsCard>;
}
