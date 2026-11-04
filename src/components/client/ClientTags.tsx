import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Tag, TagColor } from '../../api/types';
import { cn } from '../../lib/cn';
import { colorClasses, colorNames, tagColors } from '../../lib/colors';
import { Button, Input, TagPill, Tooltip } from '../ui';

export function ClientTags({ tags, value, onChange, onCreate, filter = false }: {
  tags: Tag[]; value: string[]; onChange: (ids: string[]) => void;
  onCreate?: (name: string, color: TagColor) => Promise<Tag>; filter?: boolean;
}) {
  const [query, setQuery] = useState(''); const [color, setColor] = useState<TagColor>('blue'); const [pending, setPending] = useState(false);
  const selected = tags.filter(tag => value.includes(tag.id));
  const visible = tags.filter(tag => tag.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  async function create() {
    if (!onCreate || !query.trim() || pending) return;
    setPending(true);
    try { const tag = await onCreate(query.trim(), color); onChange([...new Set([...value, tag.id])]); setQuery(''); }
    catch (error) { toast.error(error instanceof Error ? error.message : '创建标签失败'); }
    finally { setPending(false); }
  }
  return <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', filter && 'shrink-0')}>
    {!filter && selected.map(tag => <TagPill key={tag.id} tag={tag} />)}
    <Popover.Root><Popover.Trigger asChild><Button variant={filter ? 'secondary' : 'ghost'} size="sm" className={cn(filter && 'h-[38px]')} aria-label={filter ? '按客户标签筛选' : '客户标签'}>{filter ? <Tags size={14} /> : <Plus size={14} />}标签{filter && value.length > 0 && <span className="tabular-nums">{value.length}</span>}{filter && <ChevronDown size={12} />}</Button></Popover.Trigger>
      <Popover.Portal><Popover.Content align="start" sideOffset={6} className="z-[80] w-72 rounded-lg border border-line bg-surface p-2 shadow-md">
        <Input maxLength={50} aria-label={filter ? '搜索客户筛选标签' : '搜索客户标签'} placeholder={onCreate ? '搜索或创建标签…' : '搜索标签…'} value={query} onChange={event => setQuery(event.target.value)} />
        <div className="mt-2 max-h-48 overflow-auto">{visible.map(tag => <button type="button" key={tag.id} role="checkbox" aria-checked={value.includes(tag.id)} aria-label={tag.name} className="flex min-h-9 w-full items-center gap-2 rounded-sm px-2 text-left hover:bg-hover" onClick={() => onChange(value.includes(tag.id) ? value.filter(id => id !== tag.id) : [...value, tag.id])}><span className="flex size-4 items-center justify-center rounded border border-line-strong">{value.includes(tag.id) && <Check size={12} />}</span><TagPill tag={tag} /></button>)}{!visible.length && <p className="py-3 text-center text-xs text-fg-2">没有匹配的标签</p>}</div>
        {filter && value.length > 0 && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => onChange([])}>清除标签筛选</Button>}
        {onCreate && <div className="mt-2 space-y-2 border-t border-line pt-2"><div className="flex flex-wrap gap-1" role="group" aria-label="标签颜色">{tagColors.map(item => <Tooltip key={item} content={colorNames[item]}><button type="button" aria-label={colorNames[item]} aria-pressed={color === item} className={cn('flex size-5 items-center justify-center rounded-full', colorClasses[item])} onClick={() => setColor(item)}>{color === item ? <Check size={12} /> : <span className="size-2 rounded-full bg-current" />}</button></Tooltip>)}</div><Button size="sm" className="w-full" disabled={!query.trim() || pending || tags.some(tag => tag.name === query.trim())} onClick={() => void create()}><Plus size={14} />{pending ? '正在创建…' : `创建标签${query.trim() ? `「${query.trim()}」` : ''}`}</Button></div>}
      </Popover.Content></Popover.Portal>
    </Popover.Root>
  </div>;
}
