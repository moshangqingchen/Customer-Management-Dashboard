import { useFollowUps } from '../../hooks/followUps';
import { followUpsForToday, isFollowUpDue } from '../../lib/followUps';
import { formatDateTime } from '../../lib/dates';
import { useNav } from '../../stores/nav';
import { Button, Skeleton } from '../ui';

export function TodayFollowUps() {
  const query = useFollowUps({ status: 'pending' }, true); const navigate = useNav(state => state.navigate);
  const [expanded, setExpanded] = useState(false);
  const now = query.dataUpdatedAt || Date.now();
  const items = followUpsForToday(query.data ?? [], new Date(now));
  const visible = expanded ? items : items.slice(0, 5);
  return <section aria-label="今日客户跟进" className="rounded-lg border border-line bg-surface p-4 shadow-sm"><h2 className="mb-3 flex items-center justify-between text-base font-semibold">客户跟进 <span className="text-sm text-fg-2">{items.length}</span></h2>
    {query.isPending ? <Skeleton className="h-20" /> : query.isError ? <div className="text-sm text-danger-fg">跟进计划暂不可用<Button size="sm" onClick={() => void query.refetch()}>重试</Button></div> : !items.length ? <p className="text-sm text-fg-2">今天没有到期的客户跟进。</p> : <ul className="divide-y divide-line">{visible.map(item => <li key={item.id}><button type="button" className="w-full space-y-1 rounded-sm px-1 py-3 text-left hover:bg-hover" onClick={() => navigate('clients', { clientId: item.clientId, clientTab: 'followups' })}><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-xs text-fg-2">{item.clientName}{item.projectTitle ? ` · ${item.projectTitle}` : ''}</p><p className={`text-xs ${isFollowUpDue(item, now) ? 'text-danger-fg' : 'text-fg-2'}`}>{formatDateTime(item.dueAt)} · {!item.projectAvailable ? '关联项目不可用，提醒暂停' : isFollowUpDue(item, now) ? '已到期，待跟进' : '今日计划'}</p></button></li>)}</ul>}
    {items.length > 5 && <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => setExpanded(value => !value)}>{expanded ? '收起' : `展开全部 ${items.length} 条跟进`}</Button>}
    <p className="mt-2 text-xs text-fg-3">到期提醒仅在应用开启时生效。</p>
  </section>;
}
import { useState } from 'react';
