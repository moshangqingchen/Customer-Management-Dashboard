import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { ClientsPage } from '../../pages/ClientsPage';
import { ToastProvider } from '../ui';

let queryClient: QueryClient;
const originals = { scrollIntoView: Element.prototype.scrollIntoView, hasPointerCapture: Element.prototype.hasPointerCapture, setPointerCapture: Element.prototype.setPointerCapture, releasePointerCapture: Element.prototype.releasePointerCapture };
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useNav.setState({ entries: [{ page: 'clients', params: {} }], index: 0 });
  useUI.setState({ newClientOpen: false, newProjectOpen: false });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = () => false; Element.prototype.setPointerCapture = () => undefined; Element.prototype.releasePointerCapture = () => undefined;
});
afterEach(() => { queryClient.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.assign(Element.prototype, originals); });
function mount() { render(<QueryClientProvider client={queryClient}><ClientsPage /><ToastProvider /></QueryClientProvider>); return userEvent.setup(); }

describe('客户归档与合并入口', () => {
  it('归档后默认隐藏，可从已归档筛选恢复，项目与金额继续保留', async () => {
    const customer = await mockApi.clients.create({ name: '归档界面验收' });
    await mockApi.projects.create({ clientId: customer.id, title: '仍需交付', priceCents: 128000 });
    act(() => useNav.getState().navigate('clients', { clientId: customer.id }));
    const user = mount();
    await user.click(await screen.findByRole('button', { name: '客户更多操作' }));
    await user.click(await screen.findByRole('menuitem', { name: '归档客户' }));
    const confirm = within(await screen.findByRole('dialog', { name: '归档客户「归档界面验收」？' }));
    expect(confirm.getByText(/1 个未完成项目和 ¥1,280 待收款/)).toBeTruthy();
    await user.click(confirm.getByRole('button', { name: '归档客户' }));
    await waitFor(() => expect(within(screen.getByLabelText('客户列表')).queryByRole('button', { name: /归档界面验收/ })).toBeNull());
    expect((await mockApi.clients.get(customer.id)).outstandingCents).toBe(128000);
    await user.click(screen.getByRole('combobox', { name: '客户快捷筛选' }));
    await user.click(screen.getByRole('option', { name: '已归档' }));
    await user.click(await within(screen.getByLabelText('客户列表')).findByRole('button', { name: /归档界面验收/ }));
    await user.click(screen.getByRole('button', { name: '客户更多操作' }));
    await user.click(await screen.findByRole('menuitem', { name: '恢复客户' }));
    await waitFor(async () => expect((await mockApi.customerManagement.states()).find(item => item.clientId === customer.id)?.archivedAt).toBeNull());
    expect((await mockApi.clients.get(customer.id)).projectCount).toBe(1);
  });

  it('合并先显示资料和项目预览，明确勾选后才执行并打开目标客户', async () => {
    const source = await mockApi.clients.create({ name: '合并界面来源', phone: '13800000001' });
    const target = await mockApi.clients.create({ name: '合并界面目标', phone: '13800000002' });
    await mockApi.projects.create({ clientId: source.id, title: '来源项目', priceCents: 50000 });
    act(() => useNav.getState().navigate('clients', { clientId: source.id }));
    const user = mount(); const merge = vi.spyOn(mockApi.customerManagement, 'merge');
    await user.click(await screen.findByRole('button', { name: '客户更多操作' }));
    await user.click(await screen.findByRole('menuitem', { name: '合并到其他客户' }));
    const dialog = within(await screen.findByRole('dialog', { name: '合并客户「合并界面来源」' }));
    expect(dialog.getByRole<HTMLButtonElement>('button', { name: '确认合并' }).disabled).toBe(true);
    await user.click(dialog.getByRole('combobox', { name: '选择客户' }));
    await user.click(await screen.findByRole('option', { name: '合并界面目标' }));
    const confirm = await dialog.findByRole('checkbox', { name: /我已核对/ });
    expect(dialog.getByText(/转入 1 个项目/)).toBeTruthy();
    expect(dialog.getByText(/保留「13800000002」，来源「13800000001」记入备注/)).toBeTruthy();
    expect(merge).not.toHaveBeenCalled();
    await user.click(confirm);
    await user.click(dialog.getByRole('button', { name: '确认合并' }));
    await waitFor(() => expect(useNav.getState().entries.at(-1)?.params.clientId).toBe(target.id));
    expect(merge).toHaveBeenCalledTimes(1);
    expect((await mockApi.clients.get(target.id)).projectCount).toBe(1);
    expect((await mockApi.clients.list()).some(item => item.id === source.id)).toBe(false);
  });
});
