import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, addBrowserFiles } from '../api/mock';
import { reset } from '../api/mock/store';
import { today } from '../lib/dates';
import { useActivities, useAllPayments, useClient, useClients, useDeleteClient, useDeleteProject, useFiles, usePayments, useProject, useProjects, useRenameFile, useRestoreTrash, useTrash } from './queries';

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));
let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
beforeEach(async () => {
  reset();
  await mockApi.library.setRoot('D:/客户工作台');
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
});
afterEach(() => { queryClient.clear(); vi.restoreAllMocks(); });

async function createFixture() {
  const client = await mockApi.clients.create({ name: '删除回归客户' });
  const project = await mockApi.projects.create({ clientId: client.id, title: '删除回归海报', priceCents: 10000 });
  await mockApi.payments.add({ projectId: project.id, amountCents: 4000, paidAt: today() });
  const { added } = await addBrowserFiles({ projectId: project.id }, [{ name: '封面.png', size: 100 }]);
  return { client, project, file: added[0] };
}

describe('删除时保留已打开详情，列表刷新与撤销恢复', () => {
  it('删除项目不重新读取已删除的详情、收款与文件，客户统计随列表更新，撤销后重新可用', async () => {
    const { client, project, file } = await createFixture();
    const getProject = vi.spyOn(mockApi.projects, 'get'); const getFiles = vi.spyOn(mockApi.files, 'list'); const getPayments = vi.spyOn(mockApi.payments, 'list');
    const { result } = renderHook(() => ({
      project: useProject(project.id), files: useFiles({ projectId: project.id }), payments: usePayments(project.id),
      client: useClient(client.id), clients: useClients(), projects: useProjects(), allPayments: useAllPayments(),
      activities: useActivities({ clientId: client.id }), trash: useTrash(), remove: useDeleteProject(), restore: useRestoreTrash(),
    }), { wrapper });
    await waitFor(() => expect([result.current.project, result.current.files, result.current.payments, result.current.client, result.current.clients, result.current.projects, result.current.allPayments, result.current.activities, result.current.trash].every(query => query.isSuccess)).toBe(true));
    expect(result.current.client.data?.outstandingCents).toBe(6000);
    const before = { projects: getProject.mock.calls.length, files: getFiles.mock.calls.length, payments: getPayments.mock.calls.length };
    await act(async () => { await result.current.remove.mutateAsync(project.id); });
    await waitFor(() => expect(result.current.projects.data?.some(value => value.id === project.id)).toBe(false));
    expect(getProject).toHaveBeenCalledTimes(before.projects); expect(getFiles).toHaveBeenCalledTimes(before.files); expect(getPayments).toHaveBeenCalledTimes(before.payments);
    expect([result.current.project, result.current.files, result.current.payments].every(query => !query.isError)).toBe(true);
    expect(result.current.client.data).toMatchObject({ projectCount: 0, receivedCents: 0, outstandingCents: 0 });
    expect(result.current.clients.data?.find(value => value.id === client.id)?.projectCount).toBe(0);
    expect(result.current.allPayments.data?.some(value => value.projectId === project.id)).toBe(false);
    expect(result.current.activities.data?.some(value => value.projectId === project.id)).toBe(false);
    expect(result.current.trash.data?.some(value => value.id === project.id)).toBe(true);
    await act(async () => { await result.current.restore.mutateAsync({ type: 'project', id: project.id }); });
    await waitFor(() => expect(result.current.projects.data?.some(value => value.id === project.id)).toBe(true));
    expect(getProject.mock.calls.length).toBeGreaterThan(before.projects); expect(getFiles.mock.calls.length).toBeGreaterThan(before.files);
    expect(result.current.project.data?.fileCount).toBe(1); expect(result.current.files.data?.files[0].path).toBe(file.path);
    expect(result.current.client.data).toMatchObject({ projectCount: 1, receivedCents: 4000, outstandingCents: 6000 });
    expect(result.current.allPayments.data?.find(value => value.projectId === project.id)?.amountCents).toBe(4000);
    expect(result.current.trash.data?.some(value => value.id === project.id)).toBe(false);
  });

  it('删除客户不重新读取客户及子项目详情/文件，列表移除关联数据，撤销后一起恢复', async () => {
    const { client, project, file } = await createFixture();
    const second = await mockApi.projects.create({ clientId: client.id, title: '同客户第二项目', priceCents: 20000 });
    const getClient = vi.spyOn(mockApi.clients, 'get'); const getProject = vi.spyOn(mockApi.projects, 'get'); const getFiles = vi.spyOn(mockApi.files, 'list');
    const { result } = renderHook(() => ({
      client: useClient(client.id), project: useProject(project.id), second: useProject(second.id),
      files: useFiles({ clientId: client.id }, true), projectFiles: useFiles({ projectId: project.id }),
      clients: useClients(), projects: useProjects(), allPayments: useAllPayments(), trash: useTrash(), remove: useDeleteClient(), restore: useRestoreTrash(),
    }), { wrapper });
    await waitFor(() => expect([result.current.client, result.current.project, result.current.second, result.current.files, result.current.projectFiles, result.current.clients, result.current.projects, result.current.allPayments, result.current.trash].every(query => query.isSuccess)).toBe(true));
    const before = { clients: getClient.mock.calls.length, projects: getProject.mock.calls.length, files: getFiles.mock.calls.length };
    await act(async () => { await result.current.remove.mutateAsync(client.id); });
    await waitFor(() => expect(result.current.clients.data?.some(value => value.id === client.id)).toBe(false));
    expect(getClient).toHaveBeenCalledTimes(before.clients); expect(getProject).toHaveBeenCalledTimes(before.projects); expect(getFiles).toHaveBeenCalledTimes(before.files);
    expect([result.current.client, result.current.project, result.current.second, result.current.files, result.current.projectFiles].every(query => !query.isError)).toBe(true);
    expect(result.current.projects.data?.some(value => value.clientId === client.id)).toBe(false);
    expect(result.current.allPayments.data?.some(value => value.clientId === client.id)).toBe(false);
    expect(result.current.trash.data?.filter(value => [client.id, project.id, second.id].includes(value.id))).toHaveLength(3);
    await act(async () => { await result.current.restore.mutateAsync({ type: 'client', id: client.id }); });
    await waitFor(() => expect(result.current.clients.data?.find(value => value.id === client.id)?.projectCount).toBe(2));
    expect(getClient.mock.calls.length).toBeGreaterThan(before.clients); expect(getProject.mock.calls.length).toBeGreaterThan(before.projects); expect(getFiles.mock.calls.length).toBeGreaterThan(before.files);
    expect(result.current.client.data).toMatchObject({ projectCount: 2, receivedCents: 4000, outstandingCents: 26000 });
    expect(result.current.projects.data?.filter(value => value.clientId === client.id)).toHaveLength(2);
    expect(result.current.files.data?.files.some(value => value.path === file.path)).toBe(true);
    expect(result.current.allPayments.data?.some(value => value.clientId === client.id)).toBe(true);
    expect(result.current.trash.data?.some(value => value.id === client.id)).toBe(false);
  });
});

describe('文件改名刷新项目列表封面', () => {
  it('把封面图片改成源文件格式后，已打开详情与项目列表都重新派生 coverPath', async () => {
    const { project, file } = await createFixture();
    const { result } = renderHook(() => ({ project: useProject(project.id), projects: useProjects(), files: useFiles({ projectId: project.id }), rename: useRenameFile() }), { wrapper });
    await waitFor(() => expect(result.current.project.isSuccess && result.current.projects.isSuccess && result.current.files.isSuccess).toBe(true));
    expect(result.current.project.data?.coverPath).not.toBeNull();
    expect(result.current.projects.data?.find(value => value.id === project.id)?.coverPath).not.toBeNull();
    await act(async () => { await result.current.rename.mutateAsync({ path: file.path, newName: '封面.psd' }); });
    await waitFor(() => expect(result.current.projects.data?.find(value => value.id === project.id)?.coverPath).toContain('封面.psd'));
    expect(result.current.project.data?.coverPath).toContain('封面.psd');
    expect(result.current.files.data?.files[0].name).toBe('封面.psd');
    expect(result.current.project.data?.fileCount).toBe(1);
  });
});
