import { useState } from 'react';
import { FolderOpen, HardDrive, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useLibraryStatus, useOpenLibrary, usePickFolder, useSetLibraryRoot } from '../../hooks/queries';
import { formatFileSize } from '../../lib/files';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/Dialog';
import { SettingsCard } from './SettingsCard';

const labels = { ready: '文件库已就绪', notConfigured: '尚未选择文件库', missing: '文件库离线', readOnly: '文件库只读' };
export function LibrarySettings() {
  const library = useLibraryStatus(); const open = useOpenLibrary(); const pick = usePickFolder(); const change = useSetLibraryRoot(); const [nextRoot, setNextRoot] = useState<string>();
  async function choose() { const path = await pick.mutateAsync('选择新的文件库位置'); if (path && path !== library.data?.root) setNextRoot(path); }
  return <SettingsCard title="文件库" description="文件夹就是你的资料库，随时可用系统程序访问。" icon={<HardDrive />} tone="sky">
    <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${library.data?.state === 'ready' ? 'bg-success-bg text-success-fg' : 'bg-warning-bg text-warning-fg'}`}>{library.data ? labels[library.data.state] : '读取状态中…'}</span><span className="text-sm text-fg-2">可用空间：{library.data?.freeBytes == null ? '暂无法读取' : formatFileSize(library.data.freeBytes)}</span></div>
      <p className="break-all rounded-md bg-subtle px-4 py-3 text-sm">{library.data?.root ?? '未设置'}</p>
      <p className="text-xs text-fg-2">{library.error?.message ?? library.data?.message}</p>
      <div className="flex flex-wrap gap-2"><Button icon={<FolderOpen size={16} />} disabled={open.isPending || !library.data?.root || library.data.state === 'missing'} onClick={() => open.mutate(undefined)}>打开文件库</Button><Button icon={<RefreshCw size={16} />} disabled={pick.isPending || change.isPending} onClick={() => { void choose().catch(() => undefined); }}>更换位置</Button>{library.isError && <Button onClick={() => void library.refetch()}>重新读取</Button>}</div>
    </div>
    <ConfirmDialog open={!!nextRoot} onOpenChange={value => { if (!value) setNextRoot(undefined); }} title="更换文件库位置？" description={`新位置：${nextRoot ?? ''}。此操作只修改文件库指向，请先自行把原文件库内容移动到新位置，原文件不会自动复制。`} danger={false} confirmLabel="使用此位置" onConfirm={async () => { if (nextRoot) { await change.mutateAsync(nextRoot); toast.success('文件库位置已更新'); setNextRoot(undefined); } }} />
  </SettingsCard>;
}
