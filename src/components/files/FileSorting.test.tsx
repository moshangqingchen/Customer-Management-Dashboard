import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import type { FileEntry } from '../../api/types';
import { useUI } from '../../stores/ui';
import { FilesArea } from './FilesArea';

let query: QueryClient;
let projectId: string;
let entries: FileEntry[];
const original = { scrollIntoView: Element.prototype.scrollIntoView, hasPointerCapture: Element.prototype.hasPointerCapture, setPointerCapture: Element.prototype.setPointerCapture, releasePointerCapture: Element.prototype.releasePointerCapture };
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  useUI.getState().setDetailFileSort('modified-desc');
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined; Element.prototype.releasePointerCapture = () => undefined;
  query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const client = await mockApi.clients.create({ name: '排序客户' });
  projectId = (await mockApi.projects.create({ clientId: client.id, title: '排序项目' })).id;
  entries = ['10.png', '2.png', '1.png', '参考.png'].map((name, index) => ({ name, path: `D:/客户工作台/${name}`, relPath: name, ext: 'png', kind: 'image', sizeBytes: 100, modifiedAt: `2026-11-0${index + 1}T00:00:00Z`, folderGroup: index === 3 ? '参考资料' : '交付成品', clientId: client.id, projectId }));
  vi.spyOn(mockApi.files, 'list').mockResolvedValue({ files: entries, folder: 'D:/客户工作台/项目', folderMissing: false });
});
afterEach(() => { query.clear(); vi.restoreAllMocks(); Object.assign(Element.prototype, original); useUI.getState().setDetailFileSort('modified-desc'); });
const contents = () => <QueryClientProvider client={query}><FilesArea target={{ projectId }} /></QueryClientProvider>;
const displayed = () => screen.getAllByRole('button', { name: /^打开文件：/ }).map(button => button.getAttribute('aria-label')?.replace('打开文件：', ''));
async function selectSort(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('combobox', { name: '文件排序' }));
  await user.click(await screen.findByRole('option', { name: label }));
}
describe('文件排序交互', () => {
  it('四种排序在网格和列表一致，搜索和重新挂载保留选择', async () => {
    const user = userEvent.setup(); const mounted = render(contents());
    await screen.findByRole('button', { name: '打开文件：1.png' });
    const inDelivery = () => displayed().filter(name => name !== '参考.png');
    expect(inDelivery()).toEqual(['1.png', '2.png', '10.png']);
    await selectSort(user, '修改时间：最早优先'); expect(inDelivery()).toEqual(['10.png', '2.png', '1.png']);
    await selectSort(user, '文件名：A 到 Z'); expect(inDelivery()).toEqual(['1.png', '2.png', '10.png']);
    await user.click(screen.getByRole('button', { name: '列表视图' })); expect(inDelivery()).toEqual(['1.png', '2.png', '10.png']);
    await selectSort(user, '文件名：Z 到 A'); expect(inDelivery()).toEqual(['10.png', '2.png', '1.png']);
    await user.type(screen.getByRole('textbox', { name: '搜索文件名或目录' }), '1'); expect(inDelivery()).toEqual(['10.png', '1.png']);
    await user.click(screen.getByRole('button', { name: '清除文件筛选' })); expect(inDelivery()).toEqual(['10.png', '2.png', '1.png']);
    mounted.unmount(); render(contents());
    await screen.findByRole('button', { name: '打开文件：1.png' }); expect(inDelivery()).toEqual(['10.png', '2.png', '1.png']);
    expect(useUI.getState().detailFileSort).toBe('name-desc');
    await selectSort(user, '修改时间：最新优先'); expect(inDelivery()).toEqual(['1.png', '2.png', '10.png']);
  });
  it('更改排序保留折叠与选中，Shift连续选择和预览按新显示顺序', async () => {
    const user = userEvent.setup(); render(contents());
    await screen.findByRole('button', { name: '打开文件：1.png' });
    const copy = vi.spyOn(mockApi.files, 'copyToClipboard').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: '收起文件夹：参考资料' }));
    fireEvent.click(screen.getByRole('button', { name: '打开文件：10.png' }));
    await selectSort(user, '文件名：Z 到 A');
    expect(screen.getByRole('button', { name: '展开文件夹：参考资料' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '打开文件：10.png' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '打开文件：1.png' }), { shiftKey: true });
    await user.click(screen.getByRole('button', { name: '复制选中的 3 个文件' }));
    await waitFor(() => expect(copy).toHaveBeenCalledExactlyOnceWith(entries.slice(0, 3).map(file => file.path)));
    screen.getByRole('button', { name: '打开文件：10.png' }).focus();
    await user.keyboard(' '); await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('dialog', { name: '2.png' })).toBeTruthy();
  });
});
