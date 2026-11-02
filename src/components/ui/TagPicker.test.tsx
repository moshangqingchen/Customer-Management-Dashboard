import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Tag } from '../../api/types';
import { TagPicker } from './TagPicker';

const tags: Tag[] = [{ id: 'long', name: '这是一个很长很长但仍然需要完整保留并能够正确选择的客户项目标签名称', color: 'blue', sort: 0, clientCount: 0, projectCount: 0 }, { id: 'short', name: '老客户', color: 'orange', sort: 1, clientCount: 0, projectCount: 0 }];
describe('标签唯一展示与键盘选择', () => {
  it('触发框每个胶囊仅显示一次，关闭选择器后回到触发框', async () => {
    const user = userEvent.setup(); const change = vi.fn();
    render(<TagPicker label="编辑项目标签" tags={tags} value={['long', 'short']} onChange={change} variant="inline" />);
    const trigger = screen.getByRole('button', { name: '编辑项目标签' });
    expect(screen.getAllByText(tags[0].name)).toHaveLength(1);
    expect(screen.getAllByText('老客户')).toHaveLength(1);
    await user.click(trigger);
    expect(screen.getByRole('checkbox', { name: '老客户' }).getAttribute('data-state')).toBe('checked');
    await user.click(screen.getByRole('checkbox', { name: '老客户' })); expect(change).toHaveBeenCalledWith(['long']);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('checkbox')).toBeNull());
    expect(within(trigger).getAllByText(tags[0].name)).toHaveLength(1);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it('仅有已删除标签ID时显示添加入口', () => {
    render(<TagPicker tags={tags} value={['removed']} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: '选择标签' }).textContent).toBe('添加标签');
  });
});
