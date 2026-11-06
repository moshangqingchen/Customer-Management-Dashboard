import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../api/mock';
import type { Client } from '../../api/types';
import { reset } from '../../api/mock/store';
import { queryKeys } from '../../hooks/queries';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { NewClientDialog } from './NewClientDialog';

let queryClient: QueryClient;
beforeEach(() => {
  reset();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useNav.setState({ entries: [{ page: 'clients', params: {} }], index: 0 });
  useUI.setState({ newClientOpen: true, newProjectOpen: false });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { queryClient.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function mount(preload = true) {
  if (preload) queryClient.setQueryData(queryKeys.clients, await mockApi.clients.list());
  render(<QueryClientProvider client={queryClient}><NewClientDialog /></QueryClientProvider>);
  return { user: userEvent.setup(), dialog: within(screen.getByRole('dialog', { name: '新建客户' })) };
}

describe('新建客户重复核对', () => {
  it('同名先核对，输入变化撤销确认，重新确认后允许创建独立客户', async () => {
    const existing = await mockApi.clients.create({ name: '山川设计同名验收' });
    const create = vi.spyOn(mockApi.clients, 'create');
    const { user, dialog } = await mount();
    await user.type(dialog.getByRole('textbox', { name: /客户名称/ }), existing.name);
    expect(dialog.getByRole('region', { name: '可能重复的客户' }).textContent).toContain('名称相同');
    await user.click(dialog.getByRole('button', { name: '创建客户' }));
    expect(dialog.getByRole('alert').textContent).toContain('请先核对已有客户');
    expect(create).not.toHaveBeenCalled();
    const confirm = dialog.getByRole<HTMLInputElement>('checkbox', { name: '确认需要独立建档，仍然新建' });
    await user.click(confirm);
    expect(confirm.checked).toBe(true);
    await user.type(dialog.getByRole('textbox', { name: '电话' }), '13900001111');
    expect(confirm.checked).toBe(false);
    await user.click(dialog.getByRole('button', { name: '创建客户' }));
    expect(create).not.toHaveBeenCalled();
    await user.click(confirm);
    await user.click(dialog.getByRole('button', { name: '创建客户' }));
    await waitFor(() => expect(useUI.getState().newClientOpen).toBe(false));
    const matching = (await mockApi.clients.list()).filter(client => client.name === existing.name);
    expect(matching).toHaveLength(2);
    expect(matching.find(client => client.id !== existing.id)?.phone).toBe('13900001111');
    expect(create).toHaveBeenCalledTimes(1);
    expect(useNav.getState().entries.at(-1)?.params.clientId).not.toBe(existing.id);
  });

  it('查看已有客户关闭弹窗并导航，不创建新记录', async () => {
    const existing = await mockApi.clients.create({ name: '已有客户导航验收', phone: '13988887777' });
    const before = (await mockApi.clients.list()).length;
    const create = vi.spyOn(mockApi.clients, 'create');
    const { user, dialog } = await mount();
    await user.type(dialog.getByRole('textbox', { name: /客户名称/ }), '另一个登记名字');
    await user.type(dialog.getByRole('textbox', { name: '电话' }), existing.phone);
    const notice = within(dialog.getByRole('region', { name: '可能重复的客户' }));
    expect(notice.getByText('电话相同')).toBeTruthy();
    await user.click(notice.getByRole('button', { name: '查看已有客户' }));
    expect(useUI.getState().newClientOpen).toBe(false);
    expect(useNav.getState().entries.at(-1)).toEqual({ page: 'clients', params: { clientId: existing.id } });
    expect(create).not.toHaveBeenCalled();
    expect((await mockApi.clients.list()).length).toBe(before);
  });

  it('关闭重开后不沿用上次同名确认，正常唯一客户无需额外确认', async () => {
    const existing = await mockApi.clients.create({ name: '重复确认重置验收' });
    const { user, dialog } = await mount();
    await user.type(dialog.getByRole('textbox', { name: /客户名称/ }), existing.name);
    await user.click(dialog.getByRole('checkbox', { name: '确认需要独立建档，仍然新建' }));
    await user.click(dialog.getByRole('button', { name: '取消' }));
    act(() => useUI.getState().setNewClientOpen(true));
    const reopened = within(screen.getByRole('dialog', { name: '新建客户' }));
    const name = reopened.getByRole<HTMLInputElement>('textbox', { name: /客户名称/ });
    expect(name.value).toBe('');
    await user.type(name, existing.name);
    expect(reopened.getByRole<HTMLInputElement>('checkbox', { name: '确认需要独立建档，仍然新建' }).checked).toBe(false);
    await user.clear(name); await user.type(name, '完全独立的新客户验收');
    expect(reopened.queryByRole('region', { name: '可能重复的客户' })).toBeNull();
    await user.click(reopened.getByRole('button', { name: '创建客户' }));
    await waitFor(() => expect(useUI.getState().newClientOpen).toBe(false));
    expect((await mockApi.clients.list()).filter(client => client.name === '完全独立的新客户验收')).toHaveLength(1);
  });

  it('核对尚未完成时按钮与快捷提交都不能绕过，查询结束后显示已有客户', async () => {
    const existing = await mockApi.clients.create({ name: '延迟核对验收' });
    const clients = await mockApi.clients.list();
    let completeRead: ((value: Client[]) => void) | undefined;
    const pending = new Promise<Client[]>(resolve => { completeRead = resolve; });
    vi.spyOn(mockApi.clients, 'list').mockReturnValueOnce(pending);
    const create = vi.spyOn(mockApi.clients, 'create');
    const { user, dialog } = await mount(false);
    await user.type(dialog.getByRole('textbox', { name: /客户名称/ }), existing.name);
    expect(dialog.getByRole<HTMLButtonElement>('button', { name: '创建客户' }).disabled).toBe(true);
    expect(dialog.getByRole('status').textContent).toContain('正在核对已有客户');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(dialog.getByRole('alert').textContent).toContain('正在核对已有客户');
    expect(create).not.toHaveBeenCalled();
    await act(async () => { completeRead?.(clients); });
    await waitFor(() => expect(dialog.queryByRole('status')).toBeNull());
    expect(dialog.getByRole('region', { name: '可能重复的客户' }).textContent).toContain(existing.name);
    await user.click(dialog.getByRole('button', { name: '创建客户' }));
    expect(create).not.toHaveBeenCalled();
  });

  it('核对失败必须显式确认，输入变化会撤销暂不核对的确认', async () => {
    vi.spyOn(mockApi.clients, 'list').mockRejectedValue(new Error('读取失败'));
    const create = vi.spyOn(mockApi.clients, 'create');
    const { user, dialog } = await mount(false);
    const skip = await dialog.findByRole<HTMLInputElement>('checkbox', { name: '确认暂不核对，继续创建' });
    await user.type(dialog.getByRole('textbox', { name: /客户名称/ }), '失败核对独立客户');
    await user.click(dialog.getByRole('button', { name: '创建客户' }));
    expect(dialog.getByRole('alert').textContent).toContain('请重试客户核对');
    expect(create).not.toHaveBeenCalled();
    await user.click(skip);
    expect(skip.checked).toBe(true);
    await user.type(dialog.getByRole('textbox', { name: '电话' }), '13812345678');
    expect(skip.checked).toBe(false);
    await user.click(skip);
    await user.click(dialog.getByRole('button', { name: '创建客户' }));
    await waitFor(() => expect(useUI.getState().newClientOpen).toBe(false));
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ name: '失败核对独立客户', phone: '13812345678' });
  });

  it('失败后可重新读取，新的重复匹配出现时必须重新确认独立建档', async () => {
    const existing = await mockApi.clients.create({ name: '重新读取验收' });
    const clients = await mockApi.clients.list();
    vi.spyOn(mockApi.clients, 'list').mockRejectedValueOnce(new Error('读取失败')).mockResolvedValue(clients);
    const { user, dialog } = await mount(false);
    await dialog.findByRole('checkbox', { name: '确认暂不核对，继续创建' });
    await user.type(dialog.getByRole('textbox', { name: /客户名称/ }), existing.name);
    await user.click(dialog.getByRole('button', { name: '重新读取' }));
    const confirm = await dialog.findByRole<HTMLInputElement>('checkbox', { name: '确认需要独立建档，仍然新建' });
    expect(dialog.queryByRole('checkbox', { name: '确认暂不核对，继续创建' })).toBeNull();
    await user.click(confirm);
    expect(confirm.checked).toBe(true);
    act(() => queryClient.setQueryData(queryKeys.clients, [...clients, { ...existing, id: 'another-client' }]));
    await waitFor(() => expect(confirm.checked).toBe(false));
    expect(dialog.getByRole('region', { name: '可能重复的客户' }).textContent).toContain('发现 2 位可能重复的客户');
  });
});
