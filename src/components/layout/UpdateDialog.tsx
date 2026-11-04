import { Download } from 'lucide-react';
import { useUpdater } from '../../hooks/useUpdater';
import { Button, Dialog } from '../ui';
import { formatFileSize } from '../../lib/files';

export function UpdateDialog() {
  const updater = useUpdater();
  const percent = updater.total ? Math.min(100, Math.round(updater.downloaded / updater.total * 100)) : null;
  return <Dialog open={updater.open && !!updater.available} onOpenChange={updater.setOpen} title={`发现新版本 ${updater.available?.version ?? ''}`}
    description="安装完成后将自动重新打开客户工作台。" footer={<>
      <Button disabled={updater.installing} onClick={() => updater.setOpen(false)}>稍后再说</Button>
      <Button variant="primary" disabled={updater.installing || updater.checking} onClick={() => void updater.install()}>{updater.installing ? '正在更新…' : updater.checking ? '正在检查…' : '下载并安装'}</Button>
    </>}>
    <div className="flex items-center gap-3 text-fg-2"><Download size={20} /><p className="text-sm">当前版本 {updater.available?.currentVersion}</p></div>
    <p className="mt-5 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm">{updater.available?.body || '本次更新包含功能改进与问题修复。'}</p>
    {updater.installing && <div className="mt-5 space-y-2" role="status" aria-live="polite"><p className="text-sm text-fg-2">{percent === null ? `已下载 ${formatFileSize(updater.downloaded)}` : `下载进度 ${percent}%`}</p><progress aria-label="更新下载进度" max={100} value={percent ?? undefined} className="h-2 w-full accent-primary" /></div>}
    {updater.error && <p role="alert" className="mt-4 text-danger-fg">{updater.error}</p>}
  </Dialog>;
}
