import { addMonths, differenceInCalendarDays, endOfMonth, endOfQuarter, endOfYear, format, parseISO, startOfMonth, startOfQuarter, startOfYear, subMonths, subYears } from 'date-fns';
import type { PaymentWithContext, Project } from '../api/types';
import { dateOffset, today } from './dates';
import { outstanding } from './money';

export interface DateRange { from: string | null; to: string | null }
export type StatsPeriod = 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'lastYear' | 'all';
export interface IncomeStats {
  receivedCents: number; outstandingCents: number; costCents: number; profitCents: number;
  expectedProfitCents: number; dealCount: number; averageOrderCents: number;
}
export interface MonthlyStats extends IncomeStats { month: string }
export interface ClientRank { clientId: string; clientName: string; receivedCents: number }
export const inRange = (date: string, range: DateRange): boolean => (!range.from || date.slice(0, 10) >= range.from) && (!range.to || date.slice(0, 10) <= range.to);
export function periodRange(period: StatsPeriod, base = today()): DateRange {
  const current = parseISO(base);
  if (period === 'all') return { from: null, to: null };
  const month = period === 'lastMonth' ? subMonths(current, 1) : current;
  const year = period === 'lastYear' ? subYears(current, 1) : current;
  if (period === 'thisMonth' || period === 'lastMonth') return { from: today(startOfMonth(month)), to: today(endOfMonth(month)) };
  if (period === 'thisQuarter') return { from: today(startOfQuarter(current)), to: today(endOfQuarter(current)) };
  return { from: today(startOfYear(year)), to: today(endOfYear(year)) };
}
/** Compare only elapsed dates. Month-to-date aligns calendar days, clamped at month end. */
export function comparisonRanges(period: StatsPeriod | 'custom', range: DateRange, base = today()): { current: DateRange; previous: DateRange } {
  if (!range.from || !range.to) return { current: range, previous: { from: null, to: null } };
  const current = { from: range.from, to: range.to > base ? base : range.to };
  if (current.to < current.from) return { current, previous: { from: current.from, to: current.to } };
  if (period === 'thisMonth') {
    const previousMonth = subMonths(parseISO(current.from), 1);
    const lastDay = today(endOfMonth(previousMonth));
    const aligned = `${format(previousMonth, 'yyyy-MM')}-${current.to.slice(8, 10)}`;
    return { current, previous: { from: today(startOfMonth(previousMonth)), to: aligned > lastDay ? lastDay : aligned } };
  }
  const length = differenceInCalendarDays(parseISO(current.to), parseISO(current.from)) + 1;
  return { current, previous: { from: dateOffset(-length, current.from), to: dateOffset(-1, current.from) } };
}
/** Cash receipts follow paidAt; project costs, deals and outstanding follow createdAt.
 * Cancelled projects are excluded from every metric. Leads are not counted as deals.
 * Average order value is quoted revenue / deals, independent of payment timing. */
export function incomeStats(projects: readonly Project[], payments: readonly PaymentWithContext[], range: DateRange = { from: null, to: null }): IncomeStats {
  const eligible = projects.filter(project => project.status !== 'cancelled');
  const ids = new Set(eligible.map(project => project.id));
  const cohort = eligible.filter(project => inRange(project.createdAt, range));
  const deals = cohort.filter(project => project.status !== 'lead');
  const receivedCents = payments.filter(payment => ids.has(payment.projectId) && inRange(payment.paidAt, range)).reduce((sum, payment) => sum + (payment.kind === 'refund' ? -payment.amountCents : payment.amountCents), 0);
  const costCents = cohort.reduce((sum, project) => sum + project.costCents, 0);
  return {
    receivedCents, costCents, profitCents: receivedCents - costCents,
    outstandingCents: cohort.reduce((sum, project) => sum + outstanding(project.priceCents, project.receivedCents, project.status), 0),
    expectedProfitCents: cohort.reduce((sum, project) => sum + project.priceCents - project.costCents, 0),
    dealCount: deals.length,
    averageOrderCents: deals.length ? Math.round(deals.reduce((sum, project) => sum + project.priceCents, 0) / deals.length) : 0,
  };
}
export function monthlyStats(projects: readonly Project[], payments: readonly PaymentWithContext[], months = 12, base = today()): MonthlyStats[] {
  return Array.from({ length: Math.max(0, months) }, (_, index) => {
    const month = addMonths(startOfMonth(parseISO(base)), index - months + 1);
    return { month: format(month, 'yyyy-MM'), ...incomeStats(projects, payments, { from: today(month), to: today(endOfMonth(month)) }) };
  });
}
export function clientRanking(projects: readonly Project[], payments: readonly PaymentWithContext[], range: DateRange = { from: null, to: null }, limit = 10): ClientRank[] {
  const ids = new Set(projects.filter(project => project.status !== 'cancelled').map(project => project.id));
  const ranks = new Map<string, ClientRank>();
  for (const payment of payments) {
    if (!ids.has(payment.projectId) || !inRange(payment.paidAt, range)) continue;
    const rank = ranks.get(payment.clientId) ?? { clientId: payment.clientId, clientName: payment.clientName, receivedCents: 0 };
    rank.receivedCents += payment.kind === 'refund' ? -payment.amountCents : payment.amountCents;
    ranks.set(payment.clientId, rank);
  }
  return [...ranks.values()].sort((a, b) => b.receivedCents - a.receivedCents || a.clientName.localeCompare(b.clientName, 'zh-CN')).slice(0, Math.max(0, limit));
}
