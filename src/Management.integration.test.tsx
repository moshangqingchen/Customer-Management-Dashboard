import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { mockApi } from './api/mock';
import { reset } from './api/mock/store';
import { useNav } from './stores/nav';
import { useUI } from './stores/ui';

let query: QueryClient;
const originalScroll = Element.prototype.scrollIntoView;
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useNav.setState({ entries: [{ page: 'today', params: {} }], index: 0 });
  useUI.setState({ theme: 'light', commandOpen: false, newProjectOpen: false, newClientOpen: false, newProjectTemplate: null, settingsCategory: 'library' });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 640, 180));
});
afterEach(() => { query.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Element.prototype.scrollIntoView = originalScroll; });
function mount() { render(<QueryClientProvider client={query}><App /></QueryClientProvider>); return userEvent.setup(); }

describe('管理功能的页面接线', () => {
  it('今日到期跟进直达客户跟进选项卡，完成后今日清除且结果进入动态', async () => {
    const client = await mockApi.clients.create({ name: '跟进接线客户' });
    const item = await mockApi.followUps.create({ clientId: client.id, title: '回复验收意见', dueAt: '2020-01-01T00:00:00Z' });
    const user = mount();
    const today = await screen.findByRole('region', { name: '今日客户跟进' });
    await user.click(await within(today).findByRole('button', { name: /回复验收意见/ }));
    expect((await screen.findByRole('tab', { name: '跟进' })).getAttribute('aria-selected')).toBe('true');
    const panel = await screen.findByRole('region', { name: '客户跟进计划' });
    await user.click(await within(panel).findByRole('button', { name: '完成' }));
    const dialog = within(await screen.findByRole('dialog', { name: '完成客户跟进' }));
    await user.type(dialog.getByRole('textbox', { name: '跟进结果' }), '客户已确认，准备交付');
    await user.click(dialog.getByRole('button', { name: '确认完成' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '完成客户跟进' })).toBeNull());
    expect((await mockApi.followUps.list({ clientId: client.id })).find(value => value.id === item.id)).toMatchObject({ status: 'completed', result: '客户已确认，准备交付' });
    expect((await mockApi.activities.list({ clientId: client.id })).some(value => value.body.includes('客户已确认，准备交付'))).toBe(true);
    await user.click(screen.getByRole('button', { name: '今日' }));
    await screen.findByRole('heading', { name: '今日' });
    await waitFor(() => expect(within(screen.getByRole('region', { name: '今日客户跟进' })).queryByRole('button', { name: /回复验收意见/ })).toBeNull());
  }, 15000);

  it('文件页维护入口直达文件回收站和全局版本，恢复后原文件重新出现', async () => {
    const file = (await mockApi.files.recent(1))[0];
    await mockApi.fileHistory.save(file.path, '接线验收版本'); await mockApi.files.trash(file.path);
    act(() => useNav.getState().navigate('files'));
    const user = mount();
    await user.click(await screen.findByRole('button', { name: '文件版本与恢复' }));
    await user.click(await screen.findByRole('menuitem', { name: '文件回收站' }));
    expect((await screen.findByRole('tab', { name: '文件回收站' })).getAttribute('aria-selected')).toBe('true');
    await screen.findByText(file.name, { exact: true });
    await user.click(screen.getByRole('button', { name: '恢复文件' }));
    await waitFor(() => expect(screen.getByText('文件回收站是空的')).toBeTruthy());
    expect((await mockApi.files.recent(1000)).some(value => value.path === file.path)).toBe(true);
    await user.click(screen.getByRole('button', { name: '文件' }));
    await user.click(await screen.findByRole('button', { name: '文件版本与恢复' }));
    await user.click(await screen.findByRole('menuitem', { name: '全部文件版本' }));
    expect((await screen.findByRole('tab', { name: '文件版本' })).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('接线验收版本')).toBeTruthy();
  }, 15000);
});
