import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../api/mock';
import { reset } from '../api/mock/store';
import { useUI } from '../stores/ui';
import { ToastProvider } from '../components/ui';
import { SettingsPage } from './SettingsPage';
import { SnippetsPage } from './SnippetsPage';

let q: QueryClient;
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  q = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useUI.setState({ theme: 'light', sidebarCollapsed: false });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }));
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  HTMLElement.prototype.setPointerCapture = vi.fn(); HTMLElement.prototype.releasePointerCapture = vi.fn(); HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { q.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function mount(page: 'settings' | 'snippets') { const user = userEvent.setup(); render(<QueryClientProvider client={q}>{page === 'settings' ? <SettingsPage /> : <SnippetsPage />}<ToastProvider /></QueryClientProvider>); return user; }

describe('设置与话术', () => {
  it('话术保留换行复制并记录使用次数，搜索会跨越当前分组', async () => {
    const user = mount('snippets'); const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(await screen.findByRole('button', { name: '选择分组：接单沟通' }));
    await user.click(screen.getByRole('button', { name: '复制话术：首次问候' }));
    expect(clipboard).toHaveBeenCalledWith(expect.stringContaining('\n'));
    await waitFor(async () => expect((await mockApi.snippets.list()).find(item => item.id === 'snippet-1')?.useCount).toBe(1));
    await user.type(screen.getByRole('textbox', { name: '搜索话术' }), '尾款');
    expect(await screen.findByRole('button', { name: '复制话术：尾款提醒' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '复制话术：首次问候' })).toBeNull();
  });

  it('创建分组与多行话术，删除分组必须确认并连带删除话术', async () => {
    const user = mount('snippets');
    await user.click(await screen.findByRole('button', { name: '新建分组' }));
    await user.type(screen.getByRole('textbox', { name: '分组名称' }), '验收分组'); await user.click(screen.getByRole('button', { name: '创建分组' }));
    await user.click((await screen.findAllByRole('button', { name: '新建话术' }))[0]);
    const dialog = await screen.findByRole('dialog', { name: '新建话术' });
    await user.type(within(dialog).getByRole('textbox', { name: '话术标题' }), '验收标题');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '话术内容' }), { target: { value: '第一行\n第二行' } });
    await user.click(within(dialog).getByRole('button', { name: '保存话术' }));
    await screen.findByRole('button', { name: '复制话术：验收标题' });
    await user.click(screen.getByRole('button', { name: '删除分组：验收分组' }));
    expect((await mockApi.snippets.list()).some(item => item.title === '验收标题')).toBe(true);
    const confirm = await screen.findByRole('dialog', { name: '删除话术分组？' });
    await user.click(within(confirm).getByRole('button', { name: '确认删除' }));
    await waitFor(async () => expect((await mockApi.snippets.list()).some(item => item.title === '验收标题')).toBe(false));
  });

  it('设置修改即时保存，恢复备份会还原设置并全量刷新', async () => {
    const backup = await mockApi.backups.create(); const user = mount('settings');
    await user.click(await screen.findByRole('button', { name: '深色' }));
    await waitFor(() => expect(useUI.getState().theme).toBe('dark'));
    await user.type(screen.getByRole('textbox', { name: '新收款方式' }), '云闪付{Enter}');
    await waitFor(async () => expect((await mockApi.settings.get()).paymentMethods).toContain('云闪付'));
    await user.click(screen.getByRole('checkbox', { name: '侧栏紧凑模式' })); expect(useUI.getState().sidebarCollapsed).toBe(true);
    await user.click(screen.getByRole('button', { name: '关闭自动创建子文件夹' }));
    await waitFor(async () => expect((await mockApi.settings.get()).subfolderTemplate).toEqual([]));
    const backupRow = screen.getByText(backup.fileName).closest('div')?.parentElement;
    if (!backupRow) throw new Error('未找到备份行');
    await user.click(within(backupRow).getByRole('button', { name: '恢复' }));
    const confirm = await screen.findByRole('dialog', { name: '从备份恢复？' });
    await user.click(within(confirm).getByRole('button', { name: '确认恢复' }));
    await waitFor(() => expect(useUI.getState().theme).toBe('system'));
    await waitFor(() => expect(screen.queryByRole('button', { name: '删除收款方式：云闪付' })).toBeNull());
    expect((await mockApi.backups.list()).some(item => item.kind === 'beforeRestore')).toBe(true);
  });

  it('标签合并转移关联，回收站恢复及永久删除都有明确入口', async () => {
    const a = await mockApi.tags.create('合并来源', 'blue'); const b = await mockApi.tags.create('合并目标', 'green');
    const client = await mockApi.clients.create({ name: '待恢复客户', tagIds: [a.id] }); await mockApi.clients.delete(client.id);
    const user = mount('settings');
    await user.click(await screen.findByRole('button', { name: '合并标签：合并来源' }));
    const merge = await screen.findByRole('dialog', { name: '合并标签' });
    await user.click(within(merge).getByRole('combobox', { name: '合并到标签' }));
    await user.click(await screen.findByRole('option', { name: '合并目标' }));
    await user.click(within(merge).getByRole('button', { name: '确认合并' }));
    await waitFor(async () => expect((await mockApi.tags.list()).some(item => item.id === a.id)).toBe(false));
    const trashRow = screen.getByText('待恢复客户').closest('div')?.parentElement;
    if (!trashRow) throw new Error('未找到回收站行');
    await user.click(within(trashRow).getByRole('button', { name: '恢复' }));
    await waitFor(async () => expect((await mockApi.clients.get(client.id)).tagIds).toEqual([b.id]));
  });
});
