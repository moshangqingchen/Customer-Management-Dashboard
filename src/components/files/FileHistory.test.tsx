import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addBrowserFiles, mockApi as api } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { FileVersionDialog } from './FileVersionDialog';
import { FileRecyclePanel } from './FileRecyclePanel';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
let queryClient: QueryClient;
beforeEach(async () => {
  reset(); await api.library.setRoot('D:/客户工作台');
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { queryClient.clear(); vi.restoreAllMocks(); });
const wrap = (children: React.ReactNode) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
async function fixture() {
  const client = await api.clients.create({ name: '版本界面客户' });
  const target = { clientId: client.id };
  const added = await addBrowserFiles(target, [{ name: '设计.psd', size: 100 }]);
  return { target, file: added.added[0] };
}
describe('文件版本与回收界面', () => {
  it('保存备注快照、定位归档，并确认保留当前内容后恢复版本', async () => {
    const { file } = await fixture(); const user = userEvent.setup();
    const reveal = vi.spyOn(api.files, 'reveal').mockResolvedValue();
    const restore = vi.spyOn(api.fileHistory, 'restore');
    render(wrap(<FileVersionDialog file={file} onClose={() => undefined} />));
    expect(await screen.findByText('还没有保存的历史版本。')).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: '当前文件版本备注' }), '客户确认稿');
    await user.click(screen.getByRole('button', { name: '保存当前版本' }));
    expect(await screen.findByText('客户确认稿')).toBeTruthy();
    const [version] = await api.fileHistory.list(file.path);
    await user.click(screen.getByRole('button', { name: '定位' }));
    await waitFor(() => expect(reveal).toHaveBeenCalledWith(version.snapshotPath));
    await user.click(screen.getByRole('button', { name: '恢复此版本' }));
    expect(restore).not.toHaveBeenCalled();
    const confirm = screen.getByRole('dialog', { name: '恢复这个文件版本？' });
    await user.click(within(confirm).getByRole('button', { name: '保留当前版本并恢复' }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith(version.id));
    await waitFor(async () => expect(await api.fileHistory.list(file.path)).toHaveLength(2));
  });
  it('读取版本失败显示错误，取消本地文件选择保留备注与现有版本', async () => {
    const { file } = await fixture(); const user = userEvent.setup();
    const list = vi.spyOn(api.fileHistory, 'list').mockRejectedValueOnce(new Error('文件库无法读取'));
    const pick = vi.spyOn(api.fileHistory, 'pickReplace').mockResolvedValue(null);
    render(wrap(<FileVersionDialog file={file} onClose={() => undefined} />));
    expect((await screen.findByRole('alert')).textContent).toContain('文件库无法读取');
    expect(screen.queryByText('还没有保存的历史版本。')).toBeNull();
    await user.click(screen.getByRole('button', { name: '重试读取版本' }));
    expect(await screen.findByText('还没有保存的历史版本。')).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: '当前文件版本备注' }), '保留输入');
    await user.click(screen.getByRole('button', { name: '上传新版本' }));
    await waitFor(() => expect(pick).toHaveBeenCalledWith(file.path, '保留输入'));
    expect((screen.getByRole('textbox', { name: '当前文件版本备注' }) as HTMLInputElement).value).toBe('保留输入');
    expect(list).toHaveBeenCalled();
  });
  it('搜索回收文件并恢复，同名自动编号且刷新后不再显示', async () => {
    const { target, file } = await fixture(); const user = userEvent.setup();
    await api.files.trash(file.path); await addBrowserFiles(target, [{ name: file.name, size: 200 }]);
    render(wrap(<FileRecyclePanel />));
    expect(await screen.findByText(file.name)).toBeTruthy();
    const search = screen.getByRole('textbox', { name: '搜索回收文件' });
    await user.type(search, '找不到');
    expect(screen.getByText('没有匹配的回收文件')).toBeTruthy();
    await user.clear(search);
    await user.click(screen.getByRole('button', { name: '恢复文件' }));
    expect(await screen.findByText('文件回收站是空的')).toBeTruthy();
    const files = (await api.files.list(target)).files;
    expect(files.find(item => item.name === file.name)?.sizeBytes).toBe(200);
    expect(files.find(item => item.name === '设计 (2).psd')?.sizeBytes).toBe(100);
  });
});
