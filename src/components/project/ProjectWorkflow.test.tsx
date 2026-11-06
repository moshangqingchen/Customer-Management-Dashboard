import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import type { Project } from '../../api/types';
import { useUI } from '../../stores/ui';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectDetail } from './ProjectDetail';
import { ProjectDueDate, ProjectProperties } from './ProjectProperties';

let query: QueryClient; let project: Project;
beforeEach(async () => {
  reset(); useUI.getState().setNewProjectOpen(false);
  query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const client = await mockApi.clients.create({ name: '复购客户' });
  const tag = await mockApi.tags.create('复购', 'blue');
  project = await mockApi.projects.create({ clientId: client.id, title: '旧海报', brief: '交付竖版海报和源文件', sourcePlatform: '微信', sourceOrderNo: '旧订单号', priceCents: 128000, costCents: 20000, startDate: '2026-01-01', dueDate: '2026-01-15', tagIds: [tag.id] });
  await mockApi.payments.add({ projectId: project.id, amountCents: 10000, paidAt: '2026-01-01' });
});
afterEach(() => { query.clear(); useUI.getState().setNewProjectOpen(false); vi.restoreAllMocks(); });

describe('项目新单与日期校验', () => {
  it('重复打开保留已编辑的复购草稿，保存并继续后切换为空白新单', async () => {
    useUI.getState().startProjectFrom(project);
    render(<QueryClientProvider client={query}><NewProjectDialog /></QueryClientProvider>);
    const dialog = await screen.findByRole('dialog', { name: '按此项目新建' });
    const title = within(dialog).getByRole('textbox', { name: /项目名称/ });
    const brief = within(dialog).getByRole('textbox', { name: '新项目需求说明' });
    fireEvent.change(title, { target: { value: '已经编辑的新订单' } });
    fireEvent.change(brief, { target: { value: '本次新需求' } });
    act(() => useUI.getState().setNewProjectOpen(true));
    expect(title).toHaveProperty('value', '已经编辑的新订单');
    expect(brief).toHaveProperty('value', '本次新需求');
    fireEvent.keyDown(title, { key: 'Enter', ctrlKey: true });
    await screen.findByRole('dialog', { name: '新建项目' });
    expect(title).toHaveProperty('value', '');
    expect(within(screen.getByRole('group', { name: '来源平台' })).getByRole('combobox').textContent).toContain('选择来源平台');
    const created = (await mockApi.projects.list()).find(value => value.title === '已经编辑的新订单');
    expect(created).toMatchObject({ clientId: project.clientId, brief: '本次新需求' });
    expect(screen.queryByText(/参考「旧海报」/)).toBeNull();
  });
  it('按此项目新建先展示可编辑草稿，确认后复用需求但不沿用旧订单、日期、成本和流水', async () => {
    const count = (await mockApi.projects.list()).length; const user = userEvent.setup();
    render(<QueryClientProvider client={query}><ProjectDetail projectId={project.id} /><NewProjectDialog /></QueryClientProvider>);
    await user.click(await screen.findByRole('button', { name: '项目更多操作' }));
    await user.click(await screen.findByRole('menuitem', { name: '按此项目新建' }));
    const dialog = await screen.findByRole('dialog', { name: '按此项目新建' });
    expect(await mockApi.projects.list()).toHaveLength(count);
    expect((within(dialog).getByRole('textbox', { name: '新项目需求说明' }) as HTMLTextAreaElement).value).toBe(project.brief);
    expect((within(dialog).getByLabelText('新项目开始日期') as HTMLInputElement).value).toBe('');
    expect((within(dialog).getByRole('textbox', { name: '新项目平台订单号' }) as HTMLInputElement).value).toBe('');
    expect(within(dialog).getByRole('button', { name: '选择日期' }).textContent).toContain('无截止日');
    await user.click(within(dialog).getByRole('button', { name: '创建项目' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const created = (await mockApi.projects.list()).find(value => value.title === '旧海报（新单）');
    expect(created).toMatchObject({ clientId: project.clientId, brief: project.brief, sourcePlatform: project.sourcePlatform, priceCents: project.priceCents, tagIds: project.tagIds, sourceOrderNo: '', startDate: null, dueDate: null, receivedCents: 0, costCents: 0, fileCount: 0, status: 'active' });
    expect((await mockApi.projects.get(project.id)).sourceOrderNo).toBe('旧订单号');
  });
  it('取消复购草稿不创建记录，再次普通新建不残留模板', async () => {
    const count = (await mockApi.projects.list()).length; const user = userEvent.setup();
    useUI.getState().startProjectFrom(project);
    render(<QueryClientProvider client={query}><NewProjectDialog /></QueryClientProvider>);
    await user.click(await screen.findByRole('button', { name: '取消' }));
    expect(await mockApi.projects.list()).toHaveLength(count);
    expect(useUI.getState().newProjectTemplate).toBeNull();
  });
  it('新建项目拒绝截止早于开始', async () => {
    const create = vi.spyOn(mockApi.projects, 'create'); const user = userEvent.setup();
    useUI.getState().startProjectFrom(project);
    render(<QueryClientProvider client={query}><NewProjectDialog /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText('新项目开始日期'), { target: { value: '2027-01-01' } });
    await user.click(screen.getByRole('button', { name: '选择日期' }));
    fireEvent.change(screen.getByLabelText('自定义日期'), { target: { value: '2026-12-31' } });
    await user.click(screen.getByRole('button', { name: '创建项目' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '截止日不能早于开始日期，请调整项目日期。');
    expect(create).not.toHaveBeenCalled();
  });
  it('详情两端日期都校验，非法修改不送往后端', async () => {
    const update = vi.spyOn(mockApi.projects, 'update'); const error = vi.spyOn(toast, 'error'); const user = userEvent.setup();
    render(<QueryClientProvider client={query}><ProjectDueDate project={project} /><ProjectProperties project={project} /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: '项目截止日期' }));
    let field = screen.getByLabelText('项目截止日期');
    fireEvent.change(field, { target: { value: '2025-12-31' } }); fireEvent.blur(field);
    await waitFor(() => expect(error).toHaveBeenCalledWith('截止日不能早于开始日期，请调整项目日期。'));
    await user.click(screen.getByRole('button', { name: '项目开始日期' }));
    field = screen.getByLabelText('项目开始日期');
    fireEvent.change(field, { target: { value: '2026-01-20' } }); fireEvent.blur(field);
    await waitFor(() => expect(error).toHaveBeenCalledTimes(2));
    expect(update).not.toHaveBeenCalled();
  });
});
