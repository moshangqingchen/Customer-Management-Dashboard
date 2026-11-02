import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from './Button';
import { cn } from '../../lib/cn';

export interface ComboboxOption { value: string; label: string; keywords?: string[] }
export function Combobox({ value, onChange, options, onCreate, placeholder = '搜索并选择', label = '选择客户', disabled }: { value: string; onChange: (value: string) => void; options: ComboboxOption[]; onCreate?: (name: string) => Promise<string> | string; placeholder?: string; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState(''); const [pending, setPending] = useState(false);
  const selected = options.find(option => option.value === value);
  async function create() {
    if (!onCreate || !search.trim() || pending) return;
    setPending(true);
    try { onChange(await onCreate(search.trim())); setSearch(''); setOpen(false); }
    catch (error) { toast.error(error instanceof Error ? error.message : '创建失败'); }
    finally { setPending(false); }
  }
  return <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger asChild><Button disabled={disabled} role="combobox" aria-expanded={open} aria-label={label} className="w-full justify-between border-line bg-subtle font-normal focus:border-primary focus:bg-surface focus:ring-2 focus:ring-focus/40"><span className={cn('truncate', !selected && 'text-fg-2')}>{selected?.label ?? placeholder}</span><ChevronsUpDown size={14} className="text-fg-2" /></Button></Popover.Trigger><Popover.Portal><Popover.Content sideOffset={6} align="start" className="z-[80] w-[max(280px,var(--radix-popover-trigger-width))] overflow-hidden rounded-lg border border-line bg-surface shadow-md animate-pop"><Command label={label} onKeyDown={event => { if (event.key === 'Enter') event.stopPropagation(); }}><div className="flex items-center gap-2 border-b border-line px-3"><Search size={15} className="text-fg-2" /><Command.Input value={search} onValueChange={setSearch} placeholder="输入名称搜索…" className="h-11 w-full bg-transparent text-base outline-none" /></div><Command.List label="选项" className="max-h-64 overflow-auto p-1"><Command.Empty className="px-3 py-5 text-center text-xs text-fg-2">没有匹配的选项</Command.Empty>{options.map(option => <Command.Item key={option.value} value={`${option.label} ${option.value}`} keywords={option.keywords} onSelect={() => { onChange(option.value); setOpen(false); setSearch(''); }} className="flex min-h-9 items-center justify-between rounded-sm px-2 text-sm">{option.label}{value === option.value && <Check size={14} />}</Command.Item>)}{onCreate && search.trim() && !options.some(option => option.label === search.trim()) && <Command.Item value={`创建 ${search}`} onSelect={() => void create()} disabled={pending} className="flex min-h-9 items-center gap-2 rounded-sm border-t border-line px-2 text-accent"><Plus size={14} />{pending ? '正在创建…' : `创建「${search.trim()}」`}</Command.Item>}</Command.List></Command></Popover.Content></Popover.Portal></Popover.Root>;
}
