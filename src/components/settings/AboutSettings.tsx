import { Info, RefreshCw } from 'lucide-react';
import { useAppInfo } from '../../hooks/queries';
import { useUpdater } from '../../hooks/useUpdater';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Surfaces';
import { SettingsCard } from './SettingsCard';

export function AboutSettings() {
  const app = useAppInfo(); const updater = useUpdater();
  return <SettingsCard title="关于客户工作台" icon={<Info />} tone="violet">
    <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="font-semibold">让每一份创意，都有迹可循。</p>{app.isPending ? <Skeleton className="mt-2 w-20" /> : app.isError ? <Button size="sm" onClick={() => void app.refetch()}>版本读取失败，重试</Button> : <p className="mt-1 text-sm text-fg-2">版本 {app.data.version} · 本地桌面工作空间</p>}</div><Button icon={<RefreshCw size={16} />} disabled={updater.checking} onClick={() => { void updater.check(); }}>{updater.checking ? '正在检查…' : '检查更新'}</Button></div>
    {app.data && <details className="mt-4 text-xs text-fg-2"><summary className="cursor-pointer rounded-sm py-1">数据存储位置</summary><p className="mt-2 break-all leading-5">{app.data.dbPath}</p></details>}
  </SettingsCard>;
}
