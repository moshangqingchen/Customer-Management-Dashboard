import { useState } from 'react';
import type { Snippet, SnippetGroup } from '../../api/types';
import { useCreateSnippet, useUpdateSnippet } from '../../hooks/queries';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';

export function SnippetEditor({ groups, snippet, defaultGroupId, onClose }: { groups: SnippetGroup[]; snippet?: Snippet; defaultGroupId: string; onClose: () => void }) {
  const create = useCreateSnippet(); const update = useUpdateSnippet(); const [groupId, setGroupId] = useState(snippet?.groupId ?? defaultGroupId); const [title, setTitle] = useState(snippet?.title ?? ''); const [body, setBody] = useState(snippet?.body ?? '');
  const pending = create.isPending || update.isPending;
  async function save() { if (!title.trim() || !body.trim() || !groupId) return; const input = { groupId, title: title.trim(), body }; if (snippet) await update.mutateAsync({ id: snippet.id, patch: input }); else await create.mutateAsync(input); onClose(); }
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }} title={snippet ? '编辑话术' : '新建话术'} description="保留每一次用心的回复，换行会在复制时原样保留。" footer={<><Button disabled={pending} onClick={onClose}>取消</Button><Button type="submit" form="snippet-editor" variant="primary" disabled={pending || !title.trim() || !body.trim() || !groupId}>{pending ? '保存中…' : '保存话术'}</Button></>}>
    <form id="snippet-editor" className="space-y-4" onSubmit={event => { event.preventDefault(); void save().catch(() => undefined); }}><label className="block space-y-1.5 text-sm"><span>标题</span><Input aria-label="话术标题" value={title} required maxLength={100} onChange={event => setTitle(event.target.value)} /></label><label className="block space-y-1.5 text-sm"><span>分组</span><Select label="话术分组" value={groupId} options={groups.map(group => ({ value: group.id, label: group.name }))} onChange={setGroupId} /></label><label className="block space-y-1.5 text-sm"><span>内容</span><Textarea aria-label="话术内容" required className="min-h-48" value={body} onChange={event => setBody(event.target.value)} onKeyDown={event => { if (event.ctrlKey && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void save().catch(() => undefined); } }} /></label><p className="text-xs text-fg-2">Ctrl+Enter 快速保存</p></form>
  </Dialog>;
}
