import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { ProjectBrief } from './ProjectBrief';

let query: QueryClient;
beforeEach(() => { reset(); query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); });
afterEach(() => { query.clear(); vi.restoreAllMocks(); });

describe('需求就地自动保存', () => {
  it('空需求可插入模板；已有内容需确认追加，取消不改变原文', async () => {
    const value = (await mockApi.projects.list())[0];
    await mockApi.projects.update(value.id, { brief: '' });
    const user = userEvent.setup();
    render(<QueryClientProvider client={query}><ProjectBrief projectId={value.id} value="" /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: '选择需求模板' }));
    await user.click(screen.getByRole('menuitem', { name: '海报设计' }));
    await waitFor(async () => expect((await mockApi.projects.get(value.id)).brief).toContain('尺寸与方向：'));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '项目需求说明' }) as HTMLTextAreaElement).disabled).toBe(false));
    const original = (await mockApi.projects.get(value.id)).brief;
    await user.click(screen.getByRole('button', { name: '选择需求模板' }));
    await user.click(screen.getByRole('menuitem', { name: '品牌设计' }));
    let dialog = await screen.findByRole('dialog', { name: '追加需求模板？' });
    await user.click(within(dialog).getByRole('button', { name: '取消' }));
    expect((await mockApi.projects.get(value.id)).brief).toBe(original);
    await user.click(screen.getByRole('button', { name: '选择需求模板' }));
    await user.click(screen.getByRole('menuitem', { name: '品牌设计' }));
    dialog = await screen.findByRole('dialog', { name: '追加需求模板？' });
    await user.click(within(dialog).getByRole('button', { name: '追加模板' }));
    await waitFor(async () => expect((await mockApi.projects.get(value.id)).brief).toContain('品牌名称与定位：'));
    expect((await mockApi.projects.get(value.id)).brief.startsWith(`${original}\n\n`)).toBe(true);
  });
  it('失焦自动保存，保存期间禁用，失败恢复上次保存内容', async () => {
    const value = (await mockApi.projects.list())[0];
    render(<QueryClientProvider client={query}><ProjectBrief projectId={value.id} value={value.brief} /></QueryClientProvider>);
    const input = screen.getByRole('textbox', { name: '项目需求说明' }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '新增交付：两版竖屏海报' } }); fireEvent.blur(input);
    await waitFor(async () => expect((await mockApi.projects.get(value.id)).brief).toBe('新增交付：两版竖屏海报'));
    await waitFor(() => expect(input.disabled).toBe(false));
    const update = vi.spyOn(mockApi.projects, 'update');
    let fail: (error: Error) => void = () => undefined;
    update.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    fireEvent.change(input, { target: { value: '本次保存应失败' } }); fireEvent.blur(input);
    await waitFor(() => expect(input.disabled).toBe(true));
    fail(new Error('验收：文件暂时只读'));
    await waitFor(() => expect(input.disabled).toBe(false));
    expect(input.value).toBe('新增交付：两版竖屏海报');
    expect((await mockApi.projects.get(value.id)).brief).toBe('新增交付：两版竖屏海报');
  });
});
