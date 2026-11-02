import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check, Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Tag, TagColor } from '../../api/types';
import { colorClasses, colorNames, tagColors } from '../../lib/colors';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import { Input } from './Input';
import { TagPill } from './Badges';
import { Tooltip } from './Tooltip';

export function TagPicker({ tags, value, onChange, onCreate, label = '选择标签' }: { tags: Tag[]; value: string[]; onChange: (ids: string[]) => void; onCreate?: (name: string, color: TagColor) => Promise<Tag>; label?: string }) {
  const [search, setSearch] = useState(''); const [color, setColor] = useState<TagColor>('blue'); const [pending, setPending] = useState(false);
  const visible = tags.filter(tag => tag.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  async function create() {
    if (!onCreate || !search.trim() || pending) return; setPending(true);
    try { const tag = await onCreate(search.trim(), color); onChange([...new Set([...value, tag.id])]); setSearch(''); }
    catch (error) { toast.error(error instanceof Error ? error.message : '创建标签失败'); } finally { setPending(false); }
  }
  return <Popover.Root><Popover.Trigger asChild><Button className="h-auto min-h-[38px] w-full justify-start border-line bg-subtle py-1 font-normal focus:border-primary focus:bg-surface focus:ring-2 focus:ring-focus/40" aria-label={label} icon={<Tags size={16} className="text-fg-2" />}><span className="flex flex-wrap gap-1">{value.length ? tags.filter(tag => value.includes(tag.id)).map(tag => <TagPill key={tag.id} tag={tag} />) : <span className="text-fg-2">添加标签</span>}</span></Button></Popover.Trigger><Popover.Portal><Popover.Content align="start" sideOffset={6} className="z-[80] w-72 rounded-lg border border-line bg-surface p-2 shadow-md animate-pop"><Input aria-label="搜索标签" placeholder="搜索或创建标签…" value={search} onChange={event => setSearch(event.target.value)} /><div className="mt-2 max-h-48 overflow-auto">{visible.map(tag => <label key={tag.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-2 hover:bg-hover"><Checkbox.Root checked={value.includes(tag.id)} onCheckedChange={checked => onChange(checked ? [...value, tag.id] : value.filter(id => id !== tag.id))} aria-label={tag.name} className="flex size-4 items-center justify-center rounded border border-line-strong bg-surface data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg"><Checkbox.Indicator><Check size={12} /></Checkbox.Indicator></Checkbox.Root><TagPill tag={tag} /></label>)}{!visible.length && <p className="py-3 text-center text-xs text-fg-2">没有匹配的标签</p>}</div>{onCreate && <div className="mt-2 border-t border-line pt-2"><p className="mb-2 text-xs text-fg-2">新标签颜色</p><div className="flex flex-wrap gap-1" role="group" aria-label="标签颜色">{tagColors.map(item => <Tooltip key={item} content={colorNames[item]}><button type="button" aria-label={colorNames[item]} aria-pressed={color === item} onClick={() => setColor(item)} className={cn('flex size-5 items-center justify-center rounded-full', colorClasses[item])}>{color === item ? <Check size={12} /> : <span className="size-2 rounded-full bg-current" />}</button></Tooltip>)}</div><Button className="mt-2 w-full" size="sm" disabled={!search.trim() || pending || tags.some(tag => tag.name === search.trim())} onClick={() => void create()} icon={<Plus size={14} />}>{pending ? '正在创建…' : `创建标签${search.trim() ? `「${search.trim()}」` : ''}`}</Button></div>}</Popover.Content></Popover.Portal></Popover.Root>;
}
