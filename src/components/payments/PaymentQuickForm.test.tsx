import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Payment, Project } from '../../api/types';
import { mockApi } from '../../api/mock';
import { reset } from '../../api/mock/store';
import { today } from '../../lib/dates';
import { PaymentQuickForm } from './PaymentQuickForm';

let query: QueryClient;
beforeEach(() => { reset(); query = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); });
afterEach(() => query.clear());
async function project() {
  const client = await mockApi.clients.create({ name: '收款组件验收' });
  return mockApi.projects.create({ clientId: client.id, title: '验收项目', priceCents: 10000 });
}
function renderForm(value: Project, payment?: Payment) {
  render(<QueryClientProvider client={query}><PaymentQuickForm project={value} payment={payment} /></QueryClientProvider>);
  return userEvent.setup();
}

describe('行内收退款表单', () => {
  it('超额必须再次确认，取消确认不扣账，确认后记住方式', async () => {
    const value = await project(); await mockApi.settings.update({ lastPaymentMethod: '支付宝' });
    const user = renderForm(value);
    await waitFor(() => expect(screen.getByRole('combobox', { name: '收款方式' }).textContent).toContain('支付宝'));
    const amount = screen.getByRole('textbox', { name: '金额（元）' });
    expect((amount as HTMLInputElement).value).toBe('100');
    await user.clear(amount); await user.type(amount, '120');
    await user.click(screen.getByRole('button', { name: '记录收款' }));
    let dialog = await screen.findByRole('dialog', { name: '确认多收款' });
    expect(within(dialog).getByText('将多收 ¥20，确定吗？')).toBeTruthy();
    expect(await mockApi.payments.list(value.id)).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(await mockApi.payments.list(value.id)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '记录收款' }));
    dialog = await screen.findByRole('dialog', { name: '确认多收款' });
    await user.click(within(dialog).getByRole('button', { name: '确认收款' }));
    await waitFor(async () => expect(await mockApi.payments.list(value.id)).toHaveLength(1));
    const payment = (await mockApi.payments.list(value.id))[0];
    expect(payment).toMatchObject({ kind: 'income', amountCents: 12000, paidAt: today(), method: '支付宝' });
    expect((await mockApi.settings.get()).lastPaymentMethod).toBe('支付宝');
  });

  it('编辑已有收款不会重复累计，退款始终以正金额写入', async () => {
    const value = await project();
    const payment = await mockApi.payments.add({ projectId: value.id, amountCents: 8000, paidAt: today() });
    const user = renderForm(await mockApi.projects.get(value.id), payment);
    const amount = screen.getByRole('textbox', { name: '金额（元）' });
    await user.clear(amount); await user.type(amount, '90');
    await user.click(screen.getByRole('button', { name: '更新记录' }));
    await waitFor(async () => expect((await mockApi.projects.get(value.id)).receivedCents).toBe(9000));
    expect(screen.queryByRole('dialog', { name: '确认多收款' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '退款' }));
    await user.clear(amount); await user.type(amount, '20');
    await user.click(screen.getByRole('button', { name: '更新记录' }));
    await waitFor(async () => expect((await mockApi.payments.list(value.id))[0]).toMatchObject({ kind: 'refund', amountCents: 2000 }));
    expect((await mockApi.projects.get(value.id)).receivedCents).toBe(-2000);
  });
});
