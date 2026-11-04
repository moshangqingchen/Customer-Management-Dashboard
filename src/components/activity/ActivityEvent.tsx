import { ArrowRightLeft, FilePlus2, MessageSquareText, Plus, Wallet } from 'lucide-react';
import type { Activity, ActivityKind } from '../../api/types';
import { activityStatus, activitySummary } from '../../lib/activity';
import { StatusPill } from '../ui';

const eventMeta: Record<ActivityKind, typeof Wallet> = {
  payment: Wallet, file: FilePlus2, status: ArrowRightLeft, note: MessageSquareText, created: Plus,
};

export function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const Icon = eventMeta[kind];
  return <span className="inline-flex size-6 shrink-0 items-center justify-center text-fg-2"><Icon size={16} /></span>;
}

export function ActivityEvent({ activity }: { activity: Activity }) {
  const from = activityStatus(activity.meta.from); const to = activityStatus(activity.meta.to);
  if (activity.kind === 'status' && from && to) return <span className="flex flex-wrap items-center gap-1.5"><StatusPill status={from} /><span aria-hidden>→</span><StatusPill status={to} /></span>;
  return <span className="whitespace-pre-wrap break-words">{activitySummary(activity)}</span>;
}
