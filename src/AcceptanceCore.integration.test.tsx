import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { App } from './App';
import { mockApi } from './api/mock';
import { reset } from './api/mock/store';
import { dateOffset } from './lib/dates';
import { useNav } from './stores/nav';
import { useUI } from './stores/ui';
const tokens = readFileSync('src/styles/tokens.css', 'utf8');

let query: QueryClient;
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  useNav.setState({ entries: [{ page: 'today', params: {} }], index: 0 });
  useUI.setState({ theme: 'system', sidebarCollapsed: false, tagsCollapsed: false, commandOpen: false, newClientOpen: false, newProjectOpen: false });
  vi.stubGlobal('matchMedia', vi.fn((value: string) => ({ matches: value.includes('prefers-reduced-motion'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 640, 180));
});
afterEach(() => { query.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function mount() {
  render(<QueryClientProvider client={query}><App /></QueryClientProvider>);
  await screen.findByRole('heading', { name: '今日' });
  return userEvent.setup();
}

describe('最终验收核心展示', () => {
  it('逾期项目出现在今日需要关注和侧栏计数中，已完成与已取消不计入', async () => {
    const client = await mockApi.clients.create({ name: '逾期验收客户' });
    for (const [title, status] of [['验收进行中逾期', 'active'], ['验收完成逾期', 'done'], ['验收取消逾期', 'cancelled']] as const) {
      await mockApi.projects.create({ clientId: client.id, title, status, dueDate: dateOffset(-2) });
    }
    await mount();
    const section = screen.getByRole('heading', { name: /^需要关注/ }).closest('section');
    if (!section) throw new Error('未找到需要关注区');
    expect(within(section).getByRole('button', { name: '打开项目：验收进行中逾期' }).textContent).toContain('逾期 2 天');
    expect(within(section).queryByRole('button', { name: '打开项目：验收完成逾期' })).toBeNull();
    expect(within(section).queryByRole('button', { name: '打开项目：验收取消逾期' })).toBeNull();
    const navigation = within(screen.getByRole('complementary', { name: '主导航' }));
    expect(navigation.getByRole('button', { name: '逾期 4' })).toBeTruthy();
    const seedOverdue = (await mockApi.projects.list()).filter(value => ['project-1', 'project-2', 'project-3'].includes(value.id));
    for (const project of seedOverdue) expect(within(section).getByRole('button', { name: `打开项目：${project.title}` })).toBeTruthy();
  });

  it('浅深主题按钮更新文档主题、选择状态及持久化设置', async () => {
    const user = await mount();
    for (const theme of ['dark', 'light'] as const) {
      const label = theme === 'dark' ? '切换深色主题' : '切换浅色主题';
      await user.click(screen.getByRole('button', { name: label }));
      await waitFor(async () => expect((await mockApi.settings.get()).theme).toBe(theme));
      expect(document.documentElement.dataset.theme).toBe(theme);
      expect(document.documentElement.style.colorScheme).toBe(theme);
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
    }
  });

  it.each(['light', 'dark'])('%s主题正文与次要文字在主要表面上达到4.5:1对比度', theme => {
    const rule = theme === 'light' ? tokens.split('[data-theme="dark"]')[0] : tokens.split('[data-theme="dark"]')[1];
    const color = (name: string) => {
      const value = rule.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`))?.[1];
      if (!value) throw new Error(`缺少颜色 token ${name}`);
      const channels = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
        .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    };
    for (const foreground of ['text', 'text-2']) for (const background of ['bg-app', 'bg-sidebar', 'bg-surface', 'bg-subtle', 'bg-hover', 'bg-active']) {
      const levels = [color(foreground), color(background)].sort((a, b) => a - b);
      expect((levels[1] + .05) / (levels[0] + .05), `${foreground} / ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
