import { useState } from 'react';
import { Merge, Plus, Tags, Trash2 } from 'lucide-react';
import type { Tag, TagColor } from '../../api/types';
import { useCreateTag, useDeleteTag, useMergeTags, useTags, useUpdateTag } from '../../hooks/queries';
import { colorClasses, colorNames, tagColors } from '../../lib/colors';
import { Button, IconButton } from '../ui/Button';
import { ConfirmDialog, Dialog } from '../ui/Dialog';
import { InlineEdit } from '../ui/InlineEdit';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Skeleton } from '../ui/Surfaces';
import { SettingsCard } from './SettingsCard';

const colors = tagColors.map(value => ({ value, label: <span className={`rounded-full px-2 py-0.5 ${colorClasses[value]}`}>{colorNames[value]}</span> }));
export function TagSettings() {
  const tags = useTags(); const create = useCreateTag(); const update = useUpdateTag(); const remove = useDeleteTag(); const merge = useMergeTags();
  const [name, setName] = useState(''); const [color, setColor] = useState<TagColor>('blue'); const [deleting, setDeleting] = useState<Tag>(); const [source, setSource] = useState<Tag>(); const [targetId, setTargetId] = useState('');
  async function add() { await create.mutateAsync({ name: name.trim(), color }); setName(''); }
  return <SettingsCard title="标签管理" description="客户与项目共用同一套标签。" icon={<Tags />} tone="mint">
    {tags.isPending ? <Skeleton className="h-24" /> : tags.isError ? <Button onClick={() => void tags.refetch()}>标签读取失败，重新加载</Button> : <div className="max-h-80 space-y-1 overflow-y-auto">{tags.data.map(tag => <div key={tag.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md py-1 hover:bg-hover">
      <div className="w-24"><Select value={tag.color} label={`标签颜色：${tag.name}`} options={colors} onChange={value => update.mutate({ id: tag.id, patch: { color: value as TagColor } })} /></div>
      <InlineEdit value={tag.name} label={`重命名标签：${tag.name}`} className="min-w-20 flex-1 truncate" onSave={value => update.mutateAsync({ id: tag.id, patch: { name: value.trim() } })} />
      <span className="text-xs text-fg-2 tabular-nums">{tag.clientCount} 客户 · {tag.projectCount} 项目</span>
      <IconButton label={`合并标签：${tag.name}`} size="sm" disabled={tags.data.length < 2} onClick={() => { setSource(tag); setTargetId(tags.data.find(item => item.id !== tag.id)?.id ?? ''); }}><Merge size={15} /></IconButton>
      <IconButton label={`删除标签：${tag.name}`} size="sm" onClick={() => setDeleting(tag)}><Trash2 size={15} /></IconButton>
    </div>)}{tags.data.length === 0 && <p className="py-4 text-sm text-fg-2">还没有标签，为项目添加一个好找的记号吧。</p>}</div>}
    <form className="mt-4 flex gap-2" onSubmit={event => { event.preventDefault(); void add().catch(() => undefined); }}><Input aria-label="新标签名称" placeholder="新标签名称" value={name} onChange={event => setName(event.target.value)} maxLength={50} /><div className="w-24 shrink-0"><Select label="新标签颜色" value={color} options={colors} onChange={value => setColor(value as TagColor)} /></div><Button type="submit" icon={<Plus size={16} />} disabled={!name.trim() || create.isPending}>添加</Button></form>
    <ConfirmDialog open={!!deleting} onOpenChange={value => { if (!value) setDeleting(undefined); }} title="删除标签？" description={`将从 ${deleting?.clientCount ?? 0} 位客户、${deleting?.projectCount ?? 0} 个项目中移除「${deleting?.name ?? ''}」，客户与项目本身会保留。`} onConfirm={async () => { if (deleting) await remove.mutateAsync(deleting.id); }} />
    <Dialog open={!!source} onOpenChange={value => { if (!value) setSource(undefined); }} title="合并标签" description={`「${source?.name ?? ''}」的所有客户与项目关联将转移到目标标签，随后删除原标签。`} footer={<><Button onClick={() => setSource(undefined)}>取消</Button><Button variant="primary" disabled={!targetId || merge.isPending} onClick={() => { if (source) void merge.mutateAsync({ sourceId: source.id, targetId }).then(() => setSource(undefined)).catch(() => undefined); }}>确认合并</Button></>}>
      <Select label="合并到标签" value={targetId} options={(tags.data ?? []).filter(tag => tag.id !== source?.id).map(tag => ({ value: tag.id, label: tag.name }))} onChange={setTargetId} />
    </Dialog>
  </SettingsCard>;
}
