import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { InlineEdit } from '../ui/InlineEdit';
import { SortableList } from './SortableList';

export function StringListEditor({ label, values, onSave, pending = false, folders = false }: { label: string; values: string[]; onSave: (values: string[]) => Promise<unknown>; pending?: boolean; folders?: boolean }) {
  const [draft, setDraft] = useState('');
  function valid(value: string, previous?: string): boolean {
    if (!value) { toast.error('名称不能为空'); return false; }
    if (value !== previous && values.includes(value)) { toast.error('名称已存在'); return false; }
    if (folders && /[\\/:*?"<>|\u0000-\u001f]/.test(value)) { toast.error('文件夹名称不能包含路径分隔符或特殊字符'); return false; }
    return true;
  }
  async function add() { const value = draft.trim(); if (!valid(value)) return; await onSave([...values, value]); setDraft(''); }
  return <div className="space-y-3">
    {values.length > 0 ? <SortableList disabled={pending} items={values.map(value => ({ id: value, label: value }))} onReorder={next => { void onSave(next).catch(() => undefined); }} renderItem={value => <div className="flex min-w-0 items-center gap-2">
      <InlineEdit value={value} label={`编辑${label}：${value}`} className="min-w-0 flex-1 truncate" onSave={async next => { const name = next.trim(); if (!valid(name, value)) throw new Error('请使用有效且不重复的名称'); await onSave(values.map(item => item === value ? name : item)); }} />
      <IconButton label={`删除${label}：${value}`} disabled={pending} size="sm" onClick={() => { void onSave(values.filter(item => item !== value)).catch(() => undefined); }}><Trash2 size={15} /></IconButton>
    </div>} /> : <p className="py-3 text-sm text-fg-2">{folders ? '已关闭自动创建子文件夹。' : `还没有${label}，可以在下方添加。`}</p>}
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void add().catch(() => undefined); }}>
      <Input aria-label={`新${label}`} placeholder={`添加${label}…`} value={draft} onChange={event => setDraft(event.target.value)} disabled={pending} maxLength={80} />
      <Button type="submit" disabled={pending || !draft.trim()} icon={<Plus size={16} />}>添加</Button>
    </form>
  </div>;
}
