import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { useNav } from '../../stores/nav';
import { ProjectDetail } from './ProjectDetail';

let queryClient: QueryClient; let projectId: string;
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const client = await mockApi.clients.create({ name: '收款选项卡客户' });
  const project = await mockApi.projects.create({ clientId: client.id, title: '收款选项卡项目', priceCents: 12345 });
  projectId = project.id;
  useNav.setState({ entries: [{ page: 'projects', params: { projectId } }], index: 0 });
});
afterEach(() => queryClient.clear());
function mount(initialPayment = false) {
  const view = render(<QueryClientProvider client={queryClient}><ProjectDetail projectId={projectId} initialPayment={initialPayment} /></QueryClientProvider>);
  return { ...view, user: userEvent.setup() };
}

describe('项目详情的收款入口', () => {
  it('默认文件，钱条记一笔切换收款并展开表单，取消后可再次展开', async () => {
    const { user } = mount();
    const files = await screen.findByRole('tab', { name: '文件 0' });
    expect(files.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('textbox', { name: '金额（元）' })).toBeNull();
    await user.click(within(screen.getByLabelText('项目金额汇总')).getByRole('button', { name: '记一笔' }));
    expect(screen.getByRole('tab', { name: '收款 0' }).getAttribute('aria-selected')).toBe('true');
    expect((await screen.findByRole('textbox', { name: '金额（元）' }) as HTMLInputElement).value).toBe('123.45');
    await user.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('textbox', { name: '金额（元）' })).toBeNull());
    await user.click(within(screen.getByLabelText('项目金额汇总')).getByRole('button', { name: '记一笔' }));
    expect(await screen.findByRole('textbox', { name: '金额（元）' })).toBeTruthy();
  });
  it('带payment参数打开或给已打开项目追加payment时均定位收款表单', async () => {
    act(() => useNav.getState().navigate('projects', { projectId, payment: true }));
    const view = mount(true);
    expect((await screen.findByRole('tab', { name: '收款 0' })).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByRole('textbox', { name: '金额（元）' })).toBeTruthy();
    await view.user.click(screen.getByRole('tab', { name: '文件 0' }));
    view.rerender(<QueryClientProvider client={queryClient}><ProjectDetail projectId={projectId} initialPayment={false} /></QueryClientProvider>);
    view.rerender(<QueryClientProvider client={queryClient}><ProjectDetail projectId={projectId} initialPayment /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('tab', { name: '收款 0' }).getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByRole('textbox', { name: '金额（元）' })).toBeTruthy();
  });
});
