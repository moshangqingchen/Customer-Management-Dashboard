import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LibraryStatus } from '../../api/types';
import { queryKeys } from '../../hooks/queries';
import { useNav } from '../../stores/nav';
import { useUI } from '../../stores/ui';
import { Sidebar } from './Sidebar';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { isOverdue } from '../../lib/dates';

const clients: QueryClient[] = [];
beforeEach(() => {
  reset();
  useNav.setState({ entries: [{page: 'today', params: {}}], index: 0 });
  useUI.setState({ sidebarCollapsed: false, theme: 'light', settingsCategory: 'about' });
});
afterEach(() => { clients.forEach(client => client.clear()); clients.length = 0; vi.restoreAllMocks(); });
function show(state: LibraryStatus['state']) {
  const client = new QueryClient({defaultOptions:{queries:{staleTime: Infinity, retry:false}}}); clients.push(client);
  client.setQueryData(queryKeys.projects, []);
  client.setQueryData(queryKeys.library, {root:'D:/客户工作台', state, freeBytes:100, message: '请检查文件库位置'} satisfies LibraryStatus);
  render(<QueryClientProvider client={client}><Sidebar /></QueryClientProvider>);
}
it('文件库正常时不显示状态提示', () => {
  show('ready');
  expect(screen.queryByRole('button', {name:'文件库未就绪，打开设置'})).toBeNull();
  expect(screen.queryByText('文件库已连接')).toBeNull();
});
it.each(['missing','readOnly','notConfigured'] as const)('文件库%s时显示提示并进入文件库设置', async state => {
  show(state);
  await userEvent.setup().click(screen.getByRole('button', {name:'文件库未就绪，打开设置'}));
  expect(useNav.getState().entries.at(-1)?.page).toBe('settings');
  expect(useUI.getState().settingsCategory).toBe('library');
});
it('折叠侧栏以圆点保留徽标，提示中仍包含数量', async () => {
  const projects = await mockApi.projects.list();
  const overdue = projects.filter(project => isOverdue(project.dueDate, project.status)).length;
  const client = new QueryClient({defaultOptions:{queries:{staleTime: Infinity, retry:false}}}); clients.push(client);
  client.setQueryData(queryKeys.projects, projects);
  client.setQueryData(queryKeys.library, {root:'D:/客户工作台', state:'ready', freeBytes:100, message:''} satisfies LibraryStatus);
  useUI.setState({sidebarCollapsed:true});
  render(<QueryClientProvider client={client}><Sidebar /></QueryClientProvider>);
  const button = screen.getByRole('button', {name:'项目'});
  expect(button.title).toContain(`${overdue} 个逾期项目`);
  expect(button.querySelector(`[aria-label="${overdue} 个逾期项目"]`)?.textContent).toBe('');
});
