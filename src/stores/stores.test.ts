import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNav } from './nav';
import { applyTheme, useUI } from './ui';

afterEach(() => {
  useNav.setState({ entries: [{ page: 'today', params: {} }], index: 0 });
  useUI.setState({ theme: 'system', sidebarCollapsed: false, tagsCollapsed: false, panelWidth: 600, projectView: 'list', fileView: 'grid', commandOpen: false, newProjectOpen: false, newClientOpen: false });
  localStorage.clear(); vi.restoreAllMocks();
});
describe('导航和界面偏好', () => {
  it('前进后退保留筛选，新导航截断分支且边界不越界', () => {
    useNav.getState().back(); expect(useNav.getState().index).toBe(0);
    useNav.getState().navigate('projects', { view: 'overdue' });
    useNav.getState().navigate('clients', { clientId: 'c1' });
    useNav.getState().back(); expect(useNav.getState().entries[useNav.getState().index]).toEqual({ page: 'projects', params: { view: 'overdue' } });
    useNav.getState().forward(); expect(useNav.getState().index).toBe(2);
    useNav.getState().back(); useNav.getState().navigate('files'); useNav.getState().forward();
    expect(useNav.getState().entries.map(route => route.page)).toEqual(['today', 'projects', 'files']); expect(useNav.getState().index).toBe(2);
    useNav.getState().navigate('files'); expect(useNav.getState().entries).toHaveLength(3);
  });
  it('持久化界面偏好，弹窗开关不会随重启恢复', () => {
    useUI.getState().setTheme('dark'); useUI.getState().toggleSidebar(); useUI.getState().setPanelWidth(1500);
    useUI.getState().setProjectView('kanban'); useUI.getState().setFileView('list'); useUI.getState().setCommandOpen(true);
    const stored: unknown = JSON.parse(localStorage.getItem('clientdesk.ui.v1') ?? '{}');
    expect(stored).toEqual({ version: 0, state: { theme: 'dark', sidebarCollapsed: true, tagsCollapsed: false, panelWidth: 880, projectView: 'kanban', fileView: 'list' } });
    useUI.getState().setPanelWidth(10); expect(useUI.getState().panelWidth).toBe(480);
  });
  it('跟随系统设置html主题，显式主题覆盖系统', () => {
    const media = vi.fn().mockReturnValue({ matches: true }); vi.stubGlobal('matchMedia', media);
    applyTheme('system'); expect(document.documentElement.dataset.theme).toBe('dark'); expect(document.documentElement.style.colorScheme).toBe('dark');
    applyTheme('light'); expect(document.documentElement.dataset.theme).toBe('light');
    media.mockReturnValue({ matches: false }); applyTheme('system'); expect(document.documentElement.dataset.theme).toBe('light');
    vi.unstubAllGlobals();
  });
});
