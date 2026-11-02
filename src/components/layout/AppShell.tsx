import { lazy, Suspense, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFileDrop } from '../../hooks/useFileDrop';
import { useHotkeys } from '../../hooks/useHotkeys';
import { checkForUpdates } from '../../hooks/useUpdater';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { IconButton, Skeleton } from '../ui';
import { Sidebar, primaryPages } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { EntityPreview } from './EntityPreview';
import { NewProjectDialog } from '../project/NewProjectDialog';
import { NewClientDialog } from '../client/NewClientDialog';
import { IncomePage } from '../../pages/IncomePage';
import { FilesPage } from '../../pages/FilesPage';
import { SnippetsPage } from '../../pages/SnippetsPage';
import { SettingsPage } from '../../pages/SettingsPage';
import { UpdateDialog } from './UpdateDialog';
import { TodayPage } from '../../pages/TodayPage';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { ClientsPage } from '../../pages/ClientsPage';
import { ProjectDetail } from '../project/ProjectDetail';

const DesignSystemPage = import.meta.env.DEV ? lazy(() => import('../../pages/DesignSystemPage')) : null;
export function AppShell() {
  const nav = useNav(); const ui = useUI(); const route = nav.entries[nav.index];
  useFileDrop();
  useEffect(() => {
    const timer = setTimeout(() => { void checkForUpdates(true); }, 10_000);
    return () => clearTimeout(timer);
  }, []);
  useHotkeys({
    'ctrl+k': () => ui.setCommandOpen(!ui.commandOpen),
    'ctrl+n': () => { ui.setCommandOpen(false); ui.setNewClientOpen(false); ui.setNewProjectOpen(true); },
    'ctrl+shift+n': () => { ui.setCommandOpen(false); ui.setNewProjectOpen(false); ui.setNewClientOpen(true); },
    'alt+ArrowLeft': nav.back, 'alt+ArrowRight': nav.forward,
    '/': () => document.querySelector<HTMLInputElement>('main input[data-page-search]')?.focus(),
    ...Object.fromEntries(primaryPages.map(({ page }, index) => [`ctrl+${index + 1}`, () => nav.navigate(page)])),
  });
  useEffect(() => {
    const onMouse = (event: MouseEvent) => { if (event.button === 3 || event.button === 4) { event.preventDefault(); if (event.type === 'mouseup') (event.button === 3 ? nav.back : nav.forward)(); } };
    window.addEventListener('mousedown', onMouse); window.addEventListener('mouseup', onMouse); window.addEventListener('auxclick', onMouse);
    return () => { window.removeEventListener('mousedown', onMouse); window.removeEventListener('mouseup', onMouse); window.removeEventListener('auxclick', onMouse); };
  }, [nav.back, nav.forward]);
  return <div className="relative flex h-dvh overflow-hidden bg-app" style={{ backgroundImage: 'var(--bg-glow)', backgroundAttachment: 'fixed' }}>
    <Sidebar /><div className="flex min-w-0 flex-1 flex-col">
      {route.page !== 'today' && <div className="flex h-12 shrink-0 items-center gap-1 px-7">
        <IconButton label="后退（Alt+←）" disabled={nav.index === 0} onClick={nav.back}><ChevronLeft size={16} /></IconButton>
        <IconButton label="前进（Alt+→）" disabled={nav.index === nav.entries.length - 1} onClick={nav.forward}><ChevronRight size={16} /></IconButton>
        <span className="ml-2 text-xs text-fg-3">每一份创意，都有迹可循</span><span className="ml-auto text-xs text-fg-3">本地工作空间</span>
      </div>}
      <main id="main-content" className="min-h-0 flex-1 overflow-y-auto"><div key={route.page} className="page-enter min-h-full">
        {route.params.projectFullPage && route.params.projectId ? <div className="mx-auto max-w-[1100px] p-7"><ProjectDetail key={route.params.projectId} projectId={route.params.projectId} initialPayment={route.params.payment} onDeleted={() => nav.navigate('projects')} /></div> : route.page === 'today' ? <TodayPage /> : route.page === 'projects' ? <ProjectsPage /> : route.page === 'clients' ? <ClientsPage /> : route.page === 'income' ? <IncomePage /> : route.page === 'files' ? <FilesPage /> : route.page === 'snippets' ? <SnippetsPage /> : route.page === 'settings' ? <SettingsPage /> : route.page === 'design-system' && DesignSystemPage ? <Suspense fallback={<div className="p-8"><Skeleton className="h-60" /></div>}><DesignSystemPage /></Suspense> : null}
      </div></main>
    </div>
    <EntityPreview /><CommandPalette /><NewProjectDialog /><NewClientDialog /><UpdateDialog />
  </div>;
}
