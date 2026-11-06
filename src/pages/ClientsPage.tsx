import { useMemo, useState } from 'react';
import { Pin, Plus, Search } from 'lucide-react';
import { useClient, useClients, useTags } from '../hooks/queries';
import { useCustomerManagementStates } from '../hooks/customerManagement';
import { cn } from '../lib/cn';
import { activityDate, clientViewOptions, filterClientView, type ClientView } from '../lib/clients';
import { filterArchivedClients } from '../lib/clientArchive';
import { colorClasses } from '../lib/colors';
import { filterClients, sortClients, type ClientSort } from '../lib/filters';
import { useNav } from '../stores/nav';
import { useUI } from '../stores/ui';
import { ClientDetail } from '../components/client/ClientDetail';
import { ClientTags } from '../components/client/ClientTags';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar, Button, Card, EmptyState, Input, Money, Select, Skeleton, Tooltip } from '../components/ui';

type ClientPageView = ClientView | 'archived' | 'includingArchived';
const viewOptions = [...clientViewOptions.map(item => item.value === 'all' ? { ...item, label: '常用客户' } : item), { value: 'archived', label: '已归档' }, { value: 'includingArchived', label: '全部（含归档）' }];

export function ClientsPage() {
  const [query, setQuery] = useState(''); const [tagIds, setTagIds] = useState<string[]>([]); const [sort, setSort] = useState<ClientSort>('recent');
  const [view, setView] = useState<ClientPageView>('all');
  const clients = useClients(); const { data: tags = [] } = useTags(); const nav = useNav(); const route = nav.entries[nav.index];
  const management = useCustomerManagementStates();
  const create = useUI(state => state.setNewClientOpen);
  const visible = useMemo(() => {
    const scope = view === 'archived' ? 'archived' : view === 'includingArchived' ? 'all' : 'current';
    const scoped = filterArchivedClients(clients.data ?? [], management.data ?? [], scope);
    return sortClients(filterClientView(filterClients(scoped, query, tagIds), view === 'archived' || view === 'includingArchived' ? 'all' : view), sort);
  }, [clients.data, management.data, query, tagIds, sort, view]);
  const filtered = !!query || tagIds.length > 0 || view !== 'all';
  const onlyArchived = !filtered && !visible.length && (clients.data?.length ?? 0) > 0;
  const selectedId = route.params.clientId ?? visible[0]?.id; const selected = useClient(selectedId);
  return <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-6">
    <PageHeader title="客户" count={clients.data?.length ?? 0} actions={<Button variant="primary" onClick={() => create(true)}><Plus size={18} />新建客户</Button>} />
    <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] items-stretch gap-4">
      <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="shrink-0 space-y-2 border-b border-line p-3">
          <div className="relative"><Search size={16} className="pointer-events-none absolute top-3 left-3 text-fg-3" /><Input data-page-search aria-label="搜索客户" className="pl-9" placeholder="搜索客户…" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <Select label="客户快捷筛选" value={view} onChange={value => setView(value as ClientPageView)} options={viewOptions} />
          <div className="flex items-center gap-2"><Select label="客户排序" value={sort} onChange={value => setSort(value as ClientSort)} options={[{ value: 'recent', label: '最近动态' }, { value: 'received', label: '累计金额' }, { value: 'name', label: '名称' }, { value: 'createdAt', label: '创建时间' }]} /><ClientTags filter tags={tags} value={tagIds} onChange={setTagIds} /></div>
        </div>
        <div aria-label="客户列表" className="min-h-0 flex-1 overflow-y-auto p-1">
          {clients.isPending || management.isPending ? <div className="space-y-2 p-2">{[1, 2, 3, 4].map(value => <Skeleton key={value} className="h-[60px] w-full" />)}</div>
            : clients.isError ? <div role="alert" className="space-y-3 p-4"><p className="text-danger-fg">{clients.error.message}</p><Button onClick={() => void clients.refetch()}>重新加载</Button></div>
              : management.isError ? <div role="alert" className="space-y-3 p-4"><p className="text-danger-fg">无法读取客户归档状态</p><Button onClick={() => void management.refetch()}>重新加载</Button></div>
              : !visible.length ? <EmptyState illustrationName={filtered ? 'empty-search' : 'empty-clients'} title={onlyArchived ? '客户都已归档' : filtered ? '没有找到匹配客户' : '还没有客户'} description={onlyArchived ? '归档客户的项目、收款和文件仍然保留，可随时恢复。' : filtered ? '试试其他关键词或清除筛选。' : '从一个名字开始，记录接下来的每次合作。'} action={<Button onClick={() => { if (onlyArchived) setView('archived'); else if (filtered) { setQuery(''); setTagIds([]); setView('all'); } else create(true); }}>{onlyArchived ? '查看已归档客户' : filtered ? '清除筛选' : '新建客户'}</Button>} />
                : visible.map(client => <button key={client.id} type="button" data-drop-target={`client:${client.id}`} aria-current={client.id === selectedId ? 'true' : undefined} className={cn('flex h-[60px] w-full items-center gap-2 rounded-md px-2 text-left transition-colors transition-sky hover:bg-hover', client.id === selectedId && 'bg-active')} onClick={() => nav.navigate('clients', { clientId: client.id })}>
                  <Avatar id={client.id} name={client.name} className="size-8" />
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="min-w-0 truncate font-semibold">{client.name}</span>{client.pinned && <Pin size={12} className="shrink-0 text-fg-2" aria-label="置顶客户" />}<span className="ml-auto flex shrink-0 gap-1">{tags.filter(tag => client.tagIds.includes(tag.id)).slice(0, 3).map(tag => <Tooltip key={tag.id} content={tag.name}><span aria-label={tag.name} className={cn('inline-flex size-2 rounded-full', colorClasses[tag.color])}><span className="size-2 rounded-full bg-current" /></span></Tooltip>)}</span></div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-fg-2"><span className="whitespace-nowrap">{client.projectCount} 个项目 · <Money cents={client.receivedCents} /></span><span className="truncate text-fg-3" title="最近动态">{activityDate(client.lastActivityAt)}</span></div>
                  </div>
                </button>)}
        </div>
      </Card>
      <div aria-label="客户详情" className="min-h-0 min-w-0 overflow-y-auto">
        {selectedId ? selected.isPending ? <Card className="space-y-5 p-6"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></Card> : selected.isError ? <Card><EmptyState illustrationName="empty-clients" title="客户暂不可用" description="此客户可能已被删除，或暂时无法读取。" action={<Button onClick={() => void selected.refetch()}>重新加载</Button>} /></Card> : <ClientDetail key={selected.data.id} client={selected.data} /> : !clients.isPending && <Card><EmptyState illustrationName="empty-clients" title="选择一位客户，看看合作的故事" description="左侧选择客户，即可查看项目、联系方式和文件。" action={<Button onClick={() => create(true)}>新建客户</Button>} /></Card>}
      </div>
    </div>
  </div>;
}
