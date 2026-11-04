import { CheckCheck, Plus } from 'lucide-react';
import type { Project } from '../../api/types';
import { projectMoney } from '../../lib/projectMoney';
import { Button, Money, ProgressBar } from '../ui';

export function ProjectMoneySummary({ project, onPayment, onComplete, completing }: { project: Project; onPayment: () => void; onComplete: () => void; completing: boolean }) {
  const summary = projectMoney(project);
  return <div aria-label="项目金额汇总" className="space-y-2 border-y border-line py-3">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-2"><span>报价 <Money cents={project.priceCents} className="font-semibold text-fg" /></span><span>已收 <Money cents={project.receivedCents} className="font-semibold text-fg" /></span><span>待收 <Money cents={summary.outstandingCents} className="font-semibold text-fg" /></span></div><Button size="sm" variant="soft" icon={<Plus size={14} />} onClick={onPayment}>记一笔</Button>{summary.canComplete && <Button size="sm" variant="ghost" title="已交付且已收清，可以标记完成" icon={<CheckCheck size={14} />} disabled={completing} onClick={onComplete}>标记完成</Button>}</div>
    <ProgressBar value={project.receivedCents} max={project.priceCents} />
  </div>;
}
