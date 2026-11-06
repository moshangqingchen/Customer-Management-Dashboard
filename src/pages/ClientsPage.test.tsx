import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../api/mock';
import { reset } from '../api/mock/store';
import { useNav } from '../stores/nav';
import { useUI } from '../stores/ui';
import { ToastProvider } from '../components/ui';
import { ClientsPage } from './ClientsPage';

let queryClient: QueryClient;
const originals = { scrollIntoView: Element.prototype.scrollIntoView, hasPointerCapture: Element.prototype.hasPointerCapture, setPointerCapture: Element.prototype.setPointerCapture, releasePointerCapture: Element.prototype.releasePointerCapture };
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useNav.setState({ entries: [{ page: 'clients', params: {} }], index: 0 });
  useUI.setState({ theme: 'light', newProjectOpen: false, newClientOpen: false });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = () => false; Element.prototype.setPointerCapture = () => undefined; Element.prototype.releasePointerCapture = () => undefined;
});
afterEach(() => { queryClient.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); Object.assign(Element.prototype, originals); });
function mount() {
  render(<QueryClientProvider client={queryClient}><ClientsPage /><ToastProvider /></QueryClientProvider>);
  return userEvent.setup();
}

describe('客户核心交互', () => {
  it('客户账号可搜索，选择由导航历史驱动，为他新建项目保留客户', async () => {
    const first = await mockApi.clients.create({ name: '山川验收', accounts: [{ platform: '淘宝', handle: '山川官方旗舰店' }] });
    const second = await mockApi.clients.create({ name: '海风验收', phone: '13988887777' });
    const user = mount();
    const search = await screen.findByRole('textbox', { name: '搜索客户' });
    await user.type(search, '山川官方');
    const row = await screen.findByRole('button', { name: /山川验收.*0 个项目/ });
    expect(screen.queryByRole('button', { name: /海风验收.*0 个项目/ })).toBeNull();
    await user.click(row);
    expect(useNav.getState().entries.at(-1)?.params.clientId).toBe(first.id);
    await user.click(screen.getAllByRole('button', { name: '新建项目' })[0]);
    expect(useUI.getState().newProjectOpen).toBe(true);
    expect(useNav.getState().entries.at(-1)?.params.clientId).toBe(first.id);
    act(() => useNav.getState().navigate('clients', { clientId: second.id }));
    await waitFor(() => expect(screen.getByRole('button', { name: '编辑客户名称' }).textContent).toBe('海风验收'));
    act(() => useNav.getState().back());
    await waitFor(() => expect(screen.getByRole('button', { name: '编辑客户名称' }).textContent).toBe('山川验收'));
  });

  it('联系方式与平台账号就地保存，星级可清除，备注保留换行', async () => {
    const client = await mockApi.clients.create({ name: '客户编辑验收', wechat: 'leaf' });
    act(() => useNav.getState().navigate('clients', { clientId: client.id }));
    const user = mount();
    await screen.findByRole('button', { name: '编辑客户名称' });
    expect(screen.getByLabelText('主要联系方式').textContent).toContain('leaf');
    await user.click(screen.getByRole('button', { name: '查看资料' }));
    expect(screen.getByRole('tab', { name: '资料' }).getAttribute('aria-selected')).toBe('true');
    await user.click(screen.getByRole('button', { name: '添加客户资料' }));
    await user.click(screen.getByRole('menuitem', { name: '电话' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '编辑电话' })));
    await user.type(screen.getByRole('textbox', { name: '编辑电话' }), '13900001111{Enter}');
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).phone).toBe('13900001111'));
    await user.click(screen.getByRole('button', { name: '设为 5 星' }));
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).rating).toBe(5));
    await user.click(await screen.findByRole('button', { name: '设为 5 星，再次点击清除' }));
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).rating).toBe(0));
    await user.click(screen.getByRole('button', { name: '添加客户资料' }));
    await user.click(screen.getByRole('menuitem', { name: '平台账号' }));
    await user.type(screen.getByRole('textbox', { name: '新平台账号' }), 'leaf_official{Enter}');
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).accounts).toEqual([{ platform: '微信', handle: 'leaf_official' }]));
    const notes = screen.getByRole('textbox', { name: '编辑客户备注' });
    fireEvent.focus(notes); fireEvent.change(notes, { target: { value: '喜欢蓝色\n交付源文件' } }); fireEvent.blur(notes);
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).notes).toBe('喜欢蓝色\n交付源文件'));
    expect(document.querySelector(`[data-drop-target="client:${client.id}"]`)).toBeTruthy();
  });

  it('标签筛选与客户打标签入口分明，置顶与星级分别操作', async () => {
    const client = await mockApi.clients.create({ name: '标签筛选验收', rating: 4 });
    const tag = await mockApi.tags.create('客户筛选标签', 'blue');
    await mockApi.clients.setTags(client.id, [tag.id]);
    act(() => useNav.getState().navigate('clients', { clientId: client.id }));
    const user = mount();
    const filter = await screen.findByRole('button', { name: '按客户标签筛选' });
    expect(filter.textContent).toBe('标签');
    await user.click(filter);
    await user.click(screen.getByRole('checkbox', { name: '客户筛选标签' }));
    await user.keyboard('{Escape}');
    expect(within(screen.getByLabelText('客户列表')).getAllByRole('button')).toHaveLength(1);
    expect(filter.textContent).toBe('标签1');
    await user.click(screen.getByRole('button', { name: '置顶客户' }));
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).pinned).toBe(true));
    expect((await mockApi.clients.get(client.id)).rating).toBe(4);
    await user.click(screen.getByRole('button', { name: '客户标签' }));
    await user.type(screen.getByRole('textbox', { name: '搜索客户标签' }), '新客户标签');
    await user.click(screen.getByRole('button', { name: '创建标签「新客户标签」' }));
    await waitFor(async () => expect((await mockApi.tags.list()).some(item => item.name === '新客户标签')).toBe(true));
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).tagIds).toHaveLength(2));
  });

  it('修改客户名时询问文件夹同步，删除提示关联项目数并可撤销恢复', async () => {
    const client = await mockApi.clients.create({ name: '删除重命名验收' });
    await mockApi.projects.create({ clientId: client.id, title: '关联项目', priceCents: 128000 });
    await mockApi.files.openFolder({ clientId: client.id });
    act(() => useNav.getState().navigate('clients', { clientId: client.id }));
    const user = mount();
    await user.click(await screen.findByRole('button', { name: '编辑客户名称' }));
    const name = screen.getByRole('textbox', { name: '编辑客户名称' });
    await user.clear(name); await user.type(name, '改名验收{Enter}');
    const renameDialog = await screen.findByRole('dialog', { name: '同时重命名文件夹？' });
    await user.click(within(renameDialog).getByRole('button', { name: '仅修改名称' }));
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).name).toBe('改名验收'));
    expect((await mockApi.clients.get(client.id)).folder).toContain('删除重命名验收');
    await user.click(screen.getByRole('button', { name: '客户更多操作' }));
    await user.click(await screen.findByRole('menuitem', { name: '删除客户' }));
    const deleteDialog = await screen.findByRole('dialog', { name: '删除客户「改名验收」？' });
    expect(deleteDialog.textContent).toContain('1 个项目');
    expect(deleteDialog.textContent).toContain('1 个未完成');
    expect(deleteDialog.textContent).toContain('待收款 ¥1,280');
    await user.click(within(deleteDialog).getByRole('button', { name: '移入回收站' }));
    await waitFor(async () => expect((await mockApi.clients.list()).some(row => row.id === client.id)).toBe(false));
    fireEvent.click(await screen.findByRole('button', { name: '撤销' }));
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).projectCount).toBe(1));
    await waitFor(() => expect(useNav.getState().entries.at(-1)?.params.clientId).toBe(client.id));
  });

  it('客户快捷筛选可与搜索组合，清除筛选恢复完整列表', async () => {
    const active = await mockApi.clients.create({ name: '管理筛选甲' });
    await mockApi.projects.create({ clientId: active.id, title: '正在设计', priceCents: 50000 });
    await mockApi.clients.create({ name: '管理筛选乙' });
    const user = mount();
    await user.type(await screen.findByRole('textbox', { name: '搜索客户' }), '管理筛选');
    const list = screen.getByLabelText('客户列表');
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(2));
    await user.click(screen.getByRole('combobox', { name: '客户快捷筛选' }));
    await user.click(screen.getByRole('option', { name: '待收款' }));
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(1));
    expect(within(list).getByRole('button').textContent).toContain('管理筛选甲');
    await user.click(screen.getByRole('combobox', { name: '客户快捷筛选' }));
    await user.click(screen.getByRole('option', { name: '置顶' }));
    await user.click(await within(list).findByRole('button', { name: '清除筛选' }));
    await waitFor(() => expect(within(list).getAllByRole('button').length).toBeGreaterThan(2));
    expect(screen.getByRole('combobox', { name: '客户快捷筛选' }).textContent).toContain('常用客户');
    expect(screen.getByRole('combobox', { name: '客户排序' }).textContent).toContain('最近动态');
  });

  it('客户项目默认优先进行中，分类搜索保留历史欠款并可直接记一笔', async () => {
    const client = await mockApi.clients.create({ name: '项目管理验收', phone: '13900001111' });
    const active = await mockApi.projects.create({ clientId: client.id, title: '进行中海报', priceCents: 50000 });
    await mockApi.payments.add({ projectId: active.id, amountCents: 20000, paidAt: '2026-11-01' });
    const done = await mockApi.projects.create({ clientId: client.id, title: '历史包装', priceCents: 20000 });
    await mockApi.projects.setStatus(done.id, 'done');
    const cancelled = await mockApi.projects.create({ clientId: client.id, title: '已取消海报', priceCents: 90000 });
    await mockApi.projects.setStatus(cancelled.id, 'cancelled');
    act(() => useNav.getState().navigate('clients', { clientId: client.id }));
    const user = mount();
    const area = await screen.findByRole('region', { name: '客户项目' });
    expect(within(area).getByRole('button', { name: /进行中海报.*待收/ }).textContent).toContain('待收 ¥300');
    expect(within(area).queryByRole('button', { name: /历史包装.*待收/ })).toBeNull();
    expect(screen.getByLabelText('主要联系方式').textContent).toContain('13900001111');
    await user.click(within(area).getByRole('button', { name: '待收款 2' }));
    expect(within(area).queryByRole('button', { name: /已取消海报.*待收/ })).toBeNull();
    await user.type(within(area).getByRole('textbox', { name: '搜索此客户的项目' }), '历史包装');
    expect(within(area).queryByRole('button', { name: /进行中海报.*待收/ })).toBeNull();
    await user.click(within(area).getByRole('button', { name: '为「历史包装」记一笔' }));
    expect(useNav.getState().entries.at(-1)?.params).toEqual({ clientId: client.id, projectId: done.id, payment: true });
  });
});
