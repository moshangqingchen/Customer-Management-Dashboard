import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../api/mock';
import { reset, state } from '../api/mock/store';
import { ALL_LIBRARY_FILES_LIMIT, FILE_PAGE_SIZE } from '../lib/recentFiles';
import { FilesPage } from './FilesPage';

let cache: QueryClient;
const original = { scrollIntoView: Element.prototype.scrollIntoView, hasPointerCapture: Element.prototype.hasPointerCapture, setPointerCapture: Element.prototype.setPointerCapture, releasePointerCapture: Element.prototype.releasePointerCapture };
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = () => false; Element.prototype.setPointerCapture = () => undefined; Element.prototype.releasePointerCapture = () => undefined;
});
afterEach(() => { cache.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Object.assign(Element.prototype, original); });
function mount() { render(<QueryClientProvider client={cache}><FilesPage /></QueryClientProvider>); return userEvent.setup(); }
function seedManyFiles() {
  const sample = state().files[0];
  state().files = Array.from({ length: 1060 }, (_, i) => ({ ...sample, name: `资料-${String(i).padStart(4, '0')}.txt`, path: `D:/客户工作台/批量资料/${i}.txt`, relPath: `批量资料/${i}.txt`, kind: 'doc', ext: 'txt', modifiedAt: '2026-11-01T12:00:00Z' }));
  state().files.push({ ...sample, name: '半年前的最终源文件.psd', path: 'D:/客户工作台/历史项目/半年前的最终源文件.psd', relPath: '历史项目/半年前的最终源文件.psd', kind: 'design', ext: 'psd', modifiedAt: '2026-01-01T12:00:00Z' });
}
describe('文件库完整搜索', () => {
  it('搜索可找到最近1000条以外的旧文件，结果分页且筛选只触发一次全库读取', async () => {
    seedManyFiles(); const recent = vi.spyOn(mockApi.files, 'recent'); const user = mount();
    await screen.findByText('最近 1,000 个文件 · 第 1 / 17 页');
    expect(screen.getAllByRole('button', { name: /^打开文件：/ })).toHaveLength(FILE_PAGE_SIZE);
    expect(screen.queryByRole('button', { name: '打开文件：半年前的最终源文件.psd' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '下一页' }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索文件名' }), { target: { value: '历史项目 最终' } });
    await screen.findByRole('button', { name: '打开文件：半年前的最终源文件.psd' });
    expect(screen.getByText('全库找到 1 个文件')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: '搜索文件名' }), { target: { value: '最终源文件' } });
    expect(recent.mock.calls.filter(([limit]) => limit === ALL_LIBRARY_FILES_LIMIT)).toHaveLength(1);
    expect(screen.queryByRole('navigation', { name: '文件结果分页' })).toBeNull();
  });
  it('全库扫描失败显示错误与重试，不把失败伪装成没有结果', async () => {
    const originalRecent = mockApi.files.recent;
    vi.spyOn(mockApi.files, 'recent').mockImplementation(limit => limit === ALL_LIBRARY_FILES_LIMIT ? Promise.reject(new Error('部分目录暂时无法读取')) : originalRecent(limit));
    mount(); await screen.findAllByRole('button', { name: /打开文件：/ });
    fireEvent.change(screen.getByRole('textbox', { name: '搜索文件名' }), { target: { value: '旧资料' } });
    await screen.findByText('部分目录暂时无法读取');
    expect(screen.getByRole('button', { name: '重新加载' })).toBeTruthy();
    expect(screen.queryByText('没有找到这些文件')).toBeNull();
  });
  it('主动浏览全部文件，日期颠倒时提示而不显示误导空态', async () => {
    seedManyFiles(); const user = mount();
    await user.click(await screen.findByRole('button', { name: '浏览全部文件' }));
    await screen.findByText('全部 1,061 个文件 · 第 1 / 18 页');
    await user.click(screen.getByText('修改时间'));
    fireEvent.change(screen.getByLabelText('文件修改开始日期'), { target: { value: '2026-11-05' } });
    fireEvent.change(screen.getByLabelText('文件修改结束日期'), { target: { value: '2026-11-01' } });
    expect(screen.getByRole('alert').textContent).toBe('结束日期不能早于开始日期');
    expect(screen.queryByText('没有找到这些文件')).toBeNull();
    await user.click(screen.getByRole('button', { name: '清除筛选' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^打开文件：/ })).toHaveLength(FILE_PAGE_SIZE));
  });
});
