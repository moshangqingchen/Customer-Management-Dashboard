import type { Payment, ProjectStatus } from '../api/types';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'over';
export function formatMoney(cents: number, withSymbol = true): string {
  const value = cents / 100;
  const digits = cents % 100 === 0 ? 0 : 2;
  return `${value < 0 ? '−' : ''}${withSymbol ? '¥' : ''}${Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
/** Exact decimal parsing: no floating point multiplication, invalid values remain invalid. */
export function parseMoney(input: string): number | null {
  const value = input.trim().replace(/^[¥￥]\s*/, '').replace(/,/g, '');
  if (!/^-?\d+(?:\.\d{0,2})?$/.test(value)) return null;
  const [whole, decimal = ''] = value.replace('-', '').split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents * (value.startsWith('-') ? -1 : 1) : null;
}
export const netReceived = (payments: Pick<Payment, 'kind' | 'amountCents'>[]) => payments.reduce((sum, p) => sum + (p.kind === 'refund' ? -p.amountCents : p.amountCents), 0);
export function paymentStatus(price: number, received: number): PaymentStatus {
  if (received > price) return 'over';
  if (received === price) return 'paid';
  return received <= 0 ? 'unpaid' : 'partial';
}
export const outstanding = (price: number, received: number, status?: ProjectStatus) => status === 'cancelled' ? 0 : Math.max(price - received, 0);
export const profit = (received: number, cost: number) => received - cost;
export const expectedProfit = (price: number, cost: number) => price - cost;
