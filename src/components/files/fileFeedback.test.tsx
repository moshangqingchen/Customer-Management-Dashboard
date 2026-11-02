import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import type { FileEntry } from '../../api/types';
import { filesAddedToast } from './fileFeedback';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));
const added = [{ name: '海报.png' }] as FileEntry[];
beforeEach(() => vi.clearAllMocks());
describe('添加文件反馈', () => {
  it('全部成功提示新增数量；取消选择不提示', () => {
    filesAddedToast({ added, failed: [] });
    expect(toast.success).toHaveBeenCalledWith('已添加 1 个文件');
    vi.clearAllMocks(); filesAddedToast({ added: [], failed: [] });
    expect(toast.success).not.toHaveBeenCalled(); expect(toast.warning).not.toHaveBeenCalled();
  });
  it('部分失败给出可展开的文件名与原因，全部失败同样提示', () => {
    filesAddedToast({ added, failed: [{ name: '源文件.psd', message: '文件不存在' }] });
    expect(toast.warning).toHaveBeenCalledWith('已添加 1 个，1 个失败', expect.objectContaining({ duration: 10000 }));
    const options = vi.mocked(toast.warning).mock.calls[0][1] as { description: ReactNode };
    render(<>{options.description}</>);
    expect(screen.getByText('查看失败文件与原因').closest('details')).not.toBeNull();
    expect(screen.getByText('源文件.psd')).toBeTruthy(); expect(screen.getByText('文件不存在')).toBeTruthy();
    filesAddedToast({ added: [], failed: [{ name: '终稿.ai', message: '没有读取权限' }] });
    expect(toast.warning).toHaveBeenLastCalledWith('已添加 0 个，1 个失败', expect.anything());
  });
});
