import { useState } from 'react';
import type { FollowUp } from '../../api/followUps';
import { useFollowUpActions } from '../../hooks/followUps';
import { Button, Dialog, Textarea } from '../ui';

export function CompleteFollowUpDialog({ item, onClose }: { item: FollowUp; onClose: () => void }) {
  const [result, setResult] = useState(''); const actions = useFollowUpActions();
  async function complete() {
    if (!result.trim() || actions.pending) return;
    try { await actions.status.mutateAsync({ id: item.id, status: 'completed', result: result.trim() }); onClose(); } catch { /* Retain the result for retry. */ }
  }
  return <Dialog open onOpenChange={open => { if (!open && !actions.pending) onClose(); }} title="完成客户跟进" description={item.title}>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void complete(); }}><label className="block space-y-2"><span>跟进结果</span><Textarea aria-label="跟进结果" required value={result} onChange={event => setResult(event.target.value)} disabled={actions.pending} placeholder="记录客户反馈、确认结果或后续安排" /></label><p className="text-xs text-fg-2">完成结果会保存到客户动态；还需继续联系时，可另建计划或重新开启。</p><div className="flex justify-end gap-2"><Button disabled={actions.pending} onClick={onClose}>取消</Button><Button type="submit" variant="primary" disabled={actions.pending || !result.trim()}>{actions.pending ? '正在保存…' : '确认完成'}</Button></div></form>
  </Dialog>;
}
