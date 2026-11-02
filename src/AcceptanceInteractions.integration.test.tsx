import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { App } from './App';
import { mockApi } from './api/mock';
import { reset, storageKey } from './api/mock/store';
import { useNav } from './stores/nav';
import { useUI } from './stores/ui';

let query: QueryClient;
const scrollIntoView = Element.prototype.scrollIntoView;
const hasPointerCapture = Element.prototype.hasPointerCapture;
const setPointerCapture = Element.prototype.setPointerCapture;
const releasePointerCapture = Element.prototype.releasePointerCapture;
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useNav.setState({ entries: [{ page: 'today', params: {} }], index: 0 });
  useUI.setState({ theme: 'light', projectView: 'list', sidebarCollapsed: false, tagsCollapsed: false, commandOpen: false, newClientOpen: false, newProjectOpen: false });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined; Element.prototype.releasePointerCapture = () => undefined;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 640, 180));
});
afterEach(() => {
  toast.dismiss(); query.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  Element.prototype.scrollIntoView = scrollIntoView; Element.prototype.hasPointerCapture = hasPointerCapture;
  Element.prototype.setPointerCapture = setPointerCapture; Element.prototype.releasePointerCapture = releasePointerCapture;
});
async function mount() {
  render(<QueryClientProvider client={query}><App /></QueryClientProvider>);
  await screen.findByRole('heading', { name: '今日' });
  return userEvent.setup();
}
const currentRoute = () => useNav.getState().entries[useNav.getState().index];

describe('最终验收：标签、命令与删除恢复', () => {
  it('标签可创建改色、关联客户项目、从侧栏筛选，合并后两种关联均保留且去重', async () => {
    const client = await mockApi.clients.create({ name: '标签验收客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '标签验收项目' });
    const other = await mockApi.projects.create({ clientId: client.id, title: '无标签对照项目' });
    const target = await mockApi.tags.create('验收合并目标', 'violet');
    const user = await mount();
    await user.click(screen.getByRole('button', { name: '设置' }));
    await user.type(await screen.findByRole('textbox', { name: '新标签名称' }), '验收新标签');
    const form = screen.getByRole('textbox', { name: '新标签名称' }).closest('form');
    if (!form) throw new Error('未找到新建标签表单');
    await user.click(within(form).getByRole('button', { name: '添加' }));
    await user.click(await screen.findByRole('combobox', { name: '标签颜色：验收新标签' }));
    await user.click(await screen.findByRole('option', { name: '绿' }));
    await waitFor(async () => expect((await mockApi.tags.list()).find(tag => tag.name === '验收新标签')?.color).toBe('green'));
    const source = (await mockApi.tags.list()).find(tag => tag.name === '验收新标签');
    if (!source) throw new Error('未创建标签');

    act(() => useNav.getState().navigate('clients', { clientId: client.id }));
    await user.click(await screen.findByRole('button', { name: '客户标签' }));
    await user.click(await screen.findByRole('checkbox', { name: source.name }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: source.name }).getAttribute('aria-checked')).toBe('true'));
    await user.click(screen.getByRole('checkbox', { name: target.name }));
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).tagIds).toEqual(expect.arrayContaining([source.id, target.id])));
    await user.keyboard('{Escape}');
    act(() => useNav.getState().navigate('projects', { projectId: project.id }));
    const panel = await screen.findByRole('dialog', { name: '项目详情' });
    await user.click(await within(panel).findByRole('button', { name: '编辑项目标签' }));
    await user.click(await screen.findByRole('checkbox', { name: source.name }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: source.name }).getAttribute('aria-checked')).toBe('true'));
    await user.click(screen.getByRole('checkbox', { name: target.name }));
    await waitFor(async () => expect((await mockApi.projects.get(project.id)).tagIds).toEqual(expect.arrayContaining([source.id, target.id])));
    await user.keyboard('{Escape}');
    await user.keyboard('{Escape}');
    const sidebar = screen.getByRole('complementary', { name: '主导航' });
    await user.click(await within(sidebar).findByRole('button', { name: /验收新标签/ }));
    await waitFor(() => expect(currentRoute().params.tagId).toBe(source.id));
    const main = screen.getByRole('main');
    await within(main).findByText(project.title);
    expect(within(main).queryByText(other.title)).toBeNull();

    await user.click(within(sidebar).getByRole('button', { name: '设置' }));
    await user.click(await screen.findByRole('button', { name: `合并标签：${source.name}` }));
    const merge = await screen.findByRole('dialog', { name: '合并标签' });
    await user.click(within(merge).getByRole('combobox', { name: '合并到标签' }));
    await user.click(await screen.findByRole('option', { name: target.name }));
    await user.click(within(merge).getByRole('button', { name: '确认合并' }));
    await waitFor(async () => expect((await mockApi.tags.list()).some(tag => tag.id === source.id)).toBe(false));
    expect((await mockApi.clients.get(client.id)).tagIds).toEqual([target.id]);
    expect((await mockApi.projects.get(project.id)).tagIds).toEqual([target.id]);
    await waitFor(() => expect(within(sidebar).queryByRole('button', { name: /验收新标签/ })).toBeNull());
    await user.click(within(sidebar).getByRole('button', { name: /验收合并目标/ }));
    await within(screen.getByRole('main')).findByText(project.title);
    expect(currentRoute().params.tagId).toBe(target.id);
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    expect(saved).toMatchObject({ clients: expect.arrayContaining([expect.objectContaining({ id: client.id, tagIds: [target.id] })]), projects: expect.arrayContaining([expect.objectContaining({ id: project.id, tagIds: [target.id] })]) });
  }, 10000);

  it('命令面板能搜到客户与项目，回车打开相应详情', async () => {
    const client = await mockApi.clients.create({ name: '榛果命令客户', phone: '13800001234' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '山岚命令项目' });
    const user = await mount();
    await user.keyboard('{Control>}k{/Control}');
    await user.type(await screen.findByRole('combobox', { name: '搜索与命令' }), client.phone);
    expect(await screen.findByRole('option', { name: client.name })).toBeTruthy();
    await user.keyboard('{Enter}');
    await screen.findByRole('button', { name: '编辑客户名称' });
    expect(currentRoute()).toEqual({ page: 'clients', params: { clientId: client.id } });
    await user.keyboard('{Control>}k{/Control}');
    await user.type(await screen.findByRole('combobox', { name: '搜索与命令' }), project.title);
    await screen.findByRole('option', { name: `${project.title} ${client.name}` });
    await user.keyboard('{Enter}');
    const panel = await screen.findByRole('dialog', { name: '项目详情' });
    await within(panel).findByRole('heading', { name: project.title });
    expect(currentRoute()).toEqual({ page: 'projects', params: { projectId: project.id } });
  });

  it('项目删除后点击通知撤销可找回，再次删除可从设置回收站恢复', async () => {
    const client = await mockApi.clients.create({ name: '删除验收客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '可撤销验收项目' });
    const user = await mount();
    async function removeFromPanel() {
      act(() => useNav.getState().navigate('projects', { projectId: project.id }));
      const panel = await screen.findByRole('dialog', { name: '项目详情' });
      await user.click(await within(panel).findByRole('button', { name: '项目更多操作' }));
      await user.click(await screen.findByRole('menuitem', { name: '删除项目' }));
      const confirm = await screen.findByRole('dialog', { name: '删除这个项目？' });
      await user.click(within(confirm).getByRole('button', { name: '移入回收站' }));
      await waitFor(async () => expect((await mockApi.projects.list()).some(item => item.id === project.id)).toBe(false));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: '项目详情' })).toBeNull());
    }
    await removeFromPanel();
    await user.click(await screen.findByRole('button', { name: '撤销' }));
    await waitFor(async () => expect((await mockApi.projects.list()).some(item => item.id === project.id)).toBe(true));
    expect((await mockApi.trash.list()).some(item => item.id === project.id)).toBe(false);
    await removeFromPanel();
    await user.click(screen.getByRole('button', { name: '设置' }));
    const title = await within(screen.getByRole('main')).findByText(project.title);
    const row = title.closest('div')?.parentElement;
    if (!row) throw new Error('未找到回收站项目');
    await user.click(within(row).getByRole('button', { name: '恢复' }));
    await waitFor(async () => expect((await mockApi.projects.get(project.id)).title).toBe(project.title));
    await waitFor(() => expect(within(screen.getByRole('main')).queryByText(project.title)).toBeNull());
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    expect(saved).toMatchObject({ projects: expect.arrayContaining([expect.objectContaining({ id: project.id, deletedAt: null })]) });
  });
});
