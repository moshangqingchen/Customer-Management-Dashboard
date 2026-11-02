import { lazy, Suspense, useMemo, useState } from 'react';
import { BriefcaseBusiness, Coins, Receipt, TrendingUp, Wallet, WalletCards } from 'lucide-react';
import type { Project } from '../api/types';
import { useAllPayments, useProjects, useSaveTextFile, useSettings } from '../hooks/queries';
import { today, validDate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { clientRanking, comparisonRanges, incomeCsv, incomeLedger, incomeStats, metricChange, monthlyStats, outstandingProjects, periodRange, type DateRange, type StatsPeriod } from '../lib/stats';
import { PageHeader } from '../components/layout/PageHeader';
import { ClientRanking, OutstandingTable, PaymentsTable } from '../components/income/IncomeTables';
import { PaymentQuickForm } from '../components/payments/PaymentQuickForm';
import { Button, Card, Dialog, EmptyState, Input, Money, Section, Skeleton, StatCard, toast } from '../components/ui';
import './income.css';

const IncomeChart = lazy(() => import('../components/income/IncomeChart'));
const periods: { value: StatsPeriod | 'custom'; label: string }[] = [{ value: 'thisMonth', label: '本月' }, { value: 'lastMonth', label: '上月' }, { value: 'thisQuarter', label: '本季度' }, { value: 'thisYear', label: '今年' }, { value: 'lastYear', label: '去年' }, { value: 'all', label: '全部' }, { value: 'custom', label: '自定义' }];
export function IncomePage() {
  const projects = useProjects(); const payments = useAllPayments(); const settings = useSettings(); const save = useSaveTextFile();
  const [period, setPeriod] = useState<StatsPeriod | 'custom'>('thisMonth'); const [custom, setCustom] = useState<DateRange>(periodRange('thisMonth'));
  const [method, setMethod] = useState(''); const [paying, setPaying] = useState<Project | null>(null);
  const range = period === 'custom' ? custom : periodRange(period);
  const valid = period !== 'custom' || !!range.from && !!range.to && validDate(range.from) && validDate(range.to) && range.from <= range.to;
  const report = useMemo(() => {
    const allProjects = projects.data ?? []; const allPayments = payments.data ?? [];
    const ranges = comparisonRanges(period, valid ? range : { from: null, to: null });
    return { current: incomeStats(allProjects, allPayments, ranges.current), previous: incomeStats(allProjects, allPayments, ranges.previous),
      months: monthlyStats(allProjects, allPayments), pending: outstandingProjects(allProjects, ranges.current),
      ledger: incomeLedger(allProjects, allPayments, ranges.current, method), ranking: clientRanking(allProjects, allPayments, ranges.current),
      methods: [...new Set([...(settings.data?.paymentMethods ?? []), ...allPayments.map(payment => payment.method)].filter(Boolean))] };
  }, [projects.data, payments.data, settings.data, period, range.from, range.to, valid, method]);
  const loading = projects.isPending || payments.isPending;
  const error = projects.error || payments.error;
  const metrics = [
    { key: 'receivedCents', title: '实收', Icon: Wallet, tone: 'violet' }, { key: 'outstandingCents', title: '待收', Icon: WalletCards, tone: 'amber', inverse: true },
    { key: 'costCents', title: '成本', Icon: Receipt, tone: 'peach', inverse: true }, { key: 'profitCents', title: '利润', Icon: TrendingUp, tone: 'mint' },
    { key: 'dealCount', title: '成交项目数', Icon: BriefcaseBusiness, tone: 'sky' }, { key: 'averageOrderCents', title: '客单价', Icon: Coins, tone: 'rose' },
  ] as const;
  function exportCsv() { save.mutate({ defaultName: `收款流水-${range.from ?? '全部'}-${range.to ?? today()}.csv`, content: incomeCsv(report.ledger) }, { onSuccess: path => { if (path) toast.success('收款流水已导出'); } }); }
  return <div className="min-w-0 space-y-6 p-7">
    <PageHeader title="收入" description="每一份认真，都有看得见的收获。" />
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="收入时间范围">{periods.map(item => <Button key={item.value} size="sm" variant={period === item.value ? 'primary' : 'ghost'} aria-pressed={period === item.value} onClick={() => setPeriod(item.value)}>{item.label}</Button>)}</div>
    {period === 'custom' && <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm text-fg-2">开始日期<Input type="date" className="w-44" aria-label="收入开始日期" value={custom.from ?? ''} onChange={event => setCustom({ ...custom, from: event.target.value })} /></label><span className="text-fg-2">至</span><label className="flex items-center gap-2 text-sm text-fg-2">结束日期<Input type="date" className="w-44" aria-label="收入结束日期" value={custom.to ?? ''} onChange={event => setCustom({ ...custom, to: event.target.value })} /></label>{!valid && <p role="alert" className="text-sm text-danger-fg">请选择有效的起止日期，结束日期不能早于开始日期。</p>}</div>}
    {loading ? <div aria-label="正在加载收入" className="grid grid-cols-3 gap-4">{metrics.map(metric => <Skeleton key={metric.key} className="h-32 rounded-lg" />)}</div> : error ? <Card><EmptyState illustrationName="empty-search" title="暂时无法读取收入" description={error.message} action={<Button onClick={() => { void projects.refetch(); void payments.refetch(); }}>重新加载</Button>} /></Card> : valid && <>
      <div className="income-stats grid grid-cols-3 gap-4">{metrics.map(metric => <StatCard key={metric.key} title={metric.title} value={metric.key === 'dealCount' ? `${report.current[metric.key]} 个` : formatMoney(report.current[metric.key])} icon={<metric.Icon />} tone={metric.tone} change={period === 'all' ? { label: '全部时间', tone: 'neutral' } : metricChange(report.current[metric.key], report.previous[metric.key], 'inverse' in metric && metric.inverse)} />)}</div>
      <p className="text-xs text-fg-2">实收按收款日期统计；待收、成本、成交与客单价按项目创建日期统计。洽谈中不计成交，已取消项目不计入。当前周期统计截至今天。</p>
      <Card className="min-w-0 p-5"><Section title="收入趋势" description="近 12 个月 · 实收已扣除退款" action={<span className="text-right text-xs text-fg-2">本期预计利润 <Money cents={report.current.expectedProfitCents} className="ml-1 font-semibold text-fg" /></span>}><Suspense fallback={<Skeleton className="h-80" />}><IncomeChart months={report.months} /></Suspense></Section></Card>
      <OutstandingTable entries={report.pending} onPayment={setPaying} />
      <PaymentsTable entries={report.ledger} methods={report.methods} method={method} onMethod={setMethod} onExport={exportCsv} exporting={save.isPending} />
      <ClientRanking entries={report.ranking} />
    </>}
    <Dialog open={!!paying} onOpenChange={open => { if (!open) setPaying(null); }} title="记一笔收款" description={paying ? `${paying.clientName} · ${paying.title}` : undefined}>{paying && <PaymentQuickForm key={paying.id} project={paying} onSaved={() => setPaying(null)} onCancel={() => setPaying(null)} />}</Dialog>
  </div>;
}
