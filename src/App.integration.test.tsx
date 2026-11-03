import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { mockApi } from './api/mock';
import { reset } from './api/mock/store';
import { useNav } from './stores/nav';
import { useUI } from './stores/ui';

const clients: QueryClient[] = [];
const originalScrollIntoView = Element.prototype.scrollIntoView;
beforeEach(() => {
  reset();
  useNav.setState({ entries: [{ page: 'today', params: {} }], index: 0 });
  useUI.setState({ theme: 'system', sidebarCollapsed: false, tagsCollapsed: false, commandOpen: false, newClientOpen: false, newProjectOpen: false });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 640, 180));
});
afterEach(() => {
  clients.forEach(client => client.clear()); clients.length = 0;
  vi.unstubAllGlobals(); Element.prototype.scrollIntoView = originalScrollIntoView;
  vi.restoreAllMocks();
});
function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(queryClient);
  render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
  return userEvent.setup();
}
async function readyApp() {
  await mockApi.library.setRoot('D:/客户工作台');
  const user = renderApp();
  await screen.findByRole('heading', { name: '今日' });
  return user;
}

describe('基础工作台完整流程', () => {
  it('命令面板首次及再次打开都聚焦输入，Esc关闭后恢复到搜索按钮', async () => {
    const user = await readyApp();
    const opener = screen.getByRole('button', { name: '搜索与命令' });
    for (const _opening of [0, 1]) {
      await user.click(opener);
      const input = await screen.findByRole('combobox', { name: '搜索与命令' });
      await waitFor(() => expect(document.activeElement).toBe(input));
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog', { name: '搜索与命令' })).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(opener));
    }
  });

  it('首次选择文件库后进入工作台，页面快捷键和导航历史互通且无渲染错误', async () => {
    const errors = vi.spyOn(console, 'error');
    const user = renderApp();
    await user.click(await screen.findByRole('button', { name: '选择文件库位置' }));
    await screen.findByRole('heading', { name: '今日' });
    expect((await mockApi.library.status()).state).toBe('ready');
    const pages = ['项目', '客户', '收入', '文件', '话术'];
    for (const [index, page] of pages.entries()) {
      await user.keyboard(`{Control>}${index + 2}{/Control}`);
      expect(await screen.findByRole('heading', { name: page })).toBeTruthy();
    }
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(await screen.findByRole('heading', { name: '文件' })).toBeTruthy();
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(await screen.findByRole('heading', { name: '话术' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '设置' }));
    expect(await screen.findByRole('heading', { name: '设置' })).toBeTruthy();
    act(() => window.__mock.reset());
    await screen.findByRole('button', { name: '选择文件库位置' });
    expect(errors).not.toHaveBeenCalled();
  });

  it('客户支持保存并继续；项目可创建客户并回车保存，中文候选回车不提交', async () => {
    const user = await readyApp();
    await user.keyboard('{Control>}{Shift>}N{/Shift}{/Control}');
    const name = await screen.findByRole('textbox', { name: /客户名称/ });
    let dialog = screen.getByRole('dialog', { name: '新建客户' });
    await user.type(name, '青山工作室');
    fireEvent.keyDown(name, { key: 'Enter', ctrlKey: true, isComposing: true });
    expect(await mockApi.clients.list()).toHaveLength(14);
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(async () => expect(await mockApi.clients.list()).toHaveLength(15));
    await waitFor(() => expect((within(screen.getByRole('dialog')).getByRole('textbox', { name: /客户名称/ }) as HTMLInputElement).value).toBe(''));
    await user.keyboard('{Escape}');
    await user.keyboard('{Control>}n{/Control}');
    const title = await screen.findByRole('textbox', { name: /项目名称/ });
    dialog = screen.getByRole('dialog', { name: '新建项目' });
    await user.type(title, '海风夏日海报');
    await user.click(within(dialog).getByRole('combobox', { name: '选择客户' }));
    await user.type(screen.getByPlaceholderText('输入名称搜索…'), '海风咖啡');
    await user.keyboard('{Enter}');
    await waitFor(async () => expect(await mockApi.clients.list()).toHaveLength(16));
    expect(await mockApi.projects.list()).toHaveLength(32);
    await user.click(within(dialog).getByRole('button', { name: '创建项目' }));
    await screen.findByRole('heading', { name: '海风夏日海报' });
    expect(await mockApi.projects.list()).toHaveLength(33);
    expect(useUI.getState().newProjectOpen).toBe(false);
    expect(useNav.getState().entries.at(-1)?.params.projectId).toBeTruthy();
  }, 30_000);

  it('命令面板回车复制话术并保留换行，选择收款项目时表单随项目重置', async () => {
    const user = await readyApp();
    const snippet = (await mockApi.snippets.list())[0];
    const copy = vi.spyOn(navigator.clipboard, 'writeText');
    await user.keyboard('{Control>}k{/Control}');
    await user.type(await screen.findByRole('combobox', { name: '搜索与命令' }), snippet.title);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(copy).toHaveBeenCalledWith(snippet.body));
    await waitFor(() => expect(useUI.getState().commandOpen).toBe(false));
    const client = await mockApi.clients.create({ name: '验收客户' });
    const first = await mockApi.projects.create({ clientId: client.id, title: '第一单', priceCents: 10000 });
    const second = await mockApi.projects.create({ clientId: client.id, title: '第二单', priceCents: 26000 });
    act(() => useNav.getState().navigate('projects', { projectId: first.id, payment: true }));
    await screen.findByRole('heading', { name: '第一单' });
    expect((screen.getByRole('textbox', { name: '金额（元）' }) as HTMLInputElement).value).toBe('100');
    act(() => useNav.getState().navigate('projects', { projectId: second.id, payment: true }));
    await screen.findByRole('heading', { name: '第二单' });
    expect((screen.getByRole('textbox', { name: '金额（元）' }) as HTMLInputElement).value).toBe('260');
  });
});
