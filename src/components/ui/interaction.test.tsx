import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NumberInput } from './Input';
import { InlineEdit } from './InlineEdit';
import { Dialog } from './Dialog';
import { SidePanel } from './SidePanel';
import { Table } from './Table';
import { Combobox } from './Combobox';

const scrollIntoView = Element.prototype.scrollIntoView;
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); Element.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { Element.prototype.scrollIntoView = scrollIntoView; vi.unstubAllGlobals(); });

describe('金额输入', () => {
  it('提供中文默认名称，尊重显式标签与外部标签关联', () => {
    const change = vi.fn(); const { rerender } = render(<NumberInput value={0} onChange={change} />);
    expect(screen.getByRole('textbox', { name: '金额（元）' })).toBeTruthy();
    rerender(<NumberInput value={0} onChange={change} aria-label="收款金额" />);
    expect(screen.getByRole('textbox', { name: '收款金额' })).toBeTruthy();
    rerender(<><span id="cost-name">成本</span><NumberInput value={0} onChange={change} aria-labelledby="cost-name" /></>);
    expect(screen.getByRole('textbox', { name: '成本' })).toBeTruthy();
  });
  it('十进制元转换为精确的整数分，拒绝负数和超过两位小数', () => {
    const change = vi.fn(); render(<NumberInput value={0} onChange={change} label="项目报价" />);
    const input = screen.getByLabelText('项目报价');
    fireEvent.change(input, { target: { value: '12.03' } }); expect(change).toHaveBeenLastCalledWith(1203);
    fireEvent.change(input, { target: { value: '12.031' } }); expect(change).toHaveBeenCalledTimes(1); expect(input.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(input, { target: { value: '-1' } }); expect(change).toHaveBeenCalledTimes(1);
  });
  it('受控表单逐字输入时保留小数点和小数金额', async () => {
    function Example() { const [amount, setAmount] = useState(0); return <><NumberInput label="项目报价" value={amount} onChange={setAmount} /><output>{amount}</output></>; }
    const user = userEvent.setup(); render(<Example />); const input = screen.getByLabelText('项目报价');
    await user.clear(input); await user.type(input, '12.03'); expect(screen.getByRole('status').textContent).toBe('1203'); expect((input as HTMLInputElement).value).toBe('12.03');
  });
});
describe('就地编辑', () => {
  it('Esc 取消，随后的失焦不保存', async () => {
    const user = userEvent.setup(); const save = vi.fn(); render(<InlineEdit value="原来的名称" onSave={save} label="编辑项目名" />);
    await user.click(screen.getByRole('button')); const input = screen.getByRole('textbox'); await user.clear(input); await user.type(input, '新的名称'); await user.keyboard('{Escape}');
    expect(save).not.toHaveBeenCalled(); expect(screen.getByRole('button').textContent).toBe('原来的名称');
  });
  it('Enter 只保存一次，保存失败回滚显示', async () => {
    const user = userEvent.setup(); const save = vi.fn().mockRejectedValue(new Error('暂时无法保存'));
    render(<InlineEdit value="原来的名称" onSave={save} />); await user.click(screen.getByRole('button')); const input = screen.getByRole('textbox'); await user.clear(input); await user.type(input, '新的名称{Enter}');
    await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith('新的名称'));
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('原来的名称'));
  });
  it('输入法确认候选词时不会提前保存', async () => {
    const user = userEvent.setup(); const save = vi.fn(); render(<InlineEdit value="原名称" onSave={save} />);
    await user.click(screen.getByRole('button')); const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: '山间咖啡' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); expect(save).not.toHaveBeenCalled(); expect(screen.getByRole('textbox')).toBe(input);
    fireEvent.keyDown(input, { key: 'Enter' }); await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith('山间咖啡'));
  });
});
describe('弹窗与面板键盘操作', () => {
  it('Esc 关闭弹窗并恢复打开前的焦点', async () => {
    function Example() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>新建项目</button><Dialog open={open} onOpenChange={setOpen} title="新建项目"><input aria-label="项目名" /></Dialog></>; }
    const user = userEvent.setup(); render(<Example />); const opener = screen.getByRole('button', { name: '新建项目' }); await user.click(opener);
    expect(screen.getByRole('dialog')).toBeTruthy(); await user.keyboard('{Escape}'); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); await waitFor(() => expect(document.activeElement).toBe(opener));
  });
  it('调整面板宽度有上下限且可通过方向键操作', () => {
    const resize = vi.fn(); render(<SidePanel open onOpenChange={() => undefined} title="项目详情" width={900} onWidthChange={resize}>内容</SidePanel>);
    const handle = screen.getByRole('separator'); fireEvent.keyDown(handle, { key: 'ArrowLeft' }); expect(resize).toHaveBeenLastCalledWith(900); fireEvent.keyDown(handle, { key: 'ArrowRight' }); expect(resize).toHaveBeenLastCalledWith(880);
  });
});
describe('列表键盘操作', () => {
  it('上下移动焦点，Enter 打开当前行', () => {
    const open = vi.fn(); const rows = [{ id: '1', name: '第一项' }, { id: '2', name: '第二项' }];
    render(<Table rows={rows} columns={[{ key: 'name', title: '名称', render: row => row.name }]} rowKey={row => row.id} onOpen={open} />);
    const row = screen.getByText('第一项').closest('tr')!; fireEvent.keyDown(row, { key: 'ArrowDown' }); expect(document.activeElement?.textContent).toBe('第二项'); fireEvent.keyDown(document.activeElement!, { key: 'Enter' }); expect(open).toHaveBeenCalledWith(rows[1]);
  });
  it('筛选缩短列表后仍保留可通过 Tab 进入的行', () => {
    const rows = [{ id: '1', name: '第一项' }, { id: '2', name: '第二项' }]; const columns = [{ key: 'name', title: '名称', render: (row: typeof rows[number]) => row.name }];
    const { rerender } = render(<Table rows={rows} columns={columns} rowKey={row => row.id} />);
    fireEvent.keyDown(screen.getByText('第一项').closest('tr')!, { key: 'End' }); expect(screen.getByText('第二项').closest('tr')?.tabIndex).toBe(0);
    rerender(<Table rows={rows.slice(0, 1)} columns={columns} rowKey={row => row.id} />); expect(screen.getByText('第一项').closest('tr')?.tabIndex).toBe(0);
  });
});
describe('可创建的组合框', () => {
  it('输入新名称后回车创建并选择', async () => {
    const user = userEvent.setup(); const create = vi.fn().mockResolvedValue('new-client'); const change = vi.fn();
    render(<Combobox value="" onChange={change} options={[]} onCreate={create} />);
    await user.click(screen.getByRole('combobox')); await user.type(screen.getByPlaceholderText('输入名称搜索…'), '山间咖啡'); await user.keyboard('{Enter}');
    await waitFor(() => expect(create).toHaveBeenCalledWith('山间咖啡')); expect(change).toHaveBeenCalledWith('new-client');
  });
});
