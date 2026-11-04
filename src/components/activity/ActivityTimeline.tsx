import { useMemo, useState } from 'react';
import { Pencil, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Activity } from '../../api/types';
import { useActivities, useAddNote, useDeleteActivity, useUpdateNote } from '../../hooks/queries';
import { groupActivities } from '../../lib/activity';
import { formatTime } from '../../lib/dates';
import { useNav } from '../../stores/nav';
import { Button, ConfirmDialog, EmptyState, IconButton, Skeleton, Textarea, Tooltip } from '../ui';
import { ActivityEvent, ActivityIcon } from './ActivityEvent';

function NoteEditor({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const [body, setBody] = useState(activity.body); const update = useUpdateNote();
  async function save() {
    if (!body.trim()) return;
    try { await update.mutateAsync({ id: activity.id, body: body.trim() }); onClose(); } catch { /* hook reports errors */ }
  }
  return <div className="space-y-2"><Textarea aria-label="编辑动态备注" value={body} onChange={event => setBody(event.target.value)} onKeyDown={event => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); void save(); } if (event.key === 'Escape') onClose(); }} /><div className="flex gap-2"><Button size="sm" variant="soft" disabled={update.isPending || !body.trim()} onClick={() => void save()}>保存备注</Button><Button size="sm" variant="ghost" onClick={onClose}>取消</Button></div></div>;
}

export function ActivityTimeline({ clientId, projectId }: { clientId: string; projectId?: string }) {
  const activities = useActivities({ clientId, projectId }); const add = useAddNote(); const remove = useDeleteActivity();
  const [body, setBody] = useState(''); const [editing, setEditing] = useState<string | null>(null); const [deleting, setDeleting] = useState<string | null>(null);
  const groups = useMemo(() => groupActivities(activities.data ?? []), [activities.data]);
  const navigate = useNav(state => state.navigate);
  async function send() {
    if (!body.trim() || add.isPending) return;
    try { await add.mutateAsync({ clientId, projectId, body: body.trim() }); setBody(''); toast.success('已添加备注'); } catch { /* hook reports errors */ }
  }
  return <section className="space-y-5" aria-label="动态时间线">
    <div className="space-y-2"><Textarea aria-label="添加动态备注" placeholder="记下沟通、反馈或下一步…" value={body} onChange={event => setBody(event.target.value)} onKeyDown={event => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); void send(); } }} /><div className="flex justify-end"><Tooltip content="Ctrl+Enter 发送"><Button variant="soft" size="sm" icon={<Send size={14} />} disabled={!body.trim() || add.isPending} onClick={() => void send()}>{add.isPending ? '正在发送…' : '添加备注'}</Button></Tooltip></div></div>
    {activities.isPending ? <div className="space-y-4">{[1, 2, 3].map(item => <Skeleton key={item} className="h-16" />)}</div> : activities.isError ? <EmptyState title="动态暂时无法加载" description={activities.error.message} action={<Button onClick={() => void activities.refetch()}>重试</Button>} /> : !groups.length ? <EmptyState title="还没有动态" description="记下第一条沟通备注，让每次合作都有迹可循。" /> : groups.map(group => <div key={group.date}><h3 className="mb-3 text-xs font-medium text-fg-2">{group.label}</h3><div className="space-y-4">{group.items.map(activity => <article key={activity.id} className="group flex gap-3"><ActivityIcon kind={activity.kind} /><div className="min-w-0 flex-1 border-b border-line/60 pb-4"><div className="mb-1 flex items-center justify-between gap-2"><div className="min-w-0 text-xs text-fg-3">{!projectId && activity.projectId && <button type="button" className="mr-2 max-w-full truncate text-primary hover:underline" onClick={() => { const nav = useNav.getState(); const route = nav.entries[nav.index]; navigate(route.page, { ...route.params, projectId: activity.projectId! }); }}>{activity.projectTitle}</button>}<time dateTime={activity.createdAt}>{formatTime(activity.createdAt)}</time></div>{activity.kind === 'note' && <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><IconButton label="编辑备注" onClick={() => setEditing(activity.id)}><Pencil size={14} /></IconButton><IconButton label="删除备注" onClick={() => setDeleting(activity.id)}><Trash2 size={14} /></IconButton></div>}</div>{editing === activity.id ? <NoteEditor activity={activity} onClose={() => setEditing(null)} /> : <div className={activity.kind === 'note' ? 'text-sm text-fg' : 'text-xs text-fg-2'}><ActivityEvent activity={activity} /></div>}</div></article>)}</div></div>)}
    <ConfirmDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }} title="删除这条备注？" description="删除后无法恢复。" onConfirm={async () => { if (deleting) await remove.mutateAsync(deleting); }} />
  </section>;
}
