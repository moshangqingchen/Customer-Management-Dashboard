import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addBrowserFiles, mockApi } from '../../api/mock';
import type { FileEntry } from '../../api/types';
import { reset } from '../../api/mock/store';
import { FilesArea } from './FilesArea';
import { FileBrowser } from './FileBrowser';
import { groupFiles } from '../../lib/files';

let queryClient: QueryClient;
const originals = { scrollIntoView: Element.prototype.scrollIntoView, hasPointerCapture: Element.prototype.hasPointerCapture, setPointerCapture: Element.prototype.setPointerCapture, releasePointerCapture: Element.prototype.releasePointerCapture };
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = () => false; Element.prototype.setPointerCapture = () => undefined; Element.prototype.releasePointerCapture = () => undefined;
});
afterEach(() => { queryClient.clear(); vi.restoreAllMocks(); Object.assign(Element.prototype, originals); });
const wrap = (children: React.ReactNode) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

describe('详情文件查找', () => {
  it.each([true, false])('折叠中间组后 Shift 连选和预览跳过隐藏文件，展开不恢复旧选择：项目分组 %s', async projectView => {
    const client = await mockApi.clients.create({ name: '折叠范围客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '折叠范围项目' });
    const files: FileEntry[] = [];
    for (const folder of ['A', 'B', 'C']) {
      const result = await addBrowserFiles({ projectId: project.id }, [{ name: `${folder}.pdf`, size: 100 }], folder);
      files.push(result.added[0]);
    }
    const copy = vi.spyOn(mockApi.files, 'copyToClipboard').mockResolvedValue();
    const user = userEvent.setup();
    render(wrap(<FileBrowser files={files} groups={groupFiles(files)} projectView={projectView} view="list" menu={() => []} />));
    await user.click(screen.getByRole('button', { name: '打开文件：B.pdf' }));
    await user.click(screen.getByRole('button', { name: '收起文件夹：B' }));
    expect(screen.queryByRole('region', { name: '文件选择操作' })).toBeNull();
    const first = screen.getByRole('button', { name: '打开文件：A.pdf' });
    const last = screen.getByRole('button', { name: '打开文件：C.pdf' });
    fireEvent.click(first); fireEvent.click(last, { shiftKey: true });
    await user.click(screen.getByRole('button', { name: projectView ? '复制选中的 2 个文件' : '复制 2 个文件' }));
    await waitFor(() => expect(copy).toHaveBeenCalledExactlyOnceWith([files[0].path, files[2].path]));
    first.focus(); await user.keyboard(' '); await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('dialog', { name: 'C.pdf' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: '展开文件夹：B' }));
    expect(screen.getByRole('button', { name: '打开文件：B.pdf' }).getAttribute('aria-pressed')).toBe('false');
  });
  it('客户资料、项目与目录搜索可组合，空结果仍能清除筛选', async () => {
    const client = await mockApi.clients.create({ name: '查找客户' });
    const first = await mockApi.projects.create({ clientId: client.id, title: '开业海报' });
    const second = await mockApi.projects.create({ clientId: client.id, title: '品牌手册' });
    await addBrowserFiles({ clientId: client.id }, [{ name: '客户logo.png', size: 100 }], '品牌资料');
    await addBrowserFiles({ projectId: first.id }, [{ name: '海报.ai', size: 100 }], '交付成品/源文件');
    await addBrowserFiles({ projectId: second.id }, [{ name: '品牌.pdf', size: 100 }], '交付成品');
    const user = userEvent.setup();
    render(wrap(<FilesArea target={{ clientId: client.id }} includeProjects />));
    expect(await screen.findByText('显示 3 / 3 个文件')).toBeTruthy();
    await user.click(screen.getByRole('combobox', { name: '筛选文件归属' }));
    await user.click(await screen.findByRole('option', { name: '开业海报' }));
    await user.type(screen.getByRole('textbox', { name: '搜索文件名或目录' }), '交付成品/源文件');
    expect(screen.getByText('显示 1 / 3 个文件')).toBeTruthy();
    expect(screen.getByRole('button', { name: '打开文件：海报.ai' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '打开文件：客户logo.png' })).toBeNull();
    await user.click(screen.getByRole('combobox', { name: '筛选文件归属' }));
    await user.click(await screen.findByRole('option', { name: '客户资料' }));
    expect(screen.getByText('显示 0 / 3 个文件')).toBeTruthy();
    expect(screen.getByText('没有符合条件的文件')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '清除文件筛选' }));
    expect(screen.getByText('显示 3 / 3 个文件')).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: '搜索文件名或目录' }), 'LOGO');
    expect(screen.getByRole('button', { name: '打开文件：客户logo.png' })).toBeTruthy();
    expect(screen.getByText('显示 1 / 3 个文件')).toBeTruthy();
  });

  it('折叠和搜索不改变整组交付复制的数量与文件范围', async () => {
    const client = await mockApi.clients.create({ name: '交付查找客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '交付查找项目' });
    const first = await addBrowserFiles({ projectId: project.id }, [{ name: '成品.pdf', size: 100 }], '交付成品');
    const second = await addBrowserFiles({ projectId: project.id }, [{ name: '源文件.ai', size: 100 }], '交付成品/源文件');
    await addBrowserFiles({ projectId: project.id }, [{ name: '参考.png', size: 100 }], '参考资料');
    const copy = vi.spyOn(mockApi.files, 'copyToClipboard').mockResolvedValue();
    const user = userEvent.setup();
    render(wrap(<FilesArea target={{ projectId: project.id }} />));
    await user.click(await screen.findByRole('button', { name: '收起文件夹：交付成品' }));
    expect(screen.getByRole('button', { name: '展开文件夹：交付成品' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: '打开文件：成品.pdf' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '展开文件夹：交付成品' }));
    await user.type(screen.getByRole('textbox', { name: '搜索文件名或目录' }), '成品.pdf');
    expect(screen.getByText('显示 1 / 3 个文件')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '打开文件：源文件.ai' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '复制全部 2 个交付文件' }));
    await waitFor(() => expect(copy).toHaveBeenCalledExactlyOnceWith([first.added[0].path, second.added[0].path]));
  });

  it('切换客户清空上个客户的文件筛选', async () => {
    const first = await mockApi.clients.create({ name: '第一个客户' });
    const second = await mockApi.clients.create({ name: '第二个客户' });
    await addBrowserFiles({ clientId: first.id }, [{ name: '甲资料.txt', size: 100 }]);
    await addBrowserFiles({ clientId: second.id }, [{ name: '乙资料.txt', size: 100 }]);
    const user = userEvent.setup();
    const { rerender } = render(wrap(<FilesArea target={{ clientId: first.id }} includeProjects />));
    await screen.findByText('甲资料.txt');
    await user.type(screen.getByRole('textbox', { name: '搜索文件名或目录' }), '甲');
    rerender(wrap(<FilesArea target={{ clientId: second.id }} includeProjects />));
    expect(await screen.findByText('乙资料.txt')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: '搜索文件名或目录' }) as HTMLInputElement).value).toBe('');
  });
});
