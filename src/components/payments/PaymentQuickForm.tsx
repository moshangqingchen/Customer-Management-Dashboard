import { useState } from 'react';
import { toast } from 'sonner';
import type { Project } from '../../api/types';
import { useAddPayment, useSettings, useUpdateSettings } from '../../hooks/queries';
import { outstanding, formatMoney } from '../../lib/money';
import { today } from '../../lib/dates';
import { Button, ConfirmDialog, DateInput, Input, NumberInput, Select } from '../ui';

export function PaymentQuickForm({ project }: { project: Project }) {
  const { data: settings } = useSettings(); const add = useAddPayment(); const update = useUpdateSettings();
  const due = outstanding(project.priceCents, project.receivedCents, project.status);
  const [amount, setAmount] = useState(due); const [date, setDate] = useState<string | null>(today()); const [method, setMethod] = useState('');
  const [note, setNote] = useState(''); const [confirm, setConfirm] = useState(false); const [error, setError] = useState('');
  async function save() {
    if (amount <= 0 || !date) { setError('请填写正数金额与收款日期'); return; }
    const selectedMethod = method || settings?.lastPaymentMethod || '微信';
    try { await add.mutateAsync({ projectId: project.id, amountCents: amount, paidAt: date, method: selectedMethod, note }); update.mutate({ lastPaymentMethod: selectedMethod }); toast.success('已记录收款'); setConfirm(false); setError(''); setAmount(0); }
    catch { /* mutation cache reports the server error */ }
  }
  return <section className="space-y-3 rounded-lg border border-line p-4"><h3 className="font-medium">记一笔收款</h3><div role="group" aria-label="收款金额"><NumberInput value={amount} onChange={setAmount} /></div>
    <div className="grid grid-cols-2 gap-3"><DateInput value={date} onChange={setDate} /><Select value={method || settings?.lastPaymentMethod || '微信'} onChange={setMethod} options={(settings?.paymentMethods ?? ['微信']).map(value => ({ value, label: value }))} /></div>
    <Input aria-label="收款备注" value={note} onChange={e => setNote(e.target.value)} placeholder="备注（可选）" />{error && <p role="alert" className="text-danger-fg">{error}</p>}
    <Button variant="primary" disabled={add.isPending} onClick={() => { if (amount > due) setConfirm(true); else void save(); }}>记录收款</Button>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="确认多收款" description={`将多收 ${formatMoney(amount - due)}，确定吗？`} onConfirm={save} confirmLabel="确认收款" danger={false} />
  </section>;
}
