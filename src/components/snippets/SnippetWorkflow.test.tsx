import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { SnippetsPage } from '../../pages/SnippetsPage';
import { SnippetEditor } from './SnippetEditor';
import { SnippetPicker } from './SnippetPicker';

let q: QueryClient;
beforeEach(() => {
  reset(); q = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  HTMLElement.prototype.setPointerCapture = vi.fn(); HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { q.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('话术工作流', () => {
  it('详情话术按分组搜索、填变量复制、记录使用并还原焦点', async () => {
    const snippet = await mockApi.snippets.create({ groupId: 'group-3', title: '变量催款', body: '{客户}您好，{项目}还待收{待收}。\n感谢合作' });
    let finishCopy: () => void = () => undefined;
    const copying = new Promise<void>(resolve => { finishCopy = resolve; });
    const user = userEvent.setup(); const write = vi.spyOn(navigator.clipboard, 'writeText').mockReturnValue(copying); const notify = vi.spyOn(toast, 'success');
    render(<QueryClientProvider client={q}><SnippetPicker context={{ clientName: '林女士', projectTitle: '菜单设计', outstandingCents: 123400 }} /></QueryClientProvider>);
    const trigger = screen.getByRole('button', { name: '话术' }); await user.click(trigger);
    await user.type(await screen.findByRole('textbox', { name: '搜索可用话术' }), '变量催款');
    const choice = await screen.findByRole('button', { name: '使用话术：变量催款' });
    await user.click(choice); fireEvent.click(choice);
    expect(write).toHaveBeenCalledWith('林女士您好，菜单设计还待收¥1,234。\n感谢合作');
    expect(write).toHaveBeenCalledTimes(1); finishCopy();
    await waitFor(() => expect(notify).toHaveBeenCalledWith('已复制：林女士您好，菜单设计还待收¥1,234。'));
    await waitFor(async () => expect((await mockApi.snippets.list()).find(item => item.id === snippet.id)?.useCount).toBe(1));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it('编辑器在选中内容处插入变量并将光标放在变量后面', async () => {
    const user = userEvent.setup(); const groups = await mockApi.snippetGroups.list();
    render(<QueryClientProvider client={q}><SnippetEditor groups={groups} defaultGroupId={groups[0].id} onClose={() => undefined} /></QueryClientProvider>);
    const textbox = screen.getByRole('textbox', { name: '话术内容' }) as HTMLTextAreaElement;
    fireEvent.change(textbox, { target: { value: '您好，客户，感谢合作' } });
    textbox.focus(); textbox.setSelectionRange(3, 5); fireEvent.select(textbox);
    await user.click(screen.getByRole('button', { name: '插入变量：客户' }));
    await waitFor(() => { expect(textbox.value).toBe('您好，{客户}，感谢合作'); expect(textbox.selectionStart).toBe(7); });
  });
  it('话术页保留未填变量并用对应文案提示', async () => {
    await mockApi.snippets.create({ groupId: 'group-1', title: '变量测试', body: '{客户}您好' });
    const user = userEvent.setup(); const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(); const notify = vi.spyOn(toast, 'success');
    render(<QueryClientProvider client={q}><SnippetsPage /></QueryClientProvider>);
    const card = await screen.findByRole('button', { name: '复制话术：变量测试' }); await user.click(card);
    expect(write).toHaveBeenCalledWith('{客户}您好'); expect(notify).toHaveBeenCalledWith('已复制（含未填写的变量）');
    expect(within(card).getByText('变量测试')).toBeTruthy();
  });
});
