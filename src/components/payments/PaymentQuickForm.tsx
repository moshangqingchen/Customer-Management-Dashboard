import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Payment, PaymentKind, Project } from '../../api/types';
import { useAddPayment, useSettings, useUpdatePayment, useUpdateSettings } from '../../hooks/queries';
import { outstanding, formatMoney } from '../../lib/money';
import { paymentOverage } from '../../lib/projectMoney';
import { today } from '../../lib/dates';
import { Button, ConfirmDialog, DateInput, Input, NumberInput, Select } from '../ui';

export function PaymentQuickForm({ project, payment, initialKind = 'income', onSaved, onCancel }: { project: Project; payment?: Payment; initialKind?: PaymentKind; onSaved?: () => void; onCancel?: () => void }) {
  const { data: settings } = useSettings(); const add = useAddPayment(); const update = useUpdatePayment(); const updateSettings = useUpdateSettings();
  const due = outstanding(project.priceCents, project.receivedCents, project.status);
  const [kind, setKind] = useState<PaymentKind>(payment?.kind ?? initialKind);
  const [amount, setAmount] = useState(payment?.amountCents ?? (initialKind === 'income' ? due : 0));
  const [date, setDate] = useState<string | null>(payment?.paidAt ?? today()); const [method, setMethod] = useState(payment?.method ?? '');
  const [note, setNote] = useState(payment?.note ?? ''); const [confirm, setConfirm] = useState(false); const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null); const pending = add.isPending || update.isPending;
  const excess = paymentOverage(project, { kind, amountCents: amount }, payment);
  async function save() {
    if (pending) return;
    if (amount <= 0 || !Number.isSafeInteger(amount) || !date || form.current?.querySelector('[aria-invalid="true"]')) { setError('请填写正数金额与有效日期'); return; }
    const selectedMethod = method || settings?.lastPaymentMethod || '微信';
    try {
      const input = { kind, amountCents: amount, paidAt: date, method: selectedMethod, note: note.trim() };
      if (payment) await update.mutateAsync({ id: payment.id, patch: input });
      else await add.mutateAsync({ projectId: project.id, ...input });
      updateSettings.mutate({ lastPaymentMethod: selectedMethod });
      toast.success(payment ? '已更新收款记录' : kind === 'refund' ? '已记录退款' : '已记录收款');
      setConfirm(false); setError(''); setAmount(0); setNote(''); onSaved?.();
    } catch { /* mutation hook reports the error */ }
  }
  function submit() {
    if (amount <= 0 || !date || form.current?.querySelector('[aria-invalid="true"]')) { setError('请填写正数金额与有效日期'); return; }
    if (excess > 0) setConfirm(true); else void save();
  }
  const methods = [...new Set([...(settings?.paymentMethods ?? ['微信']), settings?.lastPaymentMethod || '微信', method].filter(Boolean))];
  return <section className="rounded-lg border border-line bg-subtle/60 p-4">
    <form ref={form} className="space-y-3" onSubmit={event => { event.preventDefault(); submit(); }}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{payment ? '编辑收款记录' : kind === 'refund' ? '记一笔退款' : '记一笔收款'}</h3><div className="flex gap-1 rounded-full bg-surface p-1">{(['income', 'refund'] as const).map(value => <Button key={value} variant={kind === value ? 'soft' : 'ghost'} size="sm" aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'income' ? '收款' : '退款'}</Button>)}</div></div>
      <NumberInput value={amount} onChange={setAmount} aria-label="金额（元）" />
      <div className="grid grid-cols-2 gap-3"><DateInput value={date} onChange={setDate} label="收款日期" /><Select label="收款方式" value={method || settings?.lastPaymentMethod || '微信'} onChange={setMethod} options={methods.map(value => ({ value, label: value }))} /></div>
      <Input aria-label="收款备注" value={note} onChange={event => setNote(event.target.value)} placeholder="备注（可选）" />
      {error && <p role="alert" className="text-sm text-danger-fg">{error}</p>}
      <div className="flex gap-2"><Button type="submit" variant="primary" disabled={pending}>{pending ? '正在记录…' : payment ? '更新记录' : kind === 'refund' ? '记录退款' : '记录收款'}</Button>{onCancel && <Button variant="ghost" disabled={pending} onClick={onCancel}>取消</Button>}</div>
    </form>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="确认多收款" description={`将多收 ${formatMoney(excess)}，确定吗？`} onConfirm={save} confirmLabel="确认收款" danger={false} />
  </section>;
}
