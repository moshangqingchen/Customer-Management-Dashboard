import { useState } from 'react';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import type { Snippet, SnippetGroup } from '../../api/types';
import { useCreateSnippetGroup, useDeleteSnippetGroup, useReorderSnippetGroups, useUpdateSnippetGroup } from '../../hooks/queries';
import { cn } from '../../lib/cn';
import { snippetGroupCount } from '../../lib/snippets';
import { Button, IconButton } from '../ui/Button';
import { ConfirmDialog } from '../ui/Dialog';
import { InlineEdit } from '../ui/InlineEdit';
import { Input } from '../ui/Input';
import { SortableList } from '../settings/SortableList';

export function SnippetGroups({ groups, snippets, selected, onSelect }: { groups: SnippetGroup[]; snippets: Snippet[]; selected: string; onSelect: (id: string) => void }) {
  const create = useCreateSnippetGroup(); const update = useUpdateSnippetGroup(); const remove = useDeleteSnippetGroup(); const reorder = useReorderSnippetGroups(); const [name, setName] = useState(''); const [adding, setAdding] = useState(false); const [deleting, setDeleting] = useState<SnippetGroup>();
  async function add() { if (!name.trim()) return; const group = await create.mutateAsync(name.trim()); setName(''); setAdding(false); onSelect(group.id); }
  return <aside className="min-w-0 space-y-3 rounded-lg border border-line/70 bg-surface p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">话术分组</h2><IconButton label="新建分组" size="sm" onClick={() => setAdding(!adding)}><Plus size={17} /></IconButton></div>
    <button type="button" onClick={() => onSelect('all')} className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm hover:bg-hover', selected === 'all' && 'bg-primary-soft font-medium text-primary')}><MessageSquare size={16} /><span className="flex-1">全部话术</span><span className="text-xs tabular-nums">{snippets.length}</span></button>
    <SortableList items={groups.map(group => ({ id: group.id, label: group.name }))} disabled={reorder.isPending} onReorder={ids => reorder.mutate(ids)} renderItem={id => { const group = groups.find(item => item.id === id)!; return <div className={cn('group flex min-w-0 items-center gap-1 rounded-md', selected === id && 'bg-primary-soft text-primary')}><button type="button" aria-label={`选择分组：${group.name}`} title={group.name} onClick={() => onSelect(id)} className="min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-sm hover:bg-hover">{group.name}</button><span className="text-xs text-fg-2 tabular-nums">{snippetGroupCount(snippets, id)}</span><IconButton label={`删除分组：${group.name}`} size="sm" className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" onClick={() => setDeleting(group)}><Trash2 size={14} /></IconButton></div>; }} />
    {selected !== 'all' && groups.some(group => group.id === selected) && <div className="border-t border-line pt-3"><InlineEdit key={selected} value={groups.find(group => group.id === selected)?.name ?? ''} label="重命名当前分组" className="w-full truncate text-sm" onSave={next => update.mutateAsync({ id: selected, patch: { name: next.trim() } })} /></div>}
    {adding && <form className="space-y-2 border-t border-line pt-3" onSubmit={event => { event.preventDefault(); void add().catch(() => undefined); }}><Input autoFocus aria-label="分组名称" placeholder="新分组名称" value={name} maxLength={40} onChange={event => setName(event.target.value)} /><Button type="submit" variant="soft" size="sm" className="w-full" disabled={!name.trim() || create.isPending}>创建分组</Button></form>}
    <ConfirmDialog open={!!deleting} onOpenChange={value => { if (!value) setDeleting(undefined); }} title="删除话术分组？" description={`「${deleting?.name ?? ''}」及其中 ${snippetGroupCount(snippets, deleting?.id ?? '')} 条话术将被永久删除，无法撤销。`} onConfirm={async () => { if (deleting) { await remove.mutateAsync(deleting.id); if (selected === deleting.id) onSelect('all'); } }} />
  </aside>;
}
