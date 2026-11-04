import { useEffect, useState } from 'react';
import { BriefcaseBusiness, CalendarDays, ChartNoAxesColumnIncreasing, Plus, Wallet } from 'lucide-react';
import { useAllPayments, useProjects, useRecentActivities } from '../hooks/queries';
import { today } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { heroContent, todayOverview } from '../lib/today';
import { useNav } from '../stores/nav';
import { useUI } from '../stores/ui';
import { Button, EmptyState, HeroBanner, Skeleton, StatCard } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { illustrationUrl } from '../components/ui/Illustration';
import { TodayProjects } from '../components/today/TodayProjects';
import { TodayIncome, TodayPayments, TodayActivity } from '../components/today/TodaySidebar';

export function TodayPage() {
  const projects = useProjects(); const payments = useAllPayments(); const activities = useRecentActivities(5);
  const navigate = useNav(s => s.navigate); const theme = useUI(s => s.theme);
  const newProject = useUI(s => s.setNewProjectOpen);
  const [now, setNow] = useState(() => new Date());
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    const media = matchMedia('(prefers-color-scheme: dark)'); const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => { window.clearInterval(timer); media.removeEventListener('change', update); };
  }, []);
  const hero = heroContent(now, theme === 'dark' || (theme === 'system' && systemDark));
  if (projects.isPending || payments.isPending) return <div className="space-y-5 p-7" aria-label="今日加载中"><Skeleton className="h-7 w-56" /><Skeleton className="h-56" /><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-80" /></div>;
  if (projects.isError || payments.isError) return <EmptyState illustrationName="empty-today" title="今日工作概览暂时不可用" description="请重新读取项目和收款数据。" action={<Button onClick={() => { void projects.refetch(); void payments.refetch(); }}>重新加载</Button>} />;
  const list = projects.data; const overview = todayOverview(list, payments.data, today(now)); const first = list.length === 0;
  return <div className="mx-auto max-w-[1800px] space-y-3 p-6">
    <PageHeader title="今日" meta={hero.date} actions={<Button variant="primary" icon={<Plus size={17} />} onClick={() => newProject(true)}>新建项目</Button>} />
    <HeroBanner image={illustrationUrl(hero.image)}>
      <div className="relative z-10 max-w-[75%]">
        <h2 className="hero-heading text-[24px] leading-8 font-semibold tracking-tight">{first ? '欢迎来到客户工作台' : `${hero.greeting}，${hero.message}`}</h2>
      </div>
    </HeroBanner>
    <div className="today-stats grid grid-cols-2 gap-4 min-[1000px]:grid-cols-4">
      <StatCard title="进行中" value={overview.activeCount} numericValue={overview.activeCount} icon={<BriefcaseBusiness size={24} />} tone="violet" onClick={() => navigate('projects', { statuses: ['active'] })} />
      <StatCard title="本周到期" value={overview.dueCount} numericValue={overview.dueCount} icon={<CalendarDays size={24} />} tone="sky" onClick={() => navigate('projects', { due: 'week' })} />
      <StatCard title="待收款" value={formatMoney(overview.outstandingCents)} numericValue={overview.outstandingCents} formatValue={formatMoney} icon={<Wallet size={24} />} tone="mint" onClick={() => navigate('projects', { view: 'outstanding' })} />
      <StatCard title="本月收入" value={formatMoney(overview.current)} numericValue={overview.current} formatValue={formatMoney} icon={<ChartNoAxesColumnIncreasing size={24} />} tone="peach" change={overview.change} onClick={() => navigate('income')} />
    </div>
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
      <TodayProjects overview={overview} base={today(now)} />
      <div className="grid min-w-0 gap-5"><TodayPayments projects={overview.unpaid} /><TodayIncome overview={overview} /><TodayActivity activities={activities.data ?? []} pending={activities.isPending} error={activities.isError} onRetry={() => void activities.refetch()} now={now} /></div>
    </div>
  </div>;
}
