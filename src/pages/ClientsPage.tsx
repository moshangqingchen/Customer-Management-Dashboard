import { useMemo, useState } from 'react';
import { Plus, Search, Star } from 'lucide-react';
import { useClient, useClients, useTags } from '../hooks/queries';
import { cn } from '../lib/cn';
import { cooperationDate } from '../lib/clients';
import { filterClients, sortClients, type ClientSort } from '../lib/filters';
import { useNav } from '../stores/nav';
import { useUI } from '../stores/ui';
import { ClientDetail } from '../components/client/ClientDetail';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar, Button, Card, EmptyState, Input, Money, Select, Skeleton, TagPicker, TagPill } from '../components/ui';

export function ClientsPage() {
  const [query, setQuery] = useState(''); const [tagIds, setTagIds] = useState<string[]>([]); const [sort, setSort] = useState<ClientSort>('recent');
  const clients = useClients(); const { data: tags = [] } = useTags(); const nav = useNav(); const route = nav.entries[nav.index];
  const create = useUI(state => state.setNewClientOpen);
  const visible = useMemo(() => sortClients(filterClients(clients.data ?? [], query, tagIds), sort), [clients.data, query, tagIds, sort]);
  const selectedId = route.params.clientId ?? visible[0]?.id; const selected = useClient(selectedId);
  return <div className="space-y-6 p-7"><PageHeader title="客户" count={clients.data?.length ?? 0} description="每一次好合作，都值得被记住。" actions={<Button variant="primary" onClick={() => create(true)}><Plus size={18} />新建客户</Button>} />
    <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]"><Card className="min-w-0 overflow-hidden"><div className="space-y-3 border-b border-line p-4"><div className="relative"><Search size={16} className="pointer-events-none absolute top-3 left-3 text-fg-3" /><Input data-page-search aria-label="搜索客户" className="pl-9" placeholder="搜索姓名、电话、微信、备注…" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <Select label="客户排序" value={sort} onChange={value => setSort(value as ClientSort)} options={[{ value: 'recent', label: '最近合作' }, { value: 'received', label: '累计金额' }, { value: 'name', label: '名称' }, { value: 'createdAt', label: '创建时间' }]} />
      <TagPicker label="按客户标签筛选" tags={tags} value={tagIds} onChange={setTagIds} />{tagIds.length > 0 && <Button variant="ghost" size="sm" onClick={() => setTagIds([])}>清除标签筛选</Button>}</div>
      <div className="max-h-[calc(100dvh-330px)] overflow-y-auto p-2">{clients.isPending ? <div className="space-y-3 p-3">{[1, 2, 3, 4].map(value => <Skeleton key={value} className="h-20 w-full" />)}</div> : clients.isError ? <div role="alert" className="space-y-3 p-4"><p className="text-danger-fg">{clients.error.message}</p><Button onClick={() => void clients.refetch()}>重新加载</Button></div> : !visible.length ? <EmptyState illustrationName={query || tagIds.length ? 'empty-search' : 'empty-clients'} title={query || tagIds.length ? '没有找到匹配客户' : '还没有客户'} description={query || tagIds.length ? '试试其他关键词或清除标签筛选。' : '从一个名字开始，记录接下来的每次合作。'} action={<Button onClick={() => { if (query || tagIds.length) { setQuery(''); setTagIds([]); } else create(true); }}>{query || tagIds.length ? '清除筛选' : '新建客户'}</Button>} /> : visible.map(client => <button key={client.id} type="button" aria-current={client.id === selectedId ? 'true' : undefined} className={cn('flex w-full items-start gap-3 rounded-md p-3 text-left transition-colors transition-sky hover:bg-hover', client.id === selectedId && 'bg-active')} onClick={() => nav.navigate('clients', { clientId: client.id })}>
        <Avatar id={client.id} name={client.name} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-semibold">{client.name}</span>{client.pinned && <Star size={13} className="shrink-0 fill-current text-warning-fg" aria-label="星标客户" />}</div><p className="mt-1 text-xs text-fg-2">{client.projectCount} 个项目 · <Money cents={client.receivedCents} /></p><div className="mt-1.5 flex items-center gap-1">{tags.filter(tag => client.tagIds.includes(tag.id)).slice(0, 2).map(tag => <TagPill key={tag.id} tag={tag} />)}</div><p className="mt-1.5 text-xs text-fg-3">{client.firstProjectAt ? `${cooperationDate(client.lastActivityAt)}合作` : '暂无合作项目'}</p></div>
      </button>)}</div></Card>
      <div className="min-w-0">{selectedId ? selected.isPending ? <Card className="space-y-5 p-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></Card> : selected.isError ? <Card><EmptyState illustrationName="empty-clients" title="客户暂不可用" description="此客户可能已被删除，或暂时无法读取。" action={<Button onClick={() => void selected.refetch()}>重新加载</Button>} /></Card> : <ClientDetail key={selected.data.id} client={selected.data} /> : !clients.isPending && <Card><EmptyState illustrationName="empty-clients" title="选择一位客户，看看合作的故事" description="左侧选择客户，即可查看项目、联系方式和文件。" action={<Button variant="primary" onClick={() => create(true)}>新建客户</Button>} /></Card>}</div>
    </div>
  </div>;
}
