import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { ProjectDueDate, ProjectProperties } from './ProjectProperties';

let query: QueryClient;
beforeEach(() => {
  reset();
  query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { query.clear(); vi.restoreAllMocks(); });

describe('项目日期的共享保存状态', () => {
  it('延迟保存时锁住同项目两端但不锁其他项目，保存后按最新另一端再次校验', async () => {
    const client = await mockApi.clients.create({ name: '日期并发客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '日期并发项目', startDate: '2026-01-01', dueDate: '2026-01-15' });
    const other = await mockApi.projects.create({ clientId: client.id, title: '另一个项目', startDate: '2026-02-01', dueDate: '2026-02-15' });
    const originalUpdate = mockApi.projects.update.bind(mockApi.projects);
    let release: () => void = () => undefined;
    const delayed = new Promise<void>(resolve => { release = resolve; });
    const update = vi.spyOn(mockApi.projects, 'update').mockImplementationOnce(async (id, patch) => {
      await delayed;
      return originalUpdate(id, patch);
    });
    const error = vi.spyOn(toast, 'error');
    const user = userEvent.setup();
    render(<QueryClientProvider client={query}>
      <div data-testid="current-dates"><ProjectDueDate project={project} /><ProjectProperties project={project} /></div>
      <div data-testid="other-dates"><ProjectDueDate project={other} /></div>
    </QueryClientProvider>);
    const dueButtons = screen.getAllByRole('button', { name: '项目截止日期' });
    await user.click(dueButtons[0]);
    const due = screen.getByLabelText('项目截止日期', { selector: 'input' });
    fireEvent.change(due, { target: { value: '2026-01-05' } }); fireEvent.blur(due);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect((screen.getByRole('button', { name: '项目开始日期' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByRole('button', { name: '项目截止日期' })[0] as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByRole('button', { name: '项目截止日期' })[1] as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { release(); await delayed; });
    await waitFor(() => expect((screen.getByRole('button', { name: '项目开始日期' }) as HTMLButtonElement).disabled).toBe(false));
    // The component deliberately still receives the old project snapshot. Validation must reread the project.
    await user.click(screen.getByRole('button', { name: '项目开始日期' }));
    const start = screen.getByLabelText('项目开始日期', { selector: 'input' });
    fireEvent.change(start, { target: { value: '2026-01-10' } }); fireEvent.blur(start);
    await waitFor(() => expect(error).toHaveBeenCalledWith('截止日不能早于开始日期，请调整项目日期。'));
    expect(update).toHaveBeenCalledTimes(1);
    expect(await mockApi.projects.get(project.id)).toMatchObject({ startDate: '2026-01-01', dueDate: '2026-01-05' });
  });
});
