import { ArrowRightLeft, FilePlus2, MessageSquareText, Plus, Wallet } from 'lucide-react';
import type { Activity, ActivityKind } from '../../api/types';
import { activityStatus, activitySummary } from '../../lib/activity';
import { IconTile, StatusPill, type IconTone } from '../ui';

const eventMeta: Record<ActivityKind, { icon: typeof Wallet; tone: IconTone }> = {
  payment: { icon: Wallet, tone: 'mint' }, file: { icon: FilePlus2, tone: 'sky' },
  status: { icon: ArrowRightLeft, tone: 'violet' }, note: { icon: MessageSquareText, tone: 'peach' },
  created: { icon: Plus, tone: 'amber' },
};

export function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const { icon: Icon, tone } = eventMeta[kind];
  return <IconTile tone={tone} size="sm"><Icon size={16} /></IconTile>;
}

export function ActivityEvent({ activity }: { activity: Activity }) {
  const from = activityStatus(activity.meta.from); const to = activityStatus(activity.meta.to);
  if (activity.kind === 'status' && from && to) return <span className="flex flex-wrap items-center gap-1.5"><StatusPill status={from} /><span aria-hidden>→</span><StatusPill status={to} /></span>;
  return <span className="whitespace-pre-wrap break-words">{activitySummary(activity)}</span>;
}
