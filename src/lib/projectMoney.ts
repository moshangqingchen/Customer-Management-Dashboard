import type { Payment, Project } from '../api/types';
import { expectedProfit, outstanding, paymentStatus, profit } from './money';

export function projectMoney(project: Pick<Project, 'priceCents' | 'costCents' | 'receivedCents' | 'status'>) {
  return {
    expectedProfitCents: expectedProfit(project.priceCents, project.costCents),
    profitCents: profit(project.receivedCents, project.costCents),
    outstandingCents: outstanding(project.priceCents, project.receivedCents, project.status),
    paymentStatus: paymentStatus(project.priceCents, project.receivedCents),
    canComplete: project.status === 'delivered' && project.receivedCents >= project.priceCents,
  };
}

/** A replacement first removes the old signed payment, then applies the proposed one. */
export function paymentOverage(project: Pick<Project, 'priceCents' | 'receivedCents'>, next: Pick<Payment, 'kind' | 'amountCents'>, previous?: Pick<Payment, 'kind' | 'amountCents'>): number {
  if (next.kind === 'refund') return 0;
  const oldAmount = previous ? (previous.kind === 'refund' ? -previous.amountCents : previous.amountCents) : 0;
  return Math.max(project.receivedCents - oldAmount + next.amountCents - project.priceCents, 0);
}
