import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../api/mock';
import { reset } from '../api/mock/store';
import { today, dateOffset } from '../lib/dates';
import { useNav } from '../stores/nav';
import { useUI } from '../stores/ui';
import { ToastProvider } from '../components/ui';
import { ProjectsPage } from './ProjectsPage';

let queryClient: QueryClient;
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useNav.setState({ entries: [{ page: 'projects', params: {} }], index: 0 });
  useUI.setState({ theme: 'light', projectView: 'list', newProjectOpen: false });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { queryClient.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function mount() {
  render(<QueryClientProvider client={queryClient}><ProjectsPage /><ToastProvider /></QueryClientProvider>);
  return userEvent.setup();
}
async function sampleProjects() {
  const client = await mockApi.clients.create({ name: '项目页验收客户' });
  const first = await mockApi.projects.create({ clientId: client.id, title: '测试项目甲', status: 'active', dueDate: today(), priceCents: 10000 });
  const second = await mockApi.projects.create({ clientId: client.id, title: '测试项目乙', status: 'lead', dueDate: dateOffset(1), priceCents: 20000 });
  act(() => useNav.getState().navigate('projects', { filters: { query: '测试项目' } }));
  return { first, second };
}

describe('项目列表与看板交互', () => {
  it('列表使用上下键移动、Enter打开，项目行声明文件拖入目标', async () => {
    const { first, second } = await sampleProjects(); mount();
    const table = await screen.findByRole('table', { name: '项目列表' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map(row => row.getAttribute('data-drop-target'))).toEqual([`project:${first.id}`, `project:${second.id}`]);
    act(() => rows[0].focus()); fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(rows[1], { key: 'Enter' });
    expect(useNav.getState().entries.at(-1)?.params.projectId).toBe(second.id);
    fireEvent.keyDown(rows[1], { key: 'Home' }); expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0], { key: 'End' }); expect(document.activeElement).toBe(rows[1]);
  });

  it('侧栏预设显示可删除chip，查询与筛选组合保留在导航历史', async () => {
    act(() => useNav.getState().navigate('projects', { view: 'overdue' })); const user = mount();
    const chip = await screen.findByRole('button', { name: '移除筛选：逾期' });
    const table = await screen.findByRole('table', { name: '项目列表' });
    expect(within(table).getAllByRole('row').length).toBe(4);
    await user.click(chip);
    await waitFor(() => expect(within(screen.getByRole('table', { name: '项目列表' })).getAllByRole('row')).toHaveLength(33));
    await user.click(screen.getByRole('button', { name: '筛选项目状态' }));
    await user.click(screen.getByRole('checkbox', { name: '进行中' }));
    await screen.findByRole('button', { name: '移除筛选：进行中' });
    await user.keyboard('{Escape}');
    const search = screen.getByRole('textbox', { name: '搜索项目' }); await user.type(search, '海报');
    const filteredRows = within(screen.getByRole('table', { name: '项目列表' })).getAllByRole('row').slice(1);
    for (const row of filteredRows) { expect(row.textContent).toContain('海报'); expect(row.textContent).toContain('进行中'); }
    act(() => useNav.getState().back());
    expect((screen.getByRole('textbox', { name: '搜索项目' }) as HTMLInputElement).value).toBe('海');
  });

  it('右键修改状态失败时回滚并提示，成功后刷新仍保持', async () => {
    const { first } = await sampleProjects(); const user = mount();
    await screen.findByRole('table', { name: '项目列表' });
    const row = document.querySelector(`[data-drop-target="project:${first.id}"]`);
    if (!row) throw new Error('没有找到项目行');
    const change = vi.spyOn(mockApi.projects, 'setStatus').mockRejectedValueOnce(new Error('状态保存失败'));
    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole('menuitem', { name: '改为待确认' }));
    await screen.findByText('状态保存失败');
    await waitFor(() => expect(row.textContent).toContain('进行中'));
    expect((await mockApi.projects.get(first.id)).status).toBe('active');
    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole('menuitem', { name: '改为待确认' }));
    await waitFor(async () => expect((await mockApi.projects.get(first.id)).status).toBe('review'));
    expect(change).toHaveBeenCalledTimes(2);
    await queryClient.invalidateQueries();
    await waitFor(() => expect(row.textContent).toContain('待确认'));
  });

  it('看板展示完整状态列与文件目标，视图切换保留偏好', async () => {
    const { first, second } = await sampleProjects(); const user = mount();
    await screen.findByRole('table', { name: '项目列表' });
    await user.click(screen.getByRole('button', { name: '看板' }));
    await screen.findByRole('region', { name: '洽谈中' });
    expect(useUI.getState().projectView).toBe('kanban');
    expect(screen.getByRole('button', { name: '看板' }).getAttribute('aria-pressed')).toBe('true');
    for (const project of [first, second]) expect(document.querySelector(`[data-drop-target="project:${project.id}"]`)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '打开项目：测试项目甲' }));
    expect(useNav.getState().entries.at(-1)?.params.projectId).toBe(first.id);
    await user.click(screen.getByRole('button', { name: '列表' }));
    expect(useUI.getState().projectView).toBe('list');
    expect(localStorage.getItem('clientdesk.ui.v1')).toContain('"projectView":"list"');
  });

  it('键盘拖动到空看板列会持久化状态，Escape取消拖动，重新挂载仍位于目标列', async () => {
    const { first } = await sampleProjects();
    const columns = ['洽谈中', '进行中', '待确认', '已交付', '已完成'];
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const column = this.closest('section[aria-label]'); const index = columns.indexOf(column?.getAttribute('aria-label') ?? '');
      if (index < 0) return new DOMRect(0, 0, 1500, 700);
      if (this === column) return new DOMRect(index * 292, 0, 276, 600);
      return new DOMRect(index * 292 + 12, 100, 252, 260);
    });
    const user = mount(); await screen.findByRole('table', { name: '项目列表' });
    await user.click(screen.getByRole('button', { name: '看板' }));
    const handle = await screen.findByRole('button', { name: '拖动项目：测试项目甲' });
    act(() => handle.focus()); await user.keyboard('[Space]');
    await waitFor(() => expect(handle.getAttribute('aria-pressed')).toBe('true'));
    await user.keyboard('[ArrowRight]');
    await waitFor(() => expect(screen.getByText('移动到待确认')).toBeTruthy());
    await user.keyboard('[Space]');
    await waitFor(async () => expect((await mockApi.projects.get(first.id)).status).toBe('review'));
    const nextHandle = screen.getByRole('button', { name: '拖动项目：测试项目甲' });
    act(() => nextHandle.focus()); await user.keyboard('[Space]');
    await waitFor(() => expect(nextHandle.getAttribute('aria-pressed')).toBe('true'));
    await user.keyboard('[ArrowRight][Escape]');
    await waitFor(() => expect(nextHandle.getAttribute('aria-pressed')).not.toBe('true'));
    expect((await mockApi.projects.get(first.id)).status).toBe('review');
    cleanup(); queryClient.clear();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mount();
    const targetColumn = await screen.findByRole('region', { name: '待确认' });
    await within(targetColumn).findByRole('button', { name: '打开项目：测试项目甲' });
    expect(within(screen.getByRole('region', { name: '进行中' })).queryByRole('button', { name: '打开项目：测试项目甲' })).toBeNull();
  });
});
