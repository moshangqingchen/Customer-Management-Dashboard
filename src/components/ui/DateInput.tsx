import * as Popover from '@radix-ui/react-popover';
import { CalendarDays } from 'lucide-react';
import { useId, useState } from 'react';
import { formatDateWithWeekday, quickDates, validDate } from '../../lib/dates';
import { Button } from './Button';
import { Input } from './Input';

export function DateInput({ value, onChange, label = '选择日期', disabled }: { value: string | null; onChange: (value: string | null) => void; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false); const id = useId();
  const choose = (date: string | null) => { onChange(date); setOpen(false); };
  return <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger asChild><Button disabled={disabled} className="w-full justify-start border-line bg-subtle text-fg-2 focus:border-primary focus:bg-surface focus:ring-2 focus:ring-focus/40" aria-label={label} icon={<CalendarDays size={16} />}>{value && validDate(value) ? formatDateWithWeekday(value) : '无截止日'}</Button></Popover.Trigger><Popover.Portal><Popover.Content align="start" sideOffset={6} className="z-[80] w-64 rounded-lg border border-line bg-surface p-2 shadow-md animate-pop"><div className="grid grid-cols-2 gap-1">{quickDates().map(date => <Button key={date.label} variant="ghost" className="justify-start" onClick={() => choose(date.value)}>{date.label}</Button>)}</div><div className="mt-2 border-t border-line pt-2"><label htmlFor={id} className="mb-1 block text-xs text-fg-2">自定义日期</label><Input id={id} type="date" value={value ?? ''} onChange={event => { if (validDate(event.target.value)) choose(event.target.value); }} /><Button variant="ghost" className="mt-1 w-full" onClick={() => choose(null)}>清除日期</Button></div></Popover.Content></Popover.Portal></Popover.Root>;
}
