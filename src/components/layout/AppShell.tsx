import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useFileDrop } from '../../hooks/useFileDrop';
import { useHotkeys } from '../../hooks/useHotkeys';
import { checkForUpdates } from '../../hooks/useUpdater';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { Button, Skeleton } from '../ui';
import { Sidebar, primaryPages } from './Sidebar';
import { EntityPreview } from './EntityPreview';
import { UpdateDialog } from './UpdateDialog';
import { PageSkeleton } from './PageSkeleton';
import { PageHeader } from './PageHeader';

const TodayPage = lazy(() => import('../../pages/TodayPage').then(module => ({ default: module.TodayPage })));
const ProjectsPage = lazy(() => import('../../pages/ProjectsPage').then(module => ({ default: module.ProjectsPage })));
const ClientsPage = lazy(() => import('../../pages/ClientsPage').then(module => ({ default: module.ClientsPage })));
const IncomePage = lazy(() => import('../../pages/IncomePage').then(module => ({ default: module.IncomePage })));
const FilesPage = lazy(() => import('../../pages/FilesPage').then(module => ({ default: module.FilesPage })));
const SnippetsPage = lazy(() => import('../../pages/SnippetsPage').then(module => ({ default: module.SnippetsPage })));
const SettingsPage = lazy(() => import('../../pages/SettingsPage').then(module => ({ default: module.SettingsPage })));
const ProjectDetail = lazy(() => import('../project/ProjectDetail').then(module => ({ default: module.ProjectDetail })));
const CommandPalette = lazy(() => import('./CommandPalette').then(module => ({ default: module.CommandPalette })));
const NewProjectDialog = lazy(() => import('../project/NewProjectDialog').then(module => ({ default: module.NewProjectDialog })));
const NewClientDialog = lazy(() => import('../client/NewClientDialog').then(module => ({ default: module.NewClientDialog })));
const DesignSystemPage = import.meta.env.DEV ? lazy(() => import('../../pages/DesignSystemPage')) : null;

// Retain dialogs after their first opening so closing keeps Radix focus restoration.
function useOpened(active: boolean) {
  const [opened, setOpened] = useState(active);
  useEffect(() => { if (active) setOpened(true); }, [active]);
  return active || opened;
}
function DialogSkeleton({ title, open, onOpenChange }: { title: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  function close() { onOpenChange(false); opener.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onOpenChange(false); opener.current?.focus(); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, onOpenChange]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"><div role="status" aria-label={`正在加载${title}`} className="w-[calc(100%-32px)] max-w-lg space-y-4 rounded-xl border border-line bg-surface p-6 shadow-lg">
    <p className="font-semibold">正在加载{title}</p><Skeleton className="h-10" /><Skeleton className="h-32" /><Button onClick={close}>取消</Button>
  </div></div>;
}
export function AppShell() {
  const nav = useNav(); const ui = useUI(); const route = nav.entries[nav.index];
  const commandOpened = useOpened(ui.commandOpen); const projectOpened = useOpened(ui.newProjectOpen); const clientOpened = useOpened(ui.newClientOpen);
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
      <main id="main-content" className={`min-h-0 flex-1 ${!route.params.projectFullPage && (route.page === 'clients' || route.page === 'settings') ? 'overflow-hidden' : 'overflow-y-auto'}`}><div key={route.page} className="page-enter h-full"><Suspense fallback={<PageSkeleton />}>
        {route.params.projectFullPage && route.params.projectId ? <div className="mx-auto max-w-[1100px] space-y-4 p-6"><PageHeader title="项目" /><ProjectDetail key={route.params.projectId} projectId={route.params.projectId} initialPayment={route.params.payment} onDeleted={() => nav.navigate('projects')} /></div> : route.page === 'today' ? <TodayPage /> : route.page === 'projects' ? <ProjectsPage /> : route.page === 'clients' ? <ClientsPage /> : route.page === 'income' ? <IncomePage /> : route.page === 'files' ? <FilesPage /> : route.page === 'snippets' ? <SnippetsPage /> : route.page === 'settings' ? <SettingsPage /> : route.page === 'design-system' && DesignSystemPage ? <DesignSystemPage /> : null}
      </Suspense>
      </div></main>
    </div>
    <EntityPreview />
    {commandOpened && <Suspense fallback={<DialogSkeleton title="搜索与命令" open={ui.commandOpen} onOpenChange={ui.setCommandOpen} />}><CommandPalette /></Suspense>}
    {projectOpened && <Suspense fallback={<DialogSkeleton title="新建项目" open={ui.newProjectOpen} onOpenChange={ui.setNewProjectOpen} />}><NewProjectDialog /></Suspense>}
    {clientOpened && <Suspense fallback={<DialogSkeleton title="新建客户" open={ui.newClientOpen} onOpenChange={ui.setNewClientOpen} />}><NewClientDialog /></Suspense>}
    <UpdateDialog />
  </div>;
}
