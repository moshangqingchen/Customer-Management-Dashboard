import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../api/mock';
import { reset, state } from '../api/mock/store';
import { today } from '../lib/dates';
import { useNav } from '../stores/nav';
import { FilesPage } from './FilesPage';
import { IncomePage } from './IncomePage';

let queryClient: QueryClient;
const originals = { scrollIntoView: Element.prototype.scrollIntoView, hasPointerCapture: Element.prototype.hasPointerCapture, setPointerCapture: Element.prototype.setPointerCapture, releasePointerCapture: Element.prototype.releasePointerCapture };
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = () => false; Element.prototype.setPointerCapture = () => undefined; Element.prototype.releasePointerCapture = () => undefined;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 300));
});
afterEach(() => { queryClient.clear(); vi.unstubAllGlobals(); Object.assign(Element.prototype, originals); vi.restoreAllMocks(); });
function mount(page: 'income' | 'files') { render(<QueryClientProvider client={queryClient}>{page === 'income' ? <IncomePage /> : <FilesPage />}</QueryClientProvider>); return userEvent.setup(); }

describe('收入与文件工作页', () => {
  it('收入呈现退款，导出当前方式流水，并可在本页完成收款', async () => {
    state().projects = []; state().payments = []; state().activities = [];
    const client = await mockApi.clients.create({ name: '收入验收客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '收入验收项目', priceCents: 20000 });
    await mockApi.payments.add({ projectId: project.id, amountCents: 10000, paidAt: today(), method: '微信' });
    await mockApi.payments.add({ projectId: project.id, kind: 'refund', amountCents: 1000, paidAt: today(), method: '微信' });
    const save = vi.spyOn(mockApi.app, 'saveTextFile').mockResolvedValue('流水.csv');
    const user = mount('income');
    await screen.findByText('−¥10');
    expect(screen.getByText('实收').closest('.stat-card')?.textContent).toContain('¥90');
    await user.click(screen.getByRole('button', { name: '导出 CSV' }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][1]).toContain(',-10.00,"退款",');
    await user.click(screen.getByRole('button', { name: '记一笔' }));
    const dialog = await screen.findByRole('dialog', { name: '记一笔收款' });
    expect((within(dialog).getByRole('textbox', { name: '金额（元）' }) as HTMLInputElement).value).toBe('110');
    await user.click(within(dialog).getByRole('button', { name: '记录收款' }));
    await waitFor(async () => expect((await mockApi.projects.get(project.id)).receivedCents).toBe(20000));
    await user.click(screen.getByRole('button', { name: '自定义' }));
    fireEvent.change(screen.getByLabelText('收入开始日期'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('收入结束日期'), { target: { value: '2026-11-01' } });
    expect(screen.getByRole('alert').textContent).toContain('结束日期不能早于开始日期');
  });
  it('文件页组合筛选、切换列表、打开文件与跳到项目使用真实hooks', async () => {
    const file = state().files.find(value => value.kind === 'design'); if (!file) throw new Error('没有设计文件');
    const open = vi.spyOn(mockApi.files, 'open'); const user = mount('files');
    await screen.findByRole('button', { name: `打开文件：${file.name}` });
    await user.type(screen.getByRole('textbox', { name: '搜索文件名' }), file.name);
    await user.click(screen.getByRole('combobox', { name: '筛选文件类型' }));
    await user.click(await screen.findByRole('option', { name: '设计源文件' }));
    expect(screen.getAllByRole('button', { name: /^打开文件：/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '文件列表视图' }));
    const row = screen.getByRole('button', { name: `打开文件：${file.name}` });
    await user.dblClick(row); await waitFor(() => expect(open).toHaveBeenCalledWith(file.path));
    fireEvent.contextMenu(row);
    await user.click(await screen.findByRole('menuitem', { name: '跳到项目' }));
    expect(useNav.getState().entries.at(-1)).toEqual({ page: 'projects', params: { projectId: file.projectId } });
  });
});
