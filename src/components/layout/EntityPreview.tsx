import { lazy, Suspense } from 'react';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { SidePanel } from '../ui';
import { PageSkeleton } from './PageSkeleton';

const ProjectDetail = lazy(() => import('../project/ProjectDetail').then(module => ({ default: module.ProjectDetail })));

export function EntityPreview() {
  const nav = useNav(); const route = nav.entries[nav.index]; const { projectId, payment, projectFullPage } = route.params;
  const width = useUI(s => s.panelWidth); const setWidth = useUI(s => s.setPanelWidth);
  const close = () => { const { projectId: _p, payment: _m, projectFullPage: _f, ...params } = route.params; nav.navigate(route.page, params); };
  return <SidePanel open={!!projectId && !projectFullPage} onOpenChange={open => { if (!open) close(); }} title="项目详情" width={width} onWidthChange={setWidth}
    onExpand={() => nav.navigate(route.page, { ...route.params, projectFullPage: true })}>
    {projectId && !projectFullPage && <Suspense fallback={<PageSkeleton label="正在加载项目详情" />}><ProjectDetail key={projectId} projectId={projectId} initialPayment={payment} onDeleted={close} /></Suspense>}
  </SidePanel>;
}
