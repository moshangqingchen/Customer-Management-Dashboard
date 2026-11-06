import { useState } from 'react';
import type { FollowUp } from '../../api/followUps';
import { useFollowUpActions } from '../../hooks/followUps';
import { useProjects } from '../../hooks/queries';
import { localDateTime, localDateTimeToUtc } from '../../lib/followUps';
import { Button, Dialog, Input, Select, Textarea } from '../ui';

export function FollowUpEditor({ clientId, item, postpone = false, onClose }: { clientId: string; item?: FollowUp; postpone?: boolean; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [scheduled, setScheduled] = useState(item ? localDateTime(item.dueAt) : localDateTime(new Date(Date.now() + 60 * 60_000).toISOString()));
  const [notes, setNotes] = useState(item?.notes ?? ''); const [projectId, setProjectId] = useState(item?.projectId ?? ''); const [error, setError] = useState('');
  const projects = useProjects(); const actions = useFollowUpActions();
  const options = (projects.data ?? []).filter(project => project.clientId === clientId).map(project => ({ value: project.id, label: project.title }));
  if (item?.projectId && !options.some(option => option.value === item.projectId)) options.push({ value: item.projectId, label: `${item.projectTitle ?? '原关联项目'}（不可用，请重新选择）` });
  async function submit() {
    const dueAt = localDateTimeToUtc(scheduled);
    if (!title.trim() || !dueAt) { setError('请填写跟进主题和有效的计划时间'); return; }
    if (postpone && item && dueAt === item.dueAt) { setError('请选择新的计划时间'); return; }
    if (projectId && !(projects.data ?? []).some(project => project.id === projectId && project.clientId === clientId)) { setError('关联项目不可用，请选择其他项目或不关联项目'); return; }
    try {
      const input = { title: title.trim(), dueAt, notes: notes.trim(), projectId: projectId || null };
      if (item) await actions.update.mutateAsync({ id: item.id, patch: input });
      else await actions.create.mutateAsync({ ...input, clientId });
      onClose();
    } catch { /* Keep the entered text so a failed save can be retried. */ }
  }
  return <Dialog open onOpenChange={open => { if (!open && !actions.pending) onClose(); }} title={postpone ? '调整跟进时间' : item ? '编辑跟进计划' : '新建跟进计划'} description="计划时间使用本机时区。提醒仅在应用开启时生效，关闭后不会后台通知。">
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label className="block space-y-2"><span>跟进主题</span><Input aria-label="跟进主题" value={title} onChange={event => setTitle(event.target.value)} maxLength={200} required disabled={actions.pending} placeholder="例如：确认初稿反馈、回访老客户" /></label>
      <label className="block space-y-2"><span>计划时间</span><Input aria-label="跟进计划时间" type="datetime-local" value={scheduled} onChange={event => setScheduled(event.target.value)} required disabled={actions.pending} /></label>
      <div className="space-y-2"><p className="text-sm">关联项目（可选）</p><Select label="关联项目" value={projectId || '__none__'} onChange={value => setProjectId(value === '__none__' ? '' : value)} disabled={actions.pending || projects.isPending} options={[{ value: '__none__', label: '不关联项目' }, ...options]} /></div>
      {projects.isError && <p className="text-sm text-danger-fg">项目读取失败，可稍后重试或不关联项目。</p>}
      <label className="block space-y-2"><span>跟进备注</span><Textarea aria-label="跟进备注" value={notes} onChange={event => setNotes(event.target.value)} disabled={actions.pending} placeholder="要确认的内容、沟通方式或准备事项" /></label>
      {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
      <div className="flex justify-end gap-2"><Button onClick={onClose} disabled={actions.pending}>取消</Button><Button variant="primary" type="submit" disabled={actions.pending}>{actions.pending ? '正在保存…' : '保存计划'}</Button></div>
    </form>
  </Dialog>;
}
