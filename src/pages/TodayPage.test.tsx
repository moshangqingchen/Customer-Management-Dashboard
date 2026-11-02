import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { mockApi } from '../api/mock';
import { reset, state } from '../api/mock/store';
import { useNav, type Page, type RouteParams } from '../stores/nav';
import { useUI } from '../stores/ui';

const clients: QueryClient[] = [];
const originalScrollIntoView = Element.prototype.scrollIntoView;
const originalHasPointerCapture = Element.prototype.hasPointerCapture;
const originalSetPointerCapture = Element.prototype.setPointerCapture;
const originalReleasePointerCapture = Element.prototype.releasePointerCapture;

beforeEach(() => {
  reset();
  useNav.setState({ entries: [{ page: 'today', params: {} }], index: 0 });
  useUI.setState({ theme: 'system', sidebarCollapsed: false, tagsCollapsed: false, commandOpen: false, newClientOpen: false, newProjectOpen: false });
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 640, 180));
});

afterEach(() => {
  clients.forEach(client => client.clear()); clients.length = 0;
  vi.unstubAllGlobals(); Element.prototype.scrollIntoView = originalScrollIntoView;
  Element.prototype.hasPointerCapture = originalHasPointerCapture;
  Element.prototype.setPointerCapture = originalSetPointerCapture;
  Element.prototype.releasePointerCapture = originalReleasePointerCapture;
  vi.restoreAllMocks();
});

async function readyApp() {
  await mockApi.library.setRoot('D:/客户工作台');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(queryClient);
  render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
  await screen.findByRole('heading', { name: '今日' });
  return userEvent.setup();
}

const statRoutes: [string, Page, RouteParams][] = [
  ['进行中', 'projects', { statuses: ['active'] }],
  ['本周到期', 'projects', { due: 'week' }],
  ['待收款', 'projects', { view: 'outstanding' }],
  ['本月收入', 'income', {}],
];

describe('今日工作台交互', () => {
  it.each(statRoutes)('点击%s统计卡打开对应页面和筛选', async (title, page, params) => {
    const user = await readyApp();
    const main = within(screen.getByRole('main'));
    await user.click(main.getByRole('button', { name: new RegExp(`^${title}\\s*[\\d¥]`) }));
    const nav = useNav.getState();
    expect(nav.entries[nav.index]).toEqual({ page, params });
    expect(await screen.findByRole('heading', { name: page === 'income' ? '收入' : '项目' })).toBeTruthy();
  });

  it('关注项目打开真实详情面板，并保留今日页面', async () => {
    const project = (await mockApi.projects.list()).find(value => value.id === 'project-1')!;
    const user = await readyApp();
    const main = within(screen.getByRole('main'));
    await user.click(main.getAllByRole('button', { name: `打开项目：${project.title}` })[0]);
    await screen.findByRole('heading', { name: project.title });
    const nav = useNav.getState();
    expect(nav.entries[nav.index]).toEqual({ page: 'today', params: { projectId: project.id } });
    expect(screen.getByRole('heading', { name: '今日' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '项目详情' })).toBeTruthy();
    expect(within(screen.getByRole('complementary', { name: '主导航' })).getByRole('button', { name: /^今日/ }).getAttribute('aria-current')).toBe('page');
  });

  it('行内更改状态通过原有 mutation 保存，并生成状态动态', async () => {
    const project = (await mockApi.projects.list()).find(value => value.id === 'project-1')!;
    const user = await readyApp();
    const status = screen.getByRole('combobox', { name: `${project.title}的状态` });
    await user.click(status);
    await user.click(await screen.findByRole('option', { name: '待确认' }));
    await waitFor(async () => expect((await mockApi.projects.get(project.id)).status).toBe('review'));
    await waitFor(() => expect(screen.getByRole('combobox', { name: `${project.title}的状态` }).textContent).toContain('待确认'));
    const activities = await mockApi.activities.list({ projectId: project.id });
    expect(activities.some(activity => activity.kind === 'status' && activity.meta.from === 'active' && activity.meta.to === 'review')).toBe(true);
    expect(useNav.getState().entries[useNav.getState().index].params.projectId).toBeUndefined();
  });

  it('待收款记一笔打开原收款表单，默认填入待收并能保存', async () => {
    const client = await mockApi.clients.create({ name: '今日收款客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '今日收款验收单', priceCents: 100000000 });
    const user = await readyApp();
    await user.click(screen.getByRole('button', { name: `为${project.title}记一笔收款` }));
    await screen.findByRole('heading', { name: project.title });
    expect(screen.getByRole('heading', { name: '记一笔收款' })).toBeTruthy();
    expect((screen.getByRole('textbox', { name: '金额（元）' }) as HTMLInputElement).value).toBe('1000000');
    const nav = useNav.getState();
    expect(nav.entries[nav.index]).toEqual({ page: 'today', params: { projectId: project.id, payment: true } });
    await user.click(screen.getByRole('button', { name: '记录收款' }));
    await waitFor(async () => expect((await mockApi.projects.get(project.id)).receivedCents).toBe(100000000));
    expect(await mockApi.payments.list(project.id)).toHaveLength(1);
  });

  it('没有项目时展示欢迎引导，并可创建第一位客户', async () => {
    state().projects = []; state().payments = []; state().activities = []; state().files = [];
    const user = await readyApp();
    expect(screen.getByRole('heading', { name: /欢迎来到客户工作台/ })).toBeTruthy();
    expect(screen.getByText('今天没有着急的事')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '新建第一个客户' }));
    const name = await screen.findByRole('textbox', { name: /客户名称/ });
    const dialog = screen.getByRole('dialog', { name: '新建客户' });
    await user.type(name, '第一位新客户');
    await user.click(within(dialog).getByRole('button', { name: '创建客户' }));
    await waitFor(async () => expect((await mockApi.clients.list()).some(client => client.name === '第一位新客户')).toBe(true));
    expect(useUI.getState().newClientOpen).toBe(false);
  });
});
