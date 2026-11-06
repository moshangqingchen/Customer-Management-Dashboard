import { useState } from 'react';
import { toast } from 'sonner';
import type { Client } from '../../api/types';
import { useClients } from '../../hooks/queries';
import { useClientMergePreview, useCustomerManagementStates, useMergeClients } from '../../hooks/customerManagement';
import { useNav } from '../../stores/nav';
import { Button, Combobox, Dialog, Money, Skeleton } from '../ui';

export function MergeClientDialog({ source, onClose }: { source: Client; onClose: () => void }) {
  const [targetId, setTargetId] = useState(''); const [confirmedToken, setConfirmedToken] = useState<string | null>(null);
  const clients = useClients(); const management = useCustomerManagementStates(); const merge = useMergeClients();
  const preview = useClientMergePreview(source.id, targetId, true); const navigate = useNav(state => state.navigate);
  const archived = new Set((management.data ?? []).filter(item => item.archivedAt).map(item => item.clientId));
  const confirmed = !!preview.data && confirmedToken === preview.data.previewToken;
  async function submit() {
    if (!preview.data || !confirmed || merge.isPending) return;
    try {
      const target = await merge.mutateAsync({ sourceId: source.id, targetId, previewToken: preview.data.previewToken });
      toast.success(`已合并到「${target.name}」，文件保留原位置`); onClose(); navigate('clients', { clientId: target.id });
    } catch { setConfirmedToken(null); void preview.refetch(); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !merge.isPending) onClose(); }} title={`合并客户「${source.name}」`} description="选择保留的客户，核对预览后再确认。" className="max-w-2xl" footer={<><Button disabled={merge.isPending} onClick={onClose}>取消</Button><Button variant="primary" disabled={!confirmed || merge.isPending || preview.isFetching} onClick={() => void submit()}>{merge.isPending ? '正在合并…' : '确认合并'}</Button></>}>
    <div className="space-y-4"><label className="block space-y-2"><span className="font-medium">合并到</span><Combobox value={targetId} onChange={value => { setTargetId(value); setConfirmedToken(null); }} options={(clients.data ?? []).filter(client => client.id !== source.id).map(client => ({ value: client.id, label: `${client.name}${client.company ? ` · ${client.company}` : ''}${archived.has(client.id) ? '（已归档）' : ''}` }))} placeholder="搜索要保留的客户" /></label>
      {clients.isError && <p role="alert" className="text-danger-fg">{clients.error.message}<Button size="sm" onClick={() => void clients.refetch()}>重新加载</Button></p>}
      {!targetId ? <p className="text-sm text-fg-2">当前客户会并入目标客户；客户项目、收款、动态和跟进保留。合并不能通过回收站撤销。</p> : preview.isPending ? <Skeleton className="h-40" /> : preview.isError ? <div role="alert" className="space-y-2"><p className="text-danger-fg">{preview.error.message}</p><Button onClick={() => void preview.refetch()}>重新预览</Button></div> : <>
        <div className="rounded-md bg-subtle p-3 text-sm"><p className="font-medium">保留「{preview.data.target.name}」，并入「{preview.data.source.name}」</p><p className="mt-2">转入 {preview.data.projectCount} 个项目（含 {preview.data.deletedProjectCount} 个回收站项目）、{preview.data.paymentCount} 笔收款、{preview.data.activityCount} 条动态、{preview.data.followUpCount} 条跟进。</p><p className="mt-1">转入的有效项目实收 <Money cents={preview.data.source.receivedCents} />，待收 <Money cents={preview.data.source.outstandingCents} />。收款记录不会复制或重复累计。</p><p className="mt-1">新增 {preview.data.addedAccounts} 个平台账号，合并后保留 {preview.data.tagCount} 个标签。</p></div>
        <div className="space-y-2 text-sm"><p className="font-medium">资料处理</p><p className="text-fg-2">目标客户已有资料优先，空白项用来源资料补齐；来源备注和冲突资料会写入客户备注。</p>{preview.data.conflicts.length > 0 && <ul className="space-y-1">{preview.data.conflicts.map(conflict => <li key={conflict.field} className="break-words"><span className="font-medium">{conflict.label}：</span>保留「{conflict.targetValue}」，来源「{conflict.sourceValue}」记入备注</li>)}</ul>}<details><summary className="cursor-pointer text-primary">查看合并后的备注</summary><p className="mt-2 whitespace-pre-wrap break-words text-fg-2">{preview.data.mergedNotes}</p></details></div>
        <div className="space-y-1 text-sm"><p className="font-medium">文件位置</p><p className="text-fg-2">文件不会移动、覆盖或复制，以下原目录继续归目标客户管理。</p>{preview.data.folders.length ? <ul>{preview.data.folders.map(folder => <li key={folder} className="break-all">{folder}</li>)}</ul> : <p className="text-fg-2">来源客户还没有资料目录。</p>}</div>
        <label className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg p-3 text-sm"><input type="checkbox" checked={confirmed} disabled={merge.isPending || preview.isFetching} onChange={event => setConfirmedToken(event.target.checked ? preview.data?.previewToken ?? null : null)} className="mt-1 accent-primary" />我已核对，将「{source.name}」并入「{preview.data.target.name}」，保留目标客户并移除来源客户入口。</label>
      </>}
    </div>
  </Dialog>;
}
