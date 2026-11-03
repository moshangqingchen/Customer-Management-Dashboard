import { useRef, useState } from 'react';
import type { Snippet, SnippetGroup } from '../../api/types';
import { useCreateSnippet, useUpdateSnippet } from '../../hooks/queries';
import { snippetVariables } from '../../lib/snippets';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';

export function SnippetEditor({ groups, snippet, defaultGroupId, onClose }: { groups: SnippetGroup[]; snippet?: Snippet; defaultGroupId: string; onClose: () => void }) {
  const create = useCreateSnippet(); const update = useUpdateSnippet(); const [groupId, setGroupId] = useState(snippet?.groupId ?? defaultGroupId); const [title, setTitle] = useState(snippet?.title ?? ''); const [body, setBody] = useState(snippet?.body ?? '');
  const pending = create.isPending || update.isPending;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: body.length, end: body.length });
  function insertVariable(name: typeof snippetVariables[number]) {
    const { start, end } = selection.current; const variable = `{${name}}`; const cursor = start + variable.length;
    setBody(previous => previous.slice(0, start) + variable + previous.slice(end));
    selection.current = { start: cursor, end: cursor };
    requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(cursor, cursor); });
  }
  async function save() { if (!title.trim() || !body.trim() || !groupId) return; const input = { groupId, title: title.trim(), body }; if (snippet) await update.mutateAsync({ id: snippet.id, patch: input }); else await create.mutateAsync(input); onClose(); }
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }} title={snippet ? '编辑话术' : '新建话术'} description="保留每一次用心的回复，换行会在复制时原样保留。" footer={<><Button disabled={pending} onClick={onClose}>取消</Button><Button type="submit" form="snippet-editor" variant="primary" disabled={pending || !title.trim() || !body.trim() || !groupId}>{pending ? '保存中…' : '保存话术'}</Button></>}>
    <form id="snippet-editor" className="space-y-4" onSubmit={event => { event.preventDefault(); void save().catch(() => undefined); }}><label className="block space-y-1.5 text-sm"><span>标题</span><Input aria-label="话术标题" value={title} required maxLength={100} onChange={event => setTitle(event.target.value)} /></label><label className="block space-y-1.5 text-sm"><span>分组</span><Select label="话术分组" value={groupId} options={groups.map(group => ({ value: group.id, label: group.name }))} onChange={setGroupId} /></label>
      <label className="block space-y-1.5 text-sm"><span>内容</span><Textarea ref={textarea} aria-label="话术内容" required className="min-h-48" value={body} onSelect={event => { selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onChange={event => { setBody(event.target.value); selection.current = { start: event.target.selectionStart, end: event.target.selectionEnd }; }} onKeyDown={event => { if (event.ctrlKey && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void save().catch(() => undefined); } }} /></label>
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-fg-2">插入变量</span><div role="group" aria-label="插入话术变量" className="flex flex-wrap gap-2">{snippetVariables.map(name => <Button key={name} size="sm" variant="soft" aria-label={`插入变量：${name}`} onMouseDown={event => event.preventDefault()} onClick={() => insertVariable(name)}>{`{${name}}`}</Button>)}</div></div>
      <p className="text-xs text-fg-2">在客户或项目里复制时自动填写变量 · Ctrl+Enter 快速保存</p></form>
  </Dialog>;
}
