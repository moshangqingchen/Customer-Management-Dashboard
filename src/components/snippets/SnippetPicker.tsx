import { useRef, useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import type { Snippet } from '../../api/types';
import { useMarkSnippetUsed, useSnippetGroups, useSnippets } from '../../hooks/queries';
import { useCopy } from '../../hooks/useCopy';
import { fillSnippet, filterSnippets, hasSnippetVariables, type SnippetContext } from '../../lib/snippets';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState, Skeleton } from '../ui/Surfaces';

export function SnippetPicker({ context }: { context: SnippetContext }) {
  const [open, setOpen] = useState(false);
  return <><Button variant="ghost" size="sm" title="选择话术并填入当前信息" onClick={() => setOpen(true)} icon={<MessageSquare size={16} />}>话术</Button>
    {open && <SnippetPickerDialog context={context} onClose={() => setOpen(false)} />}
  </>;
}

function SnippetPickerDialog({ context, onClose }: { context: SnippetContext; onClose: () => void }) {
  const [query, setQuery] = useState(''); const groups = useSnippetGroups(); const snippets = useSnippets();
  const used = useMarkSnippetUsed(); const clipboard = useCopy();
  const copying = useRef(false);
  const visible = filterSnippets(snippets.data ?? [], 'all', query);
  async function copy(snippet: Snippet) {
    if (copying.current) return;
    copying.current = true;
    const filled = fillSnippet(snippet.body, context);
    const firstLine = filled.split(/\r?\n/).find(line => line.trim()) ?? filled;
    const message = `${hasSnippetVariables(filled) ? '已复制（含未填写的变量）' : '已复制'}：${firstLine}`;
    try { if (await clipboard.copy(filled, message)) { used.mutate(snippet.id); onClose(); } }
    finally { copying.current = false; }
  }
  return <Dialog open onOpenChange={value => { if (!value) onClose(); }} title="选择话术" description="点击话术，会填入当前客户和项目的信息后复制。">
    <div className="relative mb-4"><Search size={17} className="pointer-events-none absolute top-3 left-3 text-fg-3" /><Input aria-label="搜索可用话术" placeholder="搜索标题或内容…" value={query} onChange={event => setQuery(event.target.value)} className="pl-9" /></div>
    {groups.isPending || snippets.isPending ? <div className="space-y-3" aria-label="正在加载话术"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      : groups.isError || snippets.isError ? <p role="alert" className="text-sm text-danger-fg">话术暂时读取失败，请稍后重试。</p>
        : visible.length ? <div className="space-y-5">{groups.data.map(group => {
          const items = visible.filter(snippet => snippet.groupId === group.id);
          return items.length ? <section key={group.id} aria-label={group.name}><h3 className="mb-2 text-xs font-medium text-fg-2">{group.name}</h3><div className="space-y-2">{items.map(snippet => <button key={snippet.id} type="button" aria-label={`使用话术：${snippet.title}`} className="block w-full rounded-lg border border-line bg-subtle p-3 text-left hover:border-primary hover:bg-primary-soft" onClick={() => { void copy(snippet); }}><span className="block text-sm font-semibold">{snippet.title}</span><span className="mt-1 block line-clamp-2 whitespace-pre-wrap break-words text-xs text-fg-2">{fillSnippet(snippet.body, context)}</span></button>)}</div></section> : null;
        })}</div> : <EmptyState illustrationName="empty-snippets" title={query ? '没有找到相关话术' : '还没有话术'} description="可以到话术页保存常用回复。" />}
  </Dialog>;
}
