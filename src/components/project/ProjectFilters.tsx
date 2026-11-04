import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Client, Settings, Tag } from '../../api/types';
import type { ProjectFilters as Filters, ProjectSort } from '../../lib/filters';
import { statusMeta, statuses } from '../../lib/status';
import { Button, Select } from '../ui';

const paymentLabels = { unpaid: '未收', partial: '部分收款', paid: '已收清', over: '多收' } as const;
const dueLabels = { attention: '需要关注', overdue: '逾期', week: '本周', month: '本月', none: '无截止日' } as const;
export function ProjectFilters({ filters, onChange, sort, onSort, tags, clients, settings, quickViews }: {
  filters: Filters; onChange: (filters: Filters) => void; sort: ProjectSort; onSort: (value: ProjectSort) => void; tags: Tag[]; clients: Client[]; settings?: Settings; quickViews?: ReactNode;
}) {
  const patch = (next: Partial<Filters>) => onChange({ ...filters, ...next });
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(filters.statuses ?? []).map(status => ({ key: status, label: statusMeta[status].label, remove: () => patch({ statuses: filters.statuses?.filter(item => item !== status) }) })),
    ...(filters.tagIds ?? []).map(id => ({ key: id, label: tags.find(tag => tag.id === id)?.name ?? '标签', remove: () => patch({ tagIds: filters.tagIds?.filter(item => item !== id) }) })),
    ...(filters.clientId ? [{ key: 'client', label: clients.find(client => client.id === filters.clientId)?.name ?? '客户', remove: () => patch({ clientId: undefined }) }] : []),
    ...(filters.paymentStatus ? [{ key: 'payment', label: paymentLabels[filters.paymentStatus], remove: () => patch({ paymentStatus: undefined }) }] : []),
    ...(filters.due ? [{ key: 'due', label: dueLabels[filters.due], remove: () => patch({ due: undefined }) }] : []),
    ...(filters.sourcePlatform ? [{ key: 'source', label: filters.sourcePlatform, remove: () => patch({ sourcePlatform: undefined }) }] : []),
    ...(filters.pinned ? [{ key: 'pinned', label: '置顶', remove: () => patch({ pinned: undefined }) }] : []),
    ...(filters.outstanding ? [{ key: 'outstanding', label: '待收款', remove: () => patch({ outstanding: undefined }) }] : []),
  ];
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      {quickViews}<div className="ml-auto flex flex-wrap items-center gap-2">
      <Popover.Root><Popover.Trigger asChild><Button size="sm" aria-label="筛选项目状态">{filters.statuses?.length ? `状态 · ${filters.statuses.length}` : '状态'}<ChevronDown size={14} /></Button></Popover.Trigger><Popover.Portal><Popover.Content align="start" sideOffset={6} className="z-[80] min-w-40 rounded-lg border border-line bg-surface p-2 shadow-md">{statuses.map(status => <label key={status} className="flex cursor-pointer items-center gap-2 rounded-sm p-2 hover:bg-hover"><input type="checkbox" checked={filters.statuses?.includes(status) ?? false} onChange={event => patch({ statuses: event.target.checked ? [...(filters.statuses ?? []), status] : filters.statuses?.filter(item => item !== status) })} />{statusMeta[status].label}</label>)}</Popover.Content></Popover.Portal></Popover.Root>
      <Popover.Root><Popover.Trigger asChild><Button size="sm" aria-label="筛选项目标签">标签{filters.tagIds?.length ? ` · ${filters.tagIds.length}` : ''}<ChevronDown size={14} /></Button></Popover.Trigger><Popover.Portal><Popover.Content align="start" sideOffset={6} className="z-[80] max-h-72 min-w-40 overflow-auto rounded-lg border border-line bg-surface p-2 shadow-md">{tags.map(tag => <label key={tag.id} className="flex cursor-pointer items-center gap-2 rounded-sm p-2 hover:bg-hover"><input type="checkbox" checked={filters.tagIds?.includes(tag.id) ?? false} onChange={event => patch({ tagIds: event.target.checked ? [...(filters.tagIds ?? []), tag.id] : filters.tagIds?.filter(id => id !== tag.id) })} />{tag.name}</label>)}</Popover.Content></Popover.Portal></Popover.Root>
      <div className="w-28"><Select className="h-8 text-sm" label="筛选客户" value={filters.clientId ?? 'all'} onChange={value => patch({ clientId: value === 'all' ? undefined : value })} options={[{ value: 'all', label: '客户' }, ...clients.map(client => ({ value: client.id, label: client.name }))]} /></div>
      <Popover.Root><Popover.Trigger asChild><Button size="sm" aria-label="更多筛选">更多筛选<ChevronDown size={14} /></Button></Popover.Trigger><Popover.Portal><Popover.Content align="end" sideOffset={6} className="z-[80] w-64 space-y-3 rounded-lg border border-line bg-surface p-3 shadow-md">
        <label className="block space-y-1 text-xs text-fg-2"><span>收款状态</span><Select label="筛选收款状态" value={filters.paymentStatus ?? 'all'} onChange={value => patch({ paymentStatus: value === 'all' ? undefined : value as Filters['paymentStatus'] })} options={[{ value: 'all', label: '全部收款状态' }, ...Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))]} /></label>
        <label className="block space-y-1 text-xs text-fg-2"><span>截止日</span><Select label="筛选截止日" value={filters.due ?? 'all'} onChange={value => patch({ due: value === 'all' ? undefined : value as Filters['due'] })} options={[{ value: 'all', label: '全部截止日' }, ...Object.entries(dueLabels).map(([value, label]) => ({ value, label }))]} /></label>
        <label className="block space-y-1 text-xs text-fg-2"><span>来源平台</span><Select label="筛选来源平台" value={filters.sourcePlatform ?? 'all'} onChange={value => patch({ sourcePlatform: value === 'all' ? undefined : value })} options={[{ value: 'all', label: '全部来源平台' }, ...(settings?.sourcePlatforms ?? []).map(value => ({ value, label: value }))]} /></label>
      </Popover.Content></Popover.Portal></Popover.Root>
      <div className="w-36"><Select className="h-8 text-sm" label="项目排序" value={sort} onChange={value => onSort(value as ProjectSort)} options={[{ value: 'smart', label: '智能排序' }, { value: 'dueDate', label: '按截止日排序' }, { value: 'updatedAt', label: '最近更新' }, { value: 'price', label: '金额从高到低' }, { value: 'createdAt', label: '最新创建' }]} /></div>
      </div>
    </div>
    {chips.length > 0 && <div aria-label="已选筛选" className="flex flex-wrap items-center gap-2">{chips.map(chip => <button key={chip.key} type="button" onClick={chip.remove} aria-label={`移除筛选：${chip.label}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs text-accent"><Check size={12} />{chip.label}<X size={12} /></button>)}<Button size="sm" variant="ghost" onClick={() => onChange({ query: filters.query })}>清除筛选</Button></div>}
  </div>;
}
