import { FolderOpen, RefreshCw } from 'lucide-react';
import { useAppInfo, useOpenDataDir } from '../../hooks/queries';
import { useUpdater } from '../../hooks/useUpdater';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Surfaces';
import { SettingsCard } from './SettingsCard';

export function AboutSettings() {
  const app = useAppInfo(); const updater = useUpdater(); const openData = useOpenDataDir();
  return <SettingsCard title="关于客户工作台">
    <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1">{app.isPending ? <Skeleton className="w-20" /> : app.isError ? <Button size="sm" onClick={() => void app.refetch()}>版本读取失败，重试</Button> : <p className="text-sm text-fg-2">版本 {app.data.version}</p>}</div><Button icon={<RefreshCw size={16} />} disabled={updater.checking} onClick={() => { void updater.check(); }}>{updater.checking ? '正在检查…' : '检查更新'}</Button></div>
    {app.data && <div className="mt-5 border-t border-line pt-4">
      {app.data.portable && <span className="mb-3 inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">便携模式 · 数据都在程序旁边</span>}
      <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">数据位置</p><p className="mt-1 break-all text-sm leading-6 text-fg-2">{app.data.dataDir}</p></div><Button size="sm" icon={<FolderOpen size={16} />} disabled={openData.isPending} onClick={() => openData.mutate()}>打开</Button></div>
      <details className="mt-3 text-xs text-fg-2"><summary className="cursor-pointer rounded-sm py-1">数据库文件</summary><p className="mt-2 break-all leading-5">{app.data.dbPath}</p></details>
    </div>}
  </SettingsCard>;
}
