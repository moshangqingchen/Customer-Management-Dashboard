import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, addBrowserFiles } from '../../api/mock';
import { reset } from '../../api/mock/store';
import type { FileEntry, FileTarget } from '../../api/types';
import { useFilePaste } from '../../hooks/useFilePaste';
import { FileTile } from '../ui/FileItem';
import { FileBrowser } from './FileBrowser';
import { FilesArea } from './FilesArea';
import { ProjectCover } from '../project/ProjectCover';

let queryClient: QueryClient;
const originals = { scrollIntoView: Element.prototype.scrollIntoView, hasPointerCapture: Element.prototype.hasPointerCapture, setPointerCapture: Element.prototype.setPointerCapture, releasePointerCapture: Element.prototype.releasePointerCapture };
beforeEach(async () => {
  reset(); await mockApi.library.setRoot('D:/客户工作台');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  Element.prototype.scrollIntoView = vi.fn(); Element.prototype.hasPointerCapture = () => false; Element.prototype.setPointerCapture = () => undefined; Element.prototype.releasePointerCapture = () => undefined;
});
afterEach(() => { queryClient.clear(); document.documentElement.removeAttribute('data-theme'); vi.unstubAllGlobals(); vi.restoreAllMocks(); Object.assign(Element.prototype, originals); });
const file = (name: string, index: number, sizeBytes = 100): FileEntry => ({ path: `D:/客户工作台/${name}`, relPath: name, name, ext: name.split('.').at(-1) ?? '', kind: name.endsWith('.pdf') ? 'pdf' : name.endsWith('.png') ? 'image' : 'design', sizeBytes, modifiedAt: `2026-11-02T0${index}:00:00Z`, folderGroup: '', clientId: null, projectId: null });
const samples = [file('海报.psd', 1), file('说明.pdf', 2), file('品牌.ai', 3)];
const wrap = (children: React.ReactNode) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

describe('文件缩略图', () => {
  it('进入视口才调用Shell，同路径同版本在多个图块间缓存，更新文件后重查', async () => {
    const observers: { show: () => void }[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { observers.push({ show: () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver) }); }
      observe() {} disconnect() {}
    });
    const thumbnail = vi.spyOn(mockApi.files, 'thumbnail').mockResolvedValue('/sample-design.webp');
    const { rerender } = render(wrap(<><FileTile file={samples[0]} /><FileTile file={samples[0]} /></>));
    expect(thumbnail).not.toHaveBeenCalled();
    act(() => { observers.forEach(observer => observer.show()); });
    await waitFor(() => expect(thumbnail).toHaveBeenCalledExactlyOnceWith(samples[0].path, 256));
    expect(await screen.findAllByRole('img', { name: samples[0].name })).toHaveLength(2);
    rerender(wrap(<FileTile file={{ ...samples[0], modifiedAt: '2026-11-03T08:00:00Z' }} />));
    await waitFor(() => expect(thumbnail).toHaveBeenCalledTimes(2));
  });
  it('超过25MB图片使用受限系统缩略图，保留扩展名徽标', async () => {
    const thumbnail = vi.spyOn(mockApi.files, 'thumbnail').mockResolvedValue('/large-preview.webp');
    const image = file('大幅海报.png', 1, 26 * 1024 * 1024);
    render(wrap(<FileTile file={image} />));
    expect(await screen.findByRole('img', { name: image.name })).toBeTruthy();
    expect(thumbnail).toHaveBeenCalledWith(image.path, 256);
    expect(screen.getByText('png')).toBeTruthy();
  });
  it('设计文件封面进入视口后取真实缩略图，没有处理程序时隐藏', async () => {
    const [project] = await mockApi.projects.list();
    const thumbnail = vi.spyOn(mockApi.files, 'thumbnail').mockResolvedValue('/design-cover.webp');
    const { rerender, container } = render(wrap(<ProjectCover project={{ ...project, coverPath: samples[0].path }} className="size-12" />));
    expect(await screen.findByRole('img', { name: `${project.title}设计稿` })).toBeTruthy();
    expect(thumbnail).toHaveBeenCalledWith(samples[0].path, 256);
    thumbnail.mockResolvedValue(null);
    rerender(wrap(<ProjectCover project={{ ...project, coverPath: samples[1].path }} className="size-12" />));
    await waitFor(() => expect(container.firstElementChild?.classList.contains('hidden')).toBe(true));
  });
});

describe.each(['grid', 'list'] as const)('文件%s多选', view => {
  it('Shift连选、Ctrl切换、复制选中文件并取消选择', async () => {
    const copy = vi.spyOn(mockApi.files, 'copyToClipboard').mockResolvedValue();
    render(wrap(<FileBrowser files={samples} view={view} menu={() => []} />));
    const first = screen.getByRole('button', { name: `打开文件：${samples[0].name}` });
    const second = screen.getByRole('button', { name: `打开文件：${samples[1].name}` });
    const last = screen.getByRole('button', { name: `打开文件：${samples[2].name}` });
    fireEvent.click(first); fireEvent.click(last, { shiftKey: true });
    expect(screen.getByRole('button', { name: '复制 3 个文件' })).toBeTruthy();
    fireEvent.click(second, { ctrlKey: true });
    expect(second.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: '复制 2 个文件' }));
    await waitFor(() => expect(copy).toHaveBeenCalledExactlyOnceWith([samples[0].path, samples[2].path]));
    await userEvent.click(screen.getByRole('button', { name: '取消选择' }));
    expect(screen.queryByRole('region', { name: '文件选择操作' })).toBeNull();
  });
});

describe.each(['light', 'dark'])('%s主题预览交互', theme => {
  it('空格打开、方向键切换、缺预览回退、焦点陷阱和Esc焦点还原', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    const thumbnail = vi.spyOn(mockApi.files, 'thumbnail').mockImplementation(async (path) => path.endsWith('.pdf') ? null : '/design.webp');
    const user = userEvent.setup();
    render(wrap(<FileBrowser files={samples} view="grid" menu={() => []} context={() => '林女士 · 开业海报'} />));
    const source = screen.getByRole('button', { name: `打开文件：${samples[0].name}` }); source.focus();
    await user.keyboard(' ');
    const dialog = await screen.findByRole('dialog', { name: samples[0].name });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    await waitFor(() => expect(thumbnail).toHaveBeenCalledWith(samples[0].path, 1024));
    expect(within(dialog).getByText('林女士 · 开业海报 · 100 B')).toBeTruthy();
    for (let index = 0; index < 12; index++) { await user.tab(); expect(dialog.contains(document.activeElement)).toBe(true); }
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('dialog', { name: samples[1].name })).toBeTruthy();
    expect(await screen.findByText('这个文件暂时无法预览')).toBeTruthy();
    await user.keyboard('{ArrowLeft}');
    expect(await screen.findByRole('dialog', { name: samples[0].name })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(source));
  });
  it('右键菜单可预览和复制文件，预览复制按钮写入文件剪贴板', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    vi.spyOn(mockApi.files, 'thumbnail').mockResolvedValue(null);
    const copy = vi.spyOn(mockApi.files, 'copyToClipboard').mockResolvedValue(); const user = userEvent.setup();
    render(wrap(<FileBrowser files={samples} view="list" menu={() => []} />));
    const source = screen.getByRole('button', { name: `打开文件：${samples[0].name}` });
    fireEvent.contextMenu(source); await user.click(await screen.findByRole('menuitem', { name: '复制文件' }));
    await waitFor(() => expect(copy).toHaveBeenCalledExactlyOnceWith([samples[0].path]));
    fireEvent.contextMenu(source); await user.click(await screen.findByRole('menuitem', { name: '预览' }));
    const dialog = await screen.findByRole('dialog', { name: samples[0].name });
    await user.click(within(dialog).getByRole('button', { name: '复制文件' }));
    await waitFor(() => expect(copy).toHaveBeenCalledTimes(2));
    await user.keyboard('{Escape}'); await waitFor(() => expect(document.activeElement).toBe(source));
  });
});

function DetailHarness({ target }: { target: FileTarget }) { useFilePaste(target); return <><input aria-label="沟通备注" /><div contentEditable suppressContentEditableWarning role="textbox" aria-label="富文本备注" /><FilesArea target={target} /></>; }

describe('文件粘贴与交付', () => {
  it('默认首个子文件夹，切换后快捷键和按钮使用同一目标；输入区域不拦截粘贴', async () => {
    const client = await mockApi.clients.create({ name: '粘贴客户' }); const project = await mockApi.projects.create({ clientId: client.id, title: '粘贴项目' });
    const paste = vi.spyOn(mockApi.files, 'paste').mockResolvedValue({ added: [], failed: [] }); const user = userEvent.setup();
    render(wrap(<DetailHarness target={{ projectId: project.id }} />));
    await screen.findByText('把设计稿放在这里');
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    await waitFor(() => expect(paste).toHaveBeenCalledExactlyOnceWith({ projectId: project.id }, '参考资料'));
    await user.click(screen.getByRole('combobox', { name: '目标子文件夹' })); await user.click(await screen.findByRole('option', { name: '过程稿' }));
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    await waitFor(() => expect(paste).toHaveBeenLastCalledWith({ projectId: project.id }, '过程稿'));
    const count = paste.mock.calls.length;
    const input = screen.getByRole('textbox', { name: '沟通备注' }); input.focus(); fireEvent.keyDown(input, { key: 'v', ctrlKey: true });
    const rich = screen.getByRole('textbox', { name: '富文本备注' }); rich.focus(); fireEvent.keyDown(rich, { key: 'v', ctrlKey: true });
    expect(paste).toHaveBeenCalledTimes(count);
    await user.click(screen.getByRole('button', { name: '从剪贴板粘贴' }));
    await waitFor(() => expect(paste).toHaveBeenCalledTimes(count + 1));
    expect(paste).toHaveBeenLastCalledWith({ projectId: project.id }, '过程稿');
  });
  it('复制交付文件包含交付子目录，排除参考资料', async () => {
    const client = await mockApi.clients.create({ name: '交付客户' }); const project = await mockApi.projects.create({ clientId: client.id, title: '交付项目' });
    const delivery = await addBrowserFiles({ projectId: project.id }, [{ name: '成品.pdf', size: 100 }], '交付成品');
    const nested = await addBrowserFiles({ projectId: project.id }, [{ name: '源文件.ai', size: 100 }], '交付成品/源文件');
    await addBrowserFiles({ projectId: project.id }, [{ name: '参考.png', size: 100 }], '参考资料');
    const copy = vi.spyOn(mockApi.files, 'copyToClipboard').mockResolvedValue();
    render(wrap(<FilesArea target={{ projectId: project.id }} />));
    await userEvent.click(await screen.findByRole('button', { name: '复制交付文件' }));
    await waitFor(() => expect(copy).toHaveBeenCalledOnce());
    expect(copy.mock.calls[0][0]).toEqual(expect.arrayContaining([delivery.added[0].path, nested.added[0].path]));
    expect(copy.mock.calls[0][0]).toHaveLength(2);
  });
});
