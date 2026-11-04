import { Monitor } from 'lucide-react';
import { useSettings, useUpdateSettings } from '../hooks/queries';
import { useUI, type SettingsCategory } from '../stores/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { AboutSettings } from '../components/settings/AboutSettings';
import { BackupSettings, TrashSettings } from '../components/settings/BackupSettings';
import { LibrarySettings } from '../components/settings/LibrarySettings';
import { SettingsCard } from '../components/settings/SettingsCard';
import { StringListEditor } from '../components/settings/StringListEditor';
import { TagSettings } from '../components/settings/TagSettings';
import { Button } from '../components/ui/Button';
import { EmptyState, Skeleton } from '../components/ui/Surfaces';
import { cn } from '../lib/cn';

const categories: { value: SettingsCategory; label: string }[] = [
  { value: 'library', label: '文件库' }, { value: 'appearance', label: '外观' },
  { value: 'projects', label: '项目与收款' }, { value: 'tags', label: '标签' },
  { value: 'backup', label: '备份与回收站' }, { value: 'about', label: '关于' },
];

export function SettingsPage() {
  const settings = useSettings(); const update = useUpdateSettings(); const ui = useUI();
  const category = ui.settingsCategory;
  const editable = category === 'appearance' || category === 'projects';
  return <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-6">
    <PageHeader title="设置" />
    <div className="flex min-h-0 flex-1 gap-5">
      <nav aria-label="设置分类" className="w-40 shrink-0 space-y-1 overflow-y-auto rounded-lg border border-line/70 bg-surface p-2">
        {categories.map(item => <button key={item.value} type="button" aria-current={category === item.value ? 'page' : undefined} onClick={() => ui.setSettingsCategory(item.value)} className={cn('flex min-h-10 w-full items-center rounded-md px-3 text-left text-sm transition-colors hover:bg-hover', category === item.value ? 'bg-active font-medium text-primary' : 'text-fg-2')}>{item.label}</button>)}
      </nav>
      <div role="region" aria-label={categories.find(item => item.value === category)?.label} className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto pr-1 pb-1">
        {category === 'library' && <LibrarySettings />}
        {category === 'tags' && <TagSettings />}
        {category === 'backup' && <><BackupSettings /><TrashSettings /></>}
        {category === 'about' && <AboutSettings />}
        {editable && (settings.isPending ? <div aria-label="设置加载中"><Skeleton className="h-64" /></div> : settings.isError ? <EmptyState title="设置暂时读取失败" description={settings.error.message} action={<Button onClick={() => void settings.refetch()}>重新加载</Button>} /> : category === 'appearance' ?
          <SettingsCard title="外观">
            <div className="grid grid-cols-3 gap-2">{([{ key: 'light', label: '浅色' }, { key: 'dark', label: '深色' }, { key: 'system', label: '跟随系统' }] as const).map(theme => <Button key={theme.key} variant={ui.theme === theme.key ? 'soft' : 'secondary'} aria-pressed={ui.theme === theme.key} disabled={update.isPending} onClick={() => { void update.mutateAsync({ theme: theme.key }).then(() => ui.setTheme(theme.key)).catch(() => undefined); }} icon={<Monitor size={15} />}>{theme.label}</Button>)}</div>
            <label className="mt-6 flex cursor-pointer items-center justify-between gap-3"><span><span className="block text-sm">侧栏紧凑模式</span><span className="mt-1 block text-xs text-fg-2">折叠为图标栏</span></span><input type="checkbox" className="size-4 accent-primary" aria-label="侧栏紧凑模式" checked={ui.sidebarCollapsed} onChange={ui.toggleSidebar} /></label>
          </SettingsCard> : <>
            <SettingsCard title="新项目子文件夹" description="创建项目文件夹时自动建立；清空即可关闭。"><StringListEditor label="子文件夹" values={settings.data.subfolderTemplate} folders pending={update.isPending} onSave={values => update.mutateAsync({ subfolderTemplate: values })} />{settings.data.subfolderTemplate.length > 0 && <Button size="sm" variant="ghost" className="mt-3" disabled={update.isPending} onClick={() => update.mutate({ subfolderTemplate: [] })}>关闭自动创建子文件夹</Button>}</SettingsCard>
            <SettingsCard title="收款方式" description="新增或移除方式不会影响历史流水。"><StringListEditor label="收款方式" values={settings.data.paymentMethods} pending={update.isPending} onSave={values => update.mutateAsync({ paymentMethods: values })} /></SettingsCard>
            <SettingsCard title="来源平台"><StringListEditor label="来源平台" values={settings.data.sourcePlatforms} pending={update.isPending} onSave={values => update.mutateAsync({ sourcePlatforms: values })} /></SettingsCard>
          </>)}
      </div>
    </div>
  </div>;
}
