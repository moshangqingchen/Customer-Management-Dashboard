import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { ActivityTimeline } from './ActivityTimeline';

let query: QueryClient;
beforeEach(() => { reset(); query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); });
afterEach(() => query.clear());

describe('动态备注组件', () => {
  it('Ctrl+Enter新增与编辑备注，删除需确认，系统动态没有编辑入口', async () => {
    const client = await mockApi.clients.create({ name: '动态验收客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '动态验收单' });
    render(<QueryClientProvider client={query}><ActivityTimeline clientId={client.id} projectId={project.id} /></QueryClientProvider>);
    const user = userEvent.setup(); await screen.findByText('创建了项目');
    expect(screen.queryByRole('button', { name: '编辑备注' })).toBeNull();
    await user.type(screen.getByRole('textbox', { name: '添加动态备注' }), '电话确认：改用暖色。');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await screen.findByText('电话确认：改用暖色。');
    expect(screen.getByRole('heading', { name: '今天' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '编辑备注' }));
    const edit = screen.getByRole('textbox', { name: '编辑动态备注' });
    await user.clear(edit); await user.type(edit, '确认终稿，等待客户安排付款。');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await screen.findByText('确认终稿，等待客户安排付款。');
    expect((await mockApi.activities.list({ projectId: project.id })).find(value => value.kind === 'note')?.body).toBe('确认终稿，等待客户安排付款。');
    await user.click(screen.getByRole('button', { name: '删除备注' }));
    const dialog = await screen.findByRole('dialog', { name: '删除这条备注？' });
    expect((await mockApi.activities.list({ projectId: project.id })).filter(value => value.kind === 'note')).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(screen.queryByText('确认终稿，等待客户安排付款。')).toBeNull());
    expect(await mockApi.activities.list({ projectId: project.id })).toHaveLength(1);
    expect(screen.getByText('创建了项目')).toBeTruthy();
  });
});
