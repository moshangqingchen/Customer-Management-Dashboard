import { useId } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyStats } from '../../lib/stats';
import { formatMoney } from '../../lib/money';
import { formatMonth } from '../../lib/dates';
import { Money } from '../ui';

export default function IncomeChart({ months }: { months: MonthlyStats[] }) {
  const gradient = useId().replace(/:/g, '');
  return <div className="min-w-0">
    <div className="mb-4 flex flex-wrap items-center gap-5 text-sm text-fg-2"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-primary-gradient" />实收</span><span className="flex items-center gap-2"><span className="h-0.5 w-4 bg-tile-mint-fg" />利润</span></div>
    <div className="h-72 min-w-0" role="img" aria-label={`近十二个月收入与利润：${months.map(month => `${month.month}实收${formatMoney(month.receivedCents)}，利润${formatMoney(month.profitCents)}`).join('；')}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 800, height: 288 }}><ComposedChart data={months} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <defs><linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="var(--gradient-start)" /><stop offset="100%" stopColor="var(--gradient-end)" /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tickFormatter={value => formatMonth(String(value))} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-2)', fontSize: 12 }} minTickGap={12} />
        <YAxis domain={[Math.min(0, ...months.map(month => month.profitCents)), 'auto']} width={62} tickFormatter={value => formatMoney(Number(value))} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-2)', fontSize: 11 }} />
        <Tooltip cursor={{ fill: 'var(--bg-hover)' }} content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-md border border-line bg-surface px-4 py-3 shadow-md"><p className="mb-2 text-sm font-medium">{formatMonth(String(label))}</p>{payload.map(entry => <div key={String(entry.dataKey)} className="flex min-w-40 justify-between gap-5 text-sm"><span className="text-fg-2">{entry.name}</span><Money cents={Number(entry.value)} className="font-semibold" /></div>)}</div> : null} />
        <Bar dataKey="receivedCents" name="实收" fill={`url(#${gradient})`} radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive={false} />
        <Line dataKey="profitCents" name="利润" type="monotone" stroke="var(--tile-mint-fg)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, stroke: 'var(--bg-surface)', strokeWidth: 2 }} isAnimationActive={false} />
      </ComposedChart></ResponsiveContainer>
    </div>
  </div>;
}
