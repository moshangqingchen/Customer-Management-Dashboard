import { useId } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyStats } from '../../lib/stats';
import { formatMoney } from '../../lib/money';
import { Money } from '../ui/Badges';

export default function TodayIncomeChart({ months }: { months: MonthlyStats[] }) {
  const gradient = useId().replace(/:/g, '');
  return <div className="h-[174px] min-w-0" role="img" aria-label={`近六个月收入：${months.map(m => `${m.month} ${formatMoney(m.receivedCents)}`).join('，')}`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 380, height: 174 }}><BarChart data={months} margin={{ top: 16, right: 0, bottom: 0, left: -16 }}>
      <defs><linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="var(--gradient-start)" /><stop offset="100%" stopColor="var(--gradient-end)" /></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="month" tickFormatter={v => `${Number(String(v).slice(5))}月`} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-2)', fontSize: 12 }} />
      <YAxis tickFormatter={v => `${Number(v) / 100}`} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-3)', fontSize: 11 }} width={54} />
      <Tooltip cursor={{ fill: 'var(--bg-hover)' }} content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-md border border-line bg-surface px-4 py-3 shadow-md"><p className="text-xs text-fg-2">{String(label).replace('-', '年')}月收入</p><Money cents={Number(payload[0].value)} className="mt-1 block font-semibold" /></div> : null} />
      <Bar dataKey="receivedCents" name="实收" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false}>{months.map((month, i) => <Cell key={month.month} fill={i === months.length - 1 ? `url(#${gradient})` : 'var(--primary-soft)'} />)}</Bar>
    </BarChart></ResponsiveContainer>
  </div>;
}
