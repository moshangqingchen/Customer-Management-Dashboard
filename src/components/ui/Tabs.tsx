import * as Primitive from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

export function Tabs({ value, onChange, items, label = '内容分类' }: { value: string; onChange: (value: string) => void; items: { value: string; label: ReactNode; content: ReactNode; disabled?: boolean }[]; label?: string }) {
  return <Primitive.Root value={value} onValueChange={onChange}><Primitive.List aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-subtle p-1">{items.map(item => <Primitive.Trigger key={item.value} value={item.value} disabled={item.disabled} className="rounded-full px-4 py-1.5 text-sm font-medium text-fg-2 transition-all transition-sky hover:text-fg data-[state=active]:bg-surface data-[state=active]:text-primary data-[state=active]:shadow-sm disabled:opacity-40">{item.label}</Primitive.Trigger>)}</Primitive.List>{items.map(item => <Primitive.Content key={item.value} value={item.value} className="pt-5">{item.content}</Primitive.Content>)}</Primitive.Root>;
}
