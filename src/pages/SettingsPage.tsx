import { FolderTree, Monitor, Palette, ShoppingBag, Wallet } from 'lucide-react';
import { useSettings, useUpdateSettings } from '../hooks/queries';
import { useUI } from '../stores/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { AboutSettings } from '../components/settings/AboutSettings';
import { BackupSettings, TrashSettings } from '../components/settings/BackupSettings';
import { LibrarySettings } from '../components/settings/LibrarySettings';
import { SettingsCard } from '../components/settings/SettingsCard';
import { StringListEditor } from '../components/settings/StringListEditor';
import { TagSettings } from '../components/settings/TagSettings';
import { Button } from '../components/ui/Button';
import { EmptyState, Skeleton } from '../components/ui/Surfaces';

export function SettingsPage() {
  const settings = useSettings(); const update = useUpdateSettings(); const ui = useUI();
  return <div className="mx-auto max-w-[1440px] space-y-6 p-7"><PageHeader title="设置" description="让工作台更合你的习惯，也为资料多留一份安心。" />
    <LibrarySettings />
    {settings.isPending ? <div aria-label="设置加载中" className="grid gap-5 xl:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : settings.isError ? <EmptyState title="设置暂时读取失败" description={settings.error.message} action={<Button onClick={() => void settings.refetch()}>重新加载</Button>} /> : <>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <SettingsCard title="外观" description="为专注工作，选一套舒服的光线。" icon={<Palette />} tone="peach"><div className="grid grid-cols-3 gap-2">{([{ key: 'light', label: '浅色' }, { key: 'dark', label: '深色' }, { key: 'system', label: '跟随系统' }] as const).map(theme => <Button key={theme.key} variant={ui.theme === theme.key ? 'soft' : 'secondary'} aria-pressed={ui.theme === theme.key} disabled={update.isPending} onClick={() => { void update.mutateAsync({ theme: theme.key }).then(() => ui.setTheme(theme.key)).catch(() => undefined); }} icon={<Monitor size={15} />}>{theme.label}</Button>)}</div><label className="mt-6 flex cursor-pointer items-center justify-between gap-3"><span><span className="block text-sm">侧栏紧凑模式</span><span className="mt-1 block text-xs text-fg-2">折叠为图标栏，留出更多内容空间。</span></span><input type="checkbox" className="size-4 accent-primary" aria-label="侧栏紧凑模式" checked={ui.sidebarCollapsed} onChange={ui.toggleSidebar} /></label></SettingsCard>
        <SettingsCard title="新项目子文件夹" description="创建项目文件夹时，自动建立以下目录；清空即可关闭。" icon={<FolderTree />} tone="sky"><StringListEditor label="子文件夹" values={settings.data.subfolderTemplate} folders pending={update.isPending} onSave={values => update.mutateAsync({ subfolderTemplate: values })} />{settings.data.subfolderTemplate.length > 0 && <Button size="sm" variant="ghost" className="mt-3" disabled={update.isPending} onClick={() => update.mutate({ subfolderTemplate: [] })}>关闭自动创建子文件夹</Button>}</SettingsCard>
        <SettingsCard title="收款方式" description="用于记录收款，新方式不会影响历史流水。" icon={<Wallet />} tone="mint"><StringListEditor label="收款方式" values={settings.data.paymentMethods} pending={update.isPending} onSave={values => update.mutateAsync({ paymentMethods: values })} /></SettingsCard>
        <SettingsCard title="来源平台" description="记录客户与项目从哪里找到你。" icon={<ShoppingBag />} tone="violet"><StringListEditor label="来源平台" values={settings.data.sourcePlatforms} pending={update.isPending} onSave={values => update.mutateAsync({ sourcePlatforms: values })} /></SettingsCard>
      </div>
    </>}
    <TagSettings /><div className="grid items-start gap-5 xl:grid-cols-2"><BackupSettings /><TrashSettings /></div><AboutSettings />
  </div>;
}
