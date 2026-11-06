import type { DuplicateClient } from '../../lib/clientDuplicates';
import { Button } from '../ui';

export function DuplicateClientNotice({ matches, confirmed, onConfirm, onOpen }: {
  matches: DuplicateClient[]; confirmed: boolean; onConfirm: (value: boolean) => void; onOpen: (id: string) => void;
}) {
  if (!matches.length) return null;
  return <section aria-label="可能重复的客户" className="space-y-3 rounded-md border border-warning-border bg-warning-bg p-3">
    <p className="font-medium text-warning-fg">发现 {matches.length} 位可能重复的客户</p>
    <div className="max-h-40 divide-y divide-line overflow-y-auto">{matches.map(({ client, reasons }) => <div key={client.id} className="flex items-center gap-2 py-2">
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{client.name}{client.company ? ` · ${client.company}` : ''}</p><p className="text-xs text-fg-2">{reasons.join('、')}</p></div>
      <Button size="sm" variant="ghost" onClick={() => onOpen(client.id)}>查看已有客户</Button>
    </div>)}</div>
    <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => onConfirm(event.target.checked)} className="mt-1 accent-primary" />确认需要独立建档，仍然新建</label>
  </section>;
}
