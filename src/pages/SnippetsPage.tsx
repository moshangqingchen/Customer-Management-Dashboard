import { useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Snippet } from '../api/types';
import { useDeleteSnippet, useMarkSnippetUsed, useSnippetGroups, useSnippets } from '../hooks/queries';
import { useCopy } from '../hooks/useCopy';
import { filterSnippets, hasSnippetVariables } from '../lib/snippets';
import { PageHeader } from '../components/layout/PageHeader';
import { SnippetEditor } from '../components/snippets/SnippetEditor';
import { SnippetGroups } from '../components/snippets/SnippetGroups';
import { Button, IconButton } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Dialog';
import { Tooltip } from '../components/ui/Tooltip';
import { Input } from '../components/ui/Input';
import { EmptyState, Skeleton } from '../components/ui/Surfaces';

function SnippetCard({ snippet, groupName, onEdit, onDelete }: { snippet: Snippet; groupName?: string; onEdit: () => void; onDelete: () => void }) {
  const clipboard = useCopy(); const used = useMarkSnippetUsed();
  async function copy() { if (await clipboard.copy(snippet.body, hasSnippetVariables(snippet.body) ? '已复制（含未填写的变量）' : '已复制')) used.mutate(snippet.id); }
  return <article className="group relative min-w-0 rounded-lg border border-line/70 bg-surface shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
    <Tooltip content={clipboard.copied ? '已复制' : '点击复制'}><button type="button" aria-label={`复制话术：${snippet.title}`} className="block h-full w-full rounded-lg p-5 text-left" onClick={() => { void copy(); }}>
      <h3 className="truncate pr-12 text-lg font-semibold" title={snippet.title}>{snippet.title}</h3>
      <p className="mt-2 line-clamp-3 min-h-[66px] whitespace-pre-wrap break-words text-sm leading-[22px] text-fg-2">{snippet.body}</p>
      {groupName && <span className="mt-3 block truncate text-xs text-fg-3">{groupName}</span>}
    </button></Tooltip>
    <div className="absolute top-4 right-3 flex rounded-md bg-surface opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><IconButton label={`编辑话术：${snippet.title}`} size="sm" onClick={onEdit}><Pencil size={15} /></IconButton><IconButton label={`删除话术：${snippet.title}`} size="sm" onClick={onDelete}><Trash2 size={15} /></IconButton></div>
  </article>;
}
export function SnippetsPage() {
  const groups = useSnippetGroups(); const snippets = useSnippets(); const remove = useDeleteSnippet(); const [selected, setSelected] = useState('all'); const [query, setQuery] = useState(''); const [editor, setEditor] = useState<Snippet | 'new'>(); const [deleting, setDeleting] = useState<Snippet>();
  const all = snippets.data ?? []; const search = query.trim().toLocaleLowerCase('zh-CN'); const current = groups.data?.find(group => group.id === selected);
  const visible = filterSnippets(all, selected, query);
  const createButton = <Button variant="primary" icon={<Plus size={17} />} disabled={!groups.data?.length} onClick={() => setEditor('new')}>新建话术</Button>;
  return <div className="space-y-4 p-6"><PageHeader title="话术" count={all.length} actions={<><div className="relative w-64"><Search size={17} className="absolute top-3 left-3 text-fg-3" /><Input aria-label="搜索话术" data-page-search placeholder="跨分组搜索话术…" className="pl-9" value={query} onChange={event => setQuery(event.target.value)} /></div>{createButton}</>} />
    {groups.isPending || snippets.isPending ? <div aria-label="话术加载中" className="grid grid-cols-3 gap-5">{[0, 1, 2].map(index => <Skeleton key={index} className="h-64" />)}</div> : groups.isError || snippets.isError ? <EmptyState illustrationName="empty-snippets" title="话术暂时读取失败" action={<Button onClick={() => { void groups.refetch(); void snippets.refetch(); }}>重新加载</Button>} /> : <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><SnippetGroups groups={groups.data} snippets={all} selected={selected} onSelect={id => { setSelected(id); setQuery(''); }} /><section className="min-w-0"><div className="mb-4 flex items-center gap-2"><h2 className="text-lg font-semibold">{search ? '搜索结果 · 全部分组' : current?.name ?? '全部话术'}</h2><span className="text-xs text-fg-2">{visible.length} 条</span></div>{visible.length ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">{visible.map(snippet => <SnippetCard key={snippet.id} snippet={snippet} groupName={selected === 'all' ? groups.data.find(group => group.id === snippet.groupId)?.name : undefined} onEdit={() => setEditor(snippet)} onDelete={() => setDeleting(snippet)} />)}</div> : <EmptyState illustrationName={search ? 'empty-search' : 'empty-snippets'} title={search ? '没有找到这条话术' : groups.data.length ? '把第一条好回复存下来' : '先为话术建一个分组吧'} description={search ? '试试标题或内容里的其他关键词。' : '报价、进度、交付，常用的话以后都能一键复制。'} action={search ? <Button onClick={() => setQuery('')}>清除搜索</Button> : groups.data.length ? <Button onClick={() => setEditor('new')}>新建话术</Button> : undefined} />}</section></div>}
    {editor && <SnippetEditor key={editor === 'new' ? `new:${selected}` : editor.id} groups={groups.data ?? []} snippet={editor === 'new' ? undefined : editor} defaultGroupId={current?.id ?? groups.data?.[0]?.id ?? ''} onClose={() => setEditor(undefined)} />}
    <ConfirmDialog open={!!deleting} onOpenChange={value => { if (!value) setDeleting(undefined); }} title="删除话术？" description={`「${deleting?.title ?? ''}」将被永久删除，无法撤销。`} onConfirm={async () => { if (deleting) await remove.mutateAsync(deleting.id); }} />
  </div>;
}
