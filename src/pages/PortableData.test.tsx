import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi } from '../api/mock';
import { reset, state } from '../api/mock/store';
import type { AppInfo } from '../api/types';
import { AboutSettings } from '../components/settings/AboutSettings';
import { Onboarding } from './Onboarding';

let query: QueryClient;
const portableInfo: AppInfo = { version: '2.0.1', dataDir: 'D:\\项目\\我的数据\\应用数据', dbPath: 'D:\\项目\\我的数据\\应用数据\\client-desk.db', portable: true, suggestedLibraryRoot: 'D:\\项目\\我的数据\\客户资料库' };
beforeEach(() => {
  reset();
  query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { query.clear(); vi.restoreAllMocks(); });
function mount(content: React.ReactNode) {
  render(<QueryClientProvider client={query}>{content}</QueryClientProvider>);
  return userEvent.setup();
}

describe('便携模式首次引导', () => {
  it('普通模式沿用选择文件库流程', async () => {
    const picker = vi.spyOn(mockApi.library, 'pickFolder');
    const user = mount(<Onboarding />);
    expect(await mockApi.app.info()).toMatchObject({ portable: false, suggestedLibraryRoot: null });
    expect(screen.getByText('建议位置：文档\\客户工作台')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: '选择文件库位置' }).hasAttribute('disabled')).toBe(false));
    await user.click(screen.getByRole('button', { name: '选择文件库位置' }));
    await waitFor(async () => expect((await mockApi.library.status()).root).toBe('D:/客户工作台'));
    expect(picker).toHaveBeenCalledOnce();
  });

  it('便携模式显示完整建议路径，直接确认并保留用户决定前的未配置状态', async () => {
    state().appInfo = portableInfo;
    const picker = vi.spyOn(mockApi.library, 'pickFolder');
    const setRoot = vi.spyOn(mockApi.library, 'setRoot');
    const user = mount(<Onboarding />);
    expect(await mockApi.app.info()).toEqual(portableInfo);
    await screen.findByText(`建议位置：${portableInfo.suggestedLibraryRoot}`);
    expect((await mockApi.library.status()).state).toBe('notConfigured');
    await user.click(screen.getByRole('button', { name: '使用这个位置' }));
    await waitFor(() => expect(setRoot).toHaveBeenCalledWith(portableInfo.suggestedLibraryRoot));
    expect(picker).not.toHaveBeenCalled();
    expect((await mockApi.library.status()).root).toBe('D:/项目/我的数据/客户资料库');
  });

  it('便携模式的选择其他位置使用文件夹对话框', async () => {
    state().appInfo = portableInfo;
    vi.spyOn(mockApi.library, 'pickFolder').mockResolvedValue('E:\\作品库');
    const user = mount(<Onboarding />);
    await user.click(await screen.findByRole('button', { name: '选择其他位置' }));
    await waitFor(async () => expect((await mockApi.library.status()).root).toBe('E:/作品库'));
  });

  it('便携配置省略建议位置时保留普通引导', async () => {
    state().appInfo = { ...portableInfo, suggestedLibraryRoot: null };
    mount(<Onboarding />);
    await waitFor(() => expect(screen.getByRole('button', { name: '选择文件库位置' }).hasAttribute('disabled')).toBe(false));
    expect(screen.queryByRole('button', { name: '使用这个位置' })).toBeNull();
    expect(screen.queryByRole('button', { name: '选择其他位置' })).toBeNull();
  });
});

describe('关于的数据位置', () => {
  it.each([false, true])('展示数据目录并通过专用命令打开，便携徽标：%s', async portable => {
    state().appInfo = { ...portableInfo, portable, suggestedLibraryRoot: portable ? portableInfo.suggestedLibraryRoot : null };
    const open = vi.spyOn(mockApi.app, 'openDataDir');
    const user = mount(<AboutSettings />);
    const path = await screen.findByText(portableInfo.dataDir);
    const row = path.parentElement?.parentElement;
    if (!row) throw new Error('未找到数据位置行');
    await user.click(within(row).getByRole('button', { name: '打开' }));
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    expect(Boolean(screen.queryByText('便携模式 · 数据都在程序旁边'))).toBe(portable);
  });
});
