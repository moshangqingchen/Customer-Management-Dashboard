import { CalendarDays, FolderKanban, Users, ChartNoAxesCombined, Files, MessagesSquare, Settings, Star, TriangleAlert, Wallet, PanelLeftClose, PanelLeftOpen, ChevronDown, Search, Sun, Moon, Check, FolderOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useClients, useLibraryStatus, useProjects, useTags, useUpdateSettings } from '../../hooks/queries';
import { isOverdue } from '../../lib/dates';
import { outstanding } from '../../lib/money';
import { cn } from '../../lib/cn';
import { useNav, pageLabels, type Page, type RouteParams } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { IconButton, Kbd } from '../ui';
import { Brand } from './Brand';
import { useUpdater } from '../../hooks/useUpdater';

export const primaryPages: { page: Page; icon: LucideIcon }[] = [
  { page: 'today', icon: CalendarDays }, { page: 'projects', icon: FolderKanban },
  { page: 'clients', icon: Users }, { page: 'income', icon: ChartNoAxesCombined },
  { page: 'files', icon: Files }, { page: 'snippets', icon: MessagesSquare },
];
export function Sidebar() {
  const ui = useUI(); const nav = useNav(); const route = nav.entries[nav.index];
  const { data: projects = [] } = useProjects(); const { data: clients = [] } = useClients();
  const { data: tags = [] } = useTags(); const { data: library } = useLibraryStatus(); const updateSettings = useUpdateSettings();
  const collapsed = ui.sidebarCollapsed; const connected = library?.state === 'ready';
  const updateAvailable = useUpdater(s => !!s.available);
  const dark = ui.theme === 'dark' || (ui.theme === 'system' && document.documentElement.dataset.theme === 'dark');
  const views = [
    { view: 'pinned' as const, label: '星标', icon: Star, count: projects.filter(p => p.pinned).length + clients.filter(c => c.pinned).length },
    { view: 'overdue' as const, label: '逾期', icon: TriangleAlert, count: projects.filter(p => isOverdue(p.dueDate, p.status)).length },
    { view: 'outstanding' as const, label: '待收款', icon: Wallet, count: projects.filter(p => outstanding(p.priceCents, p.receivedCents, p.status) > 0).length },
  ];
  function navItem(page: Page, label: string, Icon: LucideIcon, params: RouteParams = {}, count?: number, shortcut?: number) {
    const { projectId: _projectId, clientId: _clientId, payment: _payment, ...viewParams } = route.params;
    const selected = route.page === page && (Object.keys(params).length === 0 ? !viewParams.view && !viewParams.tagId : JSON.stringify(viewParams) === JSON.stringify(params));
    return <button key={label} type="button" title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}
      aria-current={selected ? 'page' : undefined} onClick={() => nav.navigate(page, params)}
      className={cn('relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-left transition-colors hover:bg-hover', collapsed && 'justify-center px-0', selected ? 'bg-accent-soft font-semibold text-accent' : 'text-fg-2')}>
      {selected && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full" style={{ background: 'var(--primary-gradient)' }} />}
      <Icon size={20} strokeWidth={1.75} />{!collapsed && <><span className="flex-1">{label}</span>
        {count !== undefined && count > 0 && <span className={cn('min-w-5 rounded-lg px-1.5 text-center text-xs tabular-nums', params.view === 'pinned' ? 'bg-subtle text-fg-2' : 'bg-danger-bg text-danger-fg')}>{count}</span>}
        {shortcut && <span className="text-[10px] font-normal text-fg-3">{`Ctrl+${shortcut}`}</span>}</>}
    </button>;
  }
  function setTheme(theme: 'light' | 'dark') { ui.setTheme(theme); updateSettings.mutate({ theme }); }
  return <aside aria-label="主导航" className={cn('z-10 m-3 mr-0 flex h-[calc(100dvh-24px)] shrink-0 flex-col rounded-xl border border-line/60 bg-sidebar shadow-md transition-[width] duration-200', collapsed ? 'w-[72px]' : 'w-[248px]')}>
    <div className={cn('flex h-[104px] shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}><Brand compact={collapsed} /></div>
    <div className={cn(collapsed ? 'px-3' : 'px-4')}><button type="button" onClick={() => ui.setCommandOpen(true)} title="搜索与命令 Ctrl+K" aria-label="搜索与命令"
      className={cn('mb-5 flex h-[38px] w-full items-center gap-2 rounded-md border border-line bg-subtle px-3 text-fg-2 transition-colors hover:bg-hover', collapsed && 'justify-center px-0')}>
      <Search size={18} />{!collapsed && <><span className="flex-1 text-left text-sm">快速搜索</span><Kbd>Ctrl K</Kbd></>}
    </button></div>
    <nav className={cn('min-h-0 flex-1 space-y-5 overflow-y-auto', collapsed ? 'px-3' : 'px-4')}>
      <div className="space-y-1">{primaryPages.map(({ page, icon }, index) => navItem(page, pageLabels[page], icon, {}, undefined, collapsed ? undefined : index + 1))}</div>
      <div className="border-t border-line pt-4">{!collapsed && <p className="mb-2 px-3 text-xs font-medium text-fg-3">视图</p>}
        {views.map(v => navItem('projects', v.label, v.icon, { view: v.view }, v.count))}</div>
      {!collapsed && <div className="border-t border-line pt-4"><button type="button" className="mb-2 flex w-full items-center justify-between px-3 text-xs font-medium text-fg-3" onClick={ui.toggleTags} aria-expanded={!ui.tagsCollapsed}>
        标签<ChevronDown size={14} className={cn('transition-transform', ui.tagsCollapsed && '-rotate-90')} /></button>
        {!ui.tagsCollapsed && <div className="space-y-0.5">{tags.map(tag => <button type="button" key={tag.id} onClick={() => nav.navigate('projects', { tagId: tag.id })}
          className={cn('flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-fg-2 transition-colors hover:bg-hover', route.params.tagId === tag.id && 'bg-accent-soft text-accent')}>
          <span className="size-2.5 rounded-full" style={{ background: `var(--tag-${tag.color}-solid)` }} /><span className="flex-1 truncate">{tag.name}</span><span className="text-xs text-fg-3 tabular-nums">{tag.projectCount}</span>
        </button>)}</div>}</div>}
    </nav>
    <div className={cn('mt-4 shrink-0', collapsed ? 'p-3' : 'p-4')}>
      {!collapsed && <div className={cn('mb-4 flex items-center gap-3 rounded-lg px-3 py-3.5 text-sm', connected ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg')} title={library?.root ?? '尚未设置文件库'}>
        {connected ? <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success-fg/15"><Check size={16} /></span> : <FolderOpen size={22} />}
        <div className="min-w-0"><p className="font-medium">{connected ? '文件库已连接' : '文件库未就绪'}</p><p className="mt-0.5 truncate text-[11px] opacity-80">{connected ? '本地文件，安心保存' : '请检查文件库位置'}</p></div>
      </div>}
      <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}><div className="relative min-w-0 flex-1">{navItem('settings', '设置', Settings)}{updateAvailable && <span role="status" aria-label="有新版本可用" title="有新版本可用，请在设置中查看" className="pointer-events-none absolute top-2 right-2 size-2 rounded-full bg-danger" />}</div>
        {!collapsed && <div role="group" aria-label="外观主题" className="flex shrink-0 gap-0.5 rounded-full bg-subtle p-1">
          <IconButton label="切换浅色主题" aria-pressed={!dark} className={cn('size-8 rounded-full', !dark && 'bg-surface text-accent shadow-sm')} onClick={() => setTheme('light')}><Sun size={17} /></IconButton>
          <IconButton label="切换深色主题" aria-pressed={dark} className={cn('size-8 rounded-full', dark && 'bg-surface text-accent shadow-sm')} onClick={() => setTheme('dark')}><Moon size={17} /></IconButton>
        </div>}
      </div>
      <div className="mt-2 flex justify-center"><IconButton label={collapsed ? '展开侧栏' : '折叠侧栏'} className={cn(collapsed ? 'w-full' : 'h-6 w-full text-fg-3')} onClick={ui.toggleSidebar}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={14} />}</IconButton></div>
    </div>
  </aside>;
}
