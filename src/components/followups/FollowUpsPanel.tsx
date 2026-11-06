import { useState } from 'react';
import { CalendarClock, Check, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import type { FollowUp, FollowUpStatus } from '../../api/followUps';
import { useFollowUpActions, useFollowUps } from '../../hooks/followUps';
import { formatDateTime } from '../../lib/dates';
import { isFollowUpDue } from '../../lib/followUps';
import { Button, ConfirmDialog, EmptyState, IconButton, Skeleton } from '../ui';
import { FollowUpEditor } from './FollowUpEditor';
import { CompleteFollowUpDialog } from './CompleteFollowUpDialog';

const statusLabels = { pending: '待跟进', completed: '已完成', cancelled: '已取消' } as const;
export function FollowUpsPanel({ clientId }: { clientId: string }) {
  const query = useFollowUps({ clientId }, true); const actions = useFollowUpActions();
  const now = query.dataUpdatedAt || Date.now();
  const [scope, setScope] = useState<FollowUpStatus | 'all'>('pending');
  const [editor, setEditor] = useState<{ item?: FollowUp; postpone?: boolean } | null>(null);
  const [completing, setCompleting] = useState<FollowUp | null>(null); const [cancelling, setCancelling] = useState<FollowUp | null>(null);
  const visible = (query.data ?? []).filter(item => scope === 'all' || item.status === scope);
  return <section aria-label="客户跟进计划" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div role="group" aria-label="跟进状态筛选" className="flex flex-wrap gap-1">{(['pending', 'completed', 'cancelled', 'all'] as const).map(value => <Button key={value} size="sm" variant={scope === value ? 'soft' : 'ghost'} aria-pressed={scope === value} onClick={() => setScope(value)}>{value === 'all' ? '全部' : statusLabels[value]}</Button>)}</div><Button size="sm" variant="soft" icon={<Plus size={15} />} onClick={() => setEditor({})}>新建跟进</Button></div>
    <p className="text-xs text-fg-2">应用开启时每分钟检查到期计划，返回窗口时也会检查。关闭应用后不后台提醒；客户归档后，已有未完成计划仍会提醒。</p>
    {query.isPending ? <Skeleton className="h-32" /> : query.isError ? <EmptyState title="跟进计划读取失败" description={query.error.message} action={<Button onClick={() => void query.refetch()}>重试</Button>} /> : !visible.length ? <EmptyState title={scope === 'pending' ? '没有待跟进计划' : '没有符合条件的跟进'} description="把下一次沟通安排好，客户维护就有了着落。" /> : <ul className="divide-y divide-line">{visible.map(item => <li key={item.id} className="space-y-2 py-3">
      <div className="flex flex-wrap items-start gap-2"><div className="min-w-0 flex-1"><p className="break-words font-medium">{item.title}</p><p className={`mt-1 text-xs ${isFollowUpDue(item, now) ? 'text-danger-fg' : 'text-fg-2'}`}>{formatDateTime(item.dueAt)} · {isFollowUpDue(item, now) ? '已到期，待跟进' : statusLabels[item.status]}</p></div><div className="flex flex-wrap gap-1">{item.status === 'pending' ? <><Button size="sm" variant="soft" icon={<Check size={14} />} onClick={() => setCompleting(item)}>完成</Button><IconButton size="sm" label={`调整时间：${item.title}`} onClick={() => setEditor({ item, postpone: true })}><CalendarClock size={15} /></IconButton><IconButton size="sm" label={`编辑跟进：${item.title}`} onClick={() => setEditor({ item })}><Pencil size={15} /></IconButton><IconButton size="sm" label={`取消跟进：${item.title}`} onClick={() => setCancelling(item)}><X size={15} /></IconButton></> : <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} disabled={actions.pending} onClick={() => actions.status.mutate({ id: item.id, status: 'pending' })}>重新开启</Button>}</div></div>
      {item.projectId && <p className="text-xs text-fg-2">项目：{item.projectTitle ?? '原关联项目'}{!item.projectAvailable && '（不可用，提醒已暂停；可重新选择关联项目）'}</p>}
      {item.notes && <p className="whitespace-pre-wrap break-words text-sm text-fg-2">{item.notes}</p>}
      {item.result && <p className="whitespace-pre-wrap break-words text-sm"><span className="text-fg-2">{item.status === 'completed' ? '跟进结果：' : '上次跟进结果：'}</span>{item.result}</p>}
    </li>)}</ul>}
    {editor && <FollowUpEditor clientId={clientId} item={editor.item} postpone={editor.postpone} onClose={() => setEditor(null)} />}
    {completing && <CompleteFollowUpDialog item={completing} onClose={() => setCompleting(null)} />}
    <ConfirmDialog open={!!cancelling} onOpenChange={open => { if (!open) setCancelling(null); }} title="取消这次跟进？" description={`「${cancelling?.title ?? ''}」会保留在已取消记录中，不再提醒，也可以重新开启。`} confirmLabel="取消跟进" onConfirm={async () => { if (cancelling) await actions.status.mutateAsync({ id: cancelling.id, status: 'cancelled' }); }} />
  </section>;
}
