import { formatMoney } from '../../lib/money';
import { metricChange, type IncomeStats } from '../../lib/stats';
import { Card } from '../ui/Surfaces';

const metrics = [
  { key: 'receivedCents', title: '实收' }, { key: 'outstandingCents', title: '当前待收' },
  { key: 'costCents', title: '成本', inverse: true }, { key: 'profitCents', title: '利润' },
  { key: 'dealCount', title: '成交项目数' }, { key: 'averageOrderCents', title: '客单价' },
] as const;

export function IncomeMetrics({ current, previous, pendingCount, allTime }: { current: IncomeStats; previous: IncomeStats; pendingCount: number; allTime: boolean }) {
  return <div className="income-stats-shell"><Card className="income-stats overflow-hidden">
    {metrics.map(metric => <div key={metric.key} role="group" aria-label={metric.title} className="income-metric min-w-0 px-4 py-4">
      <p className="text-sm text-fg-2">{metric.title}</p>
      <div className="mt-1 flex flex-col gap-0.5">
        <span className="income-metric-value font-semibold tabular-nums">{metric.key === 'dealCount' ? `${current[metric.key]} 个` : formatMoney(current[metric.key])}</span>
        <span className="text-xs text-fg-2">{metric.key === 'outstandingCents' ? `共 ${pendingCount} 个项目未收齐` : allTime ? '全部时间' : metricChange(current[metric.key], previous[metric.key], 'inverse' in metric && metric.inverse).label}</span>
      </div>
    </div>)}
  </Card></div>;
}
