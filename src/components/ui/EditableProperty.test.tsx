import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CalendarDays } from 'lucide-react';
import { EditableProperty } from './EditableProperty';

describe('轻量属性编辑', () => {
  it('点击值才出现输入框，失焦保存，Enter 不会重复提交', async () => {
    const save = vi.fn().mockResolvedValue(undefined); const user = userEvent.setup();
    render(<EditableProperty icon={<CalendarDays />} label="截止日期" type="date" value="2026-11-03" onSave={save} />);
    expect(document.querySelector('input')).toBeNull();
    await user.click(screen.getByRole('button', { name: '编辑截止日期' }));
    const date = screen.getByLabelText('编辑截止日期'); expect(document.activeElement).toBe(date);
    fireEvent.change(date, { target: { value: '2026-11-04' } }); fireEvent.blur(date);
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith('2026-11-04'));
    await user.click(screen.getByRole('button', { name: '编辑截止日期' }));
    fireEvent.change(screen.getByLabelText('编辑截止日期'), { target: { value: '2026-11-05' } });
    fireEvent.keyDown(screen.getByLabelText('编辑截止日期'), { key: 'Enter' });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });
  it('Escape保留原值并阻止外层面板关闭，失败回滚', async () => {
    const save = vi.fn().mockRejectedValue(new Error('保存失败')); const outside = vi.fn(); const user = userEvent.setup();
    render(<div onKeyDown={outside}><EditableProperty icon={<CalendarDays />} label="订单号" value="订单甲" onSave={save} /></div>);
    await user.click(screen.getByRole('button')); fireEvent.change(screen.getByRole('textbox'), { target: { value: '订单乙' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(save).not.toHaveBeenCalled(); expect(outside).not.toHaveBeenCalled();
    expect(screen.getByRole('button').textContent).toBe('订单甲');
    await user.click(screen.getByRole('button')); fireEvent.change(screen.getByRole('textbox'), { target: { value: '订单丙' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith('订单丙'));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('订单甲'));
  });
});
