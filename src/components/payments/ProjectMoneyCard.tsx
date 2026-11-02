import { useState } from 'react';
import { Pencil, Plus, RotateCcw, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { Payment, PaymentKind, Project } from '../../api/types';
import { useDeletePayment, usePayments, useUpdateProject } from '../../hooks/queries';
import { formatMoney, parseMoney } from '../../lib/money';
import { projectMoney } from '../../lib/projectMoney';
import { Button, Card, ConfirmDialog, IconButton, IconTile, InlineEdit, Money, PaymentBadge, ProgressBar, Skeleton } from '../ui';
import { PaymentQuickForm } from './PaymentQuickForm';

export function ProjectMoneyCard({ project, initialPayment = false }: { project: Project; initialPayment?: boolean }) {
  const payments = usePayments(project.id); const update = useUpdateProject(); const remove = useDeletePayment();
  const [form, setForm] = useState<PaymentKind | Payment | null>(initialPayment ? 'income' : null); const [deleting, setDeleting] = useState<Payment | null>(null);
  const summary = projectMoney(project);
  async function saveAmount(field: 'priceCents' | 'costCents', value: string) {
    const amount = parseMoney(value);
    if (amount === null || amount < 0) throw new Error('请输入非负金额，最多两位小数');
    await update.mutateAsync({ id: project.id, patch: { [field]: amount } });
  }
  return <Card className="space-y-4 p-5" aria-label="项目收款">
    <div className="flex items-center gap-3"><IconTile tone="mint" size="sm"><Wallet size={18} /></IconTile><h3 className="flex-1 text-lg font-semibold">项目收款</h3><PaymentBadge status={summary.paymentStatus} /></div>
    <dl className="grid grid-cols-3 gap-3 rounded-lg bg-subtle p-3"><div><dt className="text-xs text-fg-2">报价</dt><dd className="-ml-3 mt-1 font-semibold tabular-nums"><InlineEdit label="编辑项目报价" value={formatMoney(project.priceCents)} onSave={value => saveAmount('priceCents', value)} /></dd></div><div><dt className="text-xs text-fg-2">成本</dt><dd className="-ml-3 mt-1 font-semibold tabular-nums"><InlineEdit label="编辑项目成本" value={formatMoney(project.costCents)} onSave={value => saveAmount('costCents', value)} /></dd></div><div><dt className="text-xs text-fg-2">预计利润</dt><dd className="mt-3 font-semibold"><Money cents={summary.expectedProfitCents} color /></dd></div></dl>
    <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-fg-2">已收 <Money cents={project.receivedCents} className="font-semibold text-fg" /></span><span className="text-fg-2">待收 <Money cents={summary.outstandingCents} className="font-semibold text-primary" /></span></div><ProgressBar value={project.receivedCents} max={project.priceCents} /></div>
    <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">收款流水 <span className="text-fg-3">{payments.data?.length ?? project.paymentCount}</span></h4><div className="flex gap-1"><Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setForm('refund')}>退款</Button><Button size="sm" variant="soft" icon={<Plus size={14} />} onClick={() => setForm('income')}>记一笔</Button></div></div>
      {payments.isPending ? <Skeleton className="h-14" /> : payments.isError ? <div role="alert" className="flex items-center justify-between gap-2 text-sm text-danger-fg"><span>收款记录加载失败</span><Button size="sm" onClick={() => void payments.refetch()}>重试</Button></div> : !payments.data.length ? <p className="rounded-md bg-subtle px-3 py-4 text-center text-xs text-fg-2">还没有收款记录，收到款项后记一笔吧。</p> : <ul className="divide-y divide-line">{payments.data.map(payment => <li key={payment.id} className="group flex items-center gap-2 py-2"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-xs text-fg-2"><time>{payment.paidAt}</time><span>{payment.method || '其他'}</span>{payment.kind === 'refund' && <span className="text-danger-fg">退款</span>}</div>{payment.note && <p title={payment.note} className="mt-0.5 truncate text-xs text-fg-3">{payment.note}</p>}</div><Money cents={payment.kind === 'refund' ? -payment.amountCents : payment.amountCents} color className="text-sm font-medium" /><div className="flex shrink-0 gap-0.5"><IconButton size="sm" label={`编辑${payment.paidAt}收款`} onClick={() => setForm(payment)}><Pencil size={14} /></IconButton><IconButton size="sm" label={`删除${payment.paidAt}收款`} onClick={() => setDeleting(payment)}><Trash2 size={14} /></IconButton></div></li>)}</ul>}
    </div>
    {form && <PaymentQuickForm key={typeof form === 'string' ? form : form.id} project={project} payment={typeof form === 'string' ? undefined : form} initialKind={typeof form === 'string' ? form : form.kind} onSaved={() => setForm(null)} onCancel={() => setForm(null)} />}
    <ConfirmDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }} title="删除这笔收款记录？" description={deleting ? `${deleting.paidAt} · ${formatMoney(deleting.amountCents)}，删除后项目金额会重新计算。` : ''} onConfirm={async () => { if (deleting) { await remove.mutateAsync(deleting.id); toast.success('已删除收款记录'); } }} />
  </Card>;
}
