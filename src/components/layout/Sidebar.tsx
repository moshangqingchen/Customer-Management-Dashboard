import { CalendarDays, FolderKanban, Users, ChartNoAxesCombined, Files, MessagesSquare, Settings, TriangleAlert, PanelLeftClose, PanelLeftOpen, Search, Sun, Moon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLibraryStatus, useProjects, useUpdateSettings } from '../../hooks/queries';
import { isOverdue } from '../../lib/dates';
import { outstandingProjects } from '../../lib/stats';
import { cn } from '../../lib/cn';
import { useNav, pageLabels, type Page } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { IconButton, Tooltip } from '../ui';
import { Brand } from './Brand';
import { useUpdater } from '../../hooks/useUpdater';

export const primaryPages: { page: Page; icon: LucideIcon }[] = [
  { page: 'today', icon: CalendarDays }, { page: 'projects', icon: FolderKanban },
  { page: 'clients', icon: Users }, { page: 'income', icon: ChartNoAxesCombined },
  { page: 'files', icon: Files }, { page: 'snippets', icon: MessagesSquare },
];
export function Sidebar() {
  const ui = useUI(); const nav = useNav(); const route = nav.entries[nav.index];
  const { data: projects = [] } = useProjects(); const { data: library } = useLibraryStatus(); const updateSettings = useUpdateSettings();
  const collapsed = ui.sidebarCollapsed; const updateAvailable = useUpdater(s => !!s.available);
  const dark = ui.theme === 'dark' || (ui.theme === 'system' && document.documentElement.dataset.theme === 'dark');
  const overdue = projects.filter(p => isOverdue(p.dueDate, p.status)).length; const unpaid = outstandingProjects(projects).length;
  function navItem(page: Page, Icon: LucideIcon, shortcut?: number) {
    const label = pageLabels[page]; const selected = route.page === page;
    const count = page === 'projects' ? overdue : page === 'income' ? unpaid : 0;
    const tooltip = `${label}${shortcut ? ` Ctrl+${shortcut}` : ''}${count ? ` · ${count} 个${page === 'projects' ? '逾期项目' : '待收款项目'}` : ''}`;
    return <Tooltip key={page} content={tooltip}><button type="button" aria-label={label} title={tooltip}
      aria-current={selected ? 'page' : undefined} onClick={() => nav.navigate(page)}
      className={cn('relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-left transition-colors hover:bg-hover', collapsed && 'justify-center px-0', selected ? 'bg-accent-soft font-semibold text-accent' : 'text-fg-2')}>
      {selected && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary-gradient" />}
      <Icon size={20} strokeWidth={1.75} />{!collapsed && <span className="flex-1">{label}</span>}
      {count > 0 && <span aria-label={`${count} 个${page === 'projects' ? '逾期项目' : '待收款项目'}`} className={cn(collapsed ? 'absolute top-1.5 right-1.5 size-1.5 rounded-full' : 'min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums', page === 'projects' ? collapsed ? 'bg-danger' : 'bg-danger-bg text-danger-fg' : collapsed ? 'bg-fg-3' : 'bg-subtle text-fg-2')}>{!collapsed && count}</span>}
    </button></Tooltip>;
  }
  function toggleTheme() { const theme = dark ? 'light' : 'dark'; ui.setTheme(theme); updateSettings.mutate({ theme }); }
  return <aside aria-label="主导航" className={cn('z-10 m-3 mr-0 flex h-[calc(100dvh-24px)] shrink-0 flex-col rounded-xl border border-line/60 bg-sidebar shadow-md transition-[width] duration-200', collapsed ? 'w-[72px]' : 'w-[248px]')}>
    <div className={cn('flex h-[72px] shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}><Brand compact={collapsed} /></div>
    <div className={cn(collapsed ? 'px-3' : 'px-4')}><Tooltip content="搜索与命令 Ctrl+K"><button type="button" onClick={() => ui.setCommandOpen(true)} aria-label="搜索与命令"
      className={cn('mb-4 flex h-[38px] w-full items-center gap-2 rounded-md border border-line bg-subtle px-3 text-fg-2 transition-colors hover:bg-hover', collapsed && 'justify-center px-0')}>
      <Search size={18} />{!collapsed && <span className="text-sm">快速搜索</span>}
    </button></Tooltip></div>
    <nav className={cn('min-h-0 flex-1 space-y-1', collapsed ? 'px-3' : 'px-4')}>
      {primaryPages.map(({ page, icon }, index) => navItem(page, icon, index + 1))}
    </nav>
    <div className={cn('shrink-0', collapsed ? 'p-3' : 'p-4')}>
      {library && library.state !== 'ready' && <Tooltip content={library.message || '请检查文件库位置'}><button type="button" onClick={() => { ui.setSettingsCategory('library'); nav.navigate('settings'); }} aria-label="文件库未就绪，打开设置" className={cn('mb-3 flex w-full items-center gap-2 rounded-md bg-danger-bg p-2 text-sm text-danger-fg', collapsed && 'justify-center')}><TriangleAlert size={16} />{!collapsed && '文件库未就绪'}</button></Tooltip>}
      <div className={cn('flex items-center gap-1 border-t border-line pt-3', collapsed && 'flex-col')}><div className="relative min-w-0 flex-1">{navItem('settings', Settings)}{updateAvailable && <span role="status" aria-label="有新版本可用" title="有新版本可用，请在设置中查看" className="pointer-events-none absolute top-1 right-1 size-2 rounded-full bg-danger" />}</div>
        <IconButton label={dark ? '切换浅色主题' : '切换深色主题'} size="sm" onClick={toggleTheme}>{dark ? <Sun size={17} /> : <Moon size={17} />}</IconButton>
        <IconButton label={collapsed ? '展开侧栏' : '折叠侧栏'} size="sm" onClick={ui.toggleSidebar}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</IconButton>
      </div>
    </div>
  </aside>;
}
