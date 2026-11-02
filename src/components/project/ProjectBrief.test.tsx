import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { ProjectBrief } from './ProjectBrief';

let query: QueryClient;
beforeEach(() => { reset(); query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); });
afterEach(() => { query.clear(); vi.restoreAllMocks(); });

describe('需求就地自动保存', () => {
  it('失焦自动保存，保存期间禁用，失败恢复上次保存内容', async () => {
    const value = (await mockApi.projects.list())[0];
    render(<QueryClientProvider client={query}><ProjectBrief projectId={value.id} value={value.brief} /></QueryClientProvider>);
    const input = screen.getByRole('textbox', { name: '项目需求说明' }) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '新增交付：两版竖屏海报' } }); fireEvent.blur(input);
    await waitFor(async () => expect((await mockApi.projects.get(value.id)).brief).toBe('新增交付：两版竖屏海报'));
    await screen.findByText('已自动保存');
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
