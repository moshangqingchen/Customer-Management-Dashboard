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
export interface IncomeLedgerEntry extends PaymentWithContext { netCents: number }
export interface OutstandingEntry { project: Project; outstandingCents: number }
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
/** Calendar periods align the same position in the previous month/quarter/year.
 * Completed last-month/last-year ranges compare whole periods; custom ranges use equal days. */
export function comparisonRanges(period: StatsPeriod | 'custom', range: DateRange, base = today()): { current: DateRange; previous: DateRange } {
  if (!range.from || !range.to) return { current: range, previous: { from: null, to: null } };
  const completePeriod = period === 'lastMonth' || period === 'lastYear';
  const current = { from: range.from, to: completePeriod || range.to <= base ? range.to : base };
  if (current.to < current.from) return { current, previous: { from: current.from, to: current.to } };
  const start = parseISO(current.from); const end = parseISO(current.to);
  if (period === 'thisMonth' || period === 'lastMonth') {
    const previousMonth = subMonths(start, 1);
    return { current, previous: { from: today(startOfMonth(previousMonth)), to: today(period === 'lastMonth' ? endOfMonth(previousMonth) : subMonths(end, 1)) } };
  }
  if (period === 'thisQuarter') {
    return { current, previous: { from: today(startOfQuarter(subMonths(start, 3))), to: today(subMonths(end, 3)) } };
  }
  if (period === 'thisYear' || period === 'lastYear') {
    const previousYear = subYears(start, 1);
    return { current, previous: { from: today(startOfYear(previousYear)), to: today(period === 'lastYear' ? endOfYear(previousYear) : subYears(end, 1)) } };
  }
  const length = differenceInCalendarDays(end, start) + 1;
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

/** The ledger, pending table and exports share the same period and eligible projects. */
export function incomeLedger(projects: readonly Project[], payments: readonly PaymentWithContext[], range: DateRange, method = ''): IncomeLedgerEntry[] {
  const ids = new Set(projects.filter(project => project.status !== 'cancelled').map(project => project.id));
  return payments.filter(payment => ids.has(payment.projectId) && inRange(payment.paidAt, range) && (!method || payment.method === method))
    .map(payment => ({ ...payment, netCents: payment.kind === 'refund' ? -payment.amountCents : payment.amountCents }))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
export function outstandingProjects(projects: readonly Project[], range: DateRange): OutstandingEntry[] {
  return projects.filter(project => inRange(project.createdAt, range)).map(project => ({ project, outstandingCents: outstanding(project.priceCents, project.receivedCents, project.status) }))
    .filter(entry => entry.outstandingCents > 0).sort((a, b) => b.outstandingCents - a.outstandingCents || a.project.id.localeCompare(b.project.id));
}
export function metricChange(current: number, previous: number, inverse = false): { label: string; tone: 'success' | 'danger' | 'neutral' } {
  if (current === previous) return { label: '与上期持平', tone: 'neutral' };
  const increased = current > previous;
  const label = previous === 0 ? (increased ? '较上期新增' : '较上期减少') : `较上期 ${increased ? '+' : ''}${Math.round((current - previous) / Math.abs(previous) * 100)}%`;
  return { label, tone: increased !== inverse ? 'success' : 'danger' };
}
const csvText = (value: string): string => `"${(/^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
export function incomeCsv(entries: readonly IncomeLedgerEntry[]): string {
  return [['日期', '客户', '项目', '方式', '金额（元）', '类型', '备注'].map(csvText).join(','), ...entries.map(entry => [
    csvText(entry.paidAt), csvText(entry.clientName), csvText(entry.projectTitle), csvText(entry.method), (entry.netCents / 100).toFixed(2), csvText(entry.kind === 'refund' ? '退款' : '收款'), csvText(entry.note),
  ].join(','))].join('\r\n');
}
