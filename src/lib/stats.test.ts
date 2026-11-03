import { describe, expect, it } from 'vitest';
import { comparisonRanges, incomeCsv, incomeLedger, incomeStats, inRange, metricChange, outstandingProjects, periodRange } from './stats';
import { filterProjects } from './filters';
import { todayOverview } from './today';
import { createSeed } from '../api/mock/seed';

describe('收入按本地日历归属', () => {
  it('UTC日期已到次日时，本地当晚创建的项目仍计入当天成本与成交', () => {
    const project = { ...createSeed('2026-11-02').projects[0], status: 'active' as const, createdAt: new Date(2026, 10, 2, 23, 59).toISOString(), costCents: 2000 };
    const range = { from: '2026-11-02', to: '2026-11-02' };
    expect(inRange(project.createdAt, range)).toBe(true);
    expect(inRange(new Date(2026, 10, 3, 0, 1).toISOString(), range)).toBe(false);
    expect(incomeStats([project], [], range)).toMatchObject({ costCents: 2000, dealCount: 1 });
  });
  it('跨年时间戳转为本地日历，收款的日期字段保持原样', () => {
    const range = { from: '2025-12-31', to: '2025-12-31' };
    expect(inRange(new Date(2025, 11, 31, 23, 59).toISOString(), range)).toBe(true);
    expect(inRange(new Date(2026, 0, 1, 0, 1).toISOString(), range)).toBe(false);
    expect(inRange('2025-12-31', range)).toBe(true);
    expect(inRange('2026-01-01', range)).toBe(false);
    expect(inRange('invalid', range)).toBe(false);
  });
});

describe('同期收入比较', () => {
  it('月初只对比上月同一天，不把整月放进分母', () => {
    expect(comparisonRanges('thisMonth', periodRange('thisMonth', '2026-11-02'), '2026-11-02')).toEqual({ current: { from: '2026-11-01', to: '2026-11-02' }, previous: { from: '2026-10-01', to: '2026-10-02' } });
    const seed = createSeed('2026-11-02'); const p = seed.projects[0];
    const payment = (paidAt: string, amountCents: number) => ({ id: paidAt, projectId: p.id, projectTitle: p.title, clientId: p.clientId, clientName: p.clientName, kind: 'income' as const, amountCents, method: '微信', note: '', paidAt, createdAt: paidAt });
    const overview = todayOverview([p], [payment('2026-11-02', 200), payment('2026-10-02', 100), payment('2026-10-30', 99999), payment('2026-11-30', 99999)], '2026-11-02');
    expect(overview.current).toBe(200); expect(overview.change.percent).toBe(100);
  });
  it('跨年和上月较短时按月底截断，支持闰年', () => {
    expect(comparisonRanges('thisMonth', periodRange('thisMonth', '2026-03-31'), '2026-03-31').previous).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(comparisonRanges('thisMonth', periodRange('thisMonth', '2024-03-31'), '2024-03-31').previous.to).toBe('2024-02-29');
    expect(comparisonRanges('thisMonth', periodRange('thisMonth', '2026-01-02'), '2026-01-02').previous.from).toBe('2025-12-01');
  });
  it.each([
    ['2026-11-02', '2026-10-01', '2026-10-31', '2026-09-01', '2026-09-30'],
    ['2024-03-15', '2024-02-01', '2024-02-29', '2024-01-01', '2024-01-31'],
    ['2025-03-15', '2025-02-01', '2025-02-28', '2025-01-01', '2025-01-31'],
    ['2027-01-01', '2026-12-01', '2026-12-31', '2026-11-01', '2026-11-30'],
  ])('上月比较完整自然月：%s', (base, from, to, previousFrom, previousTo) => {
    expect(comparisonRanges('lastMonth', periodRange('lastMonth', base), base)).toEqual({ current: { from, to }, previous: { from: previousFrom, to: previousTo } });
  });
  it.each([
    ['2026-10-03', '2026-10-01', '2026-07-01', '2026-07-03'],
    ['2026-11-02', '2026-10-01', '2026-07-01', '2026-08-02'],
    ['2024-05-31', '2024-04-01', '2024-01-01', '2024-02-29'],
    ['2025-05-31', '2025-04-01', '2025-01-01', '2025-02-28'],
    ['2026-12-31', '2026-10-01', '2026-07-01', '2026-09-30'],
    ['2026-04-01', '2026-04-01', '2026-01-01', '2026-01-01'],
    ['2027-01-01', '2027-01-01', '2026-10-01', '2026-10-01'],
  ])('本季度对应上一季度同月序与同日，月末夹到有效日期：%s', (base, from, previousFrom, previousTo) => {
    expect(comparisonRanges('thisQuarter', periodRange('thisQuarter', base), base)).toEqual({ current: { from, to: base }, previous: { from: previousFrom, to: previousTo } });
  });
  it.each([
    ['2024-02-29', '2023-02-28'], ['2025-03-01', '2024-03-01'], ['2026-12-31', '2025-12-31'], ['2027-01-01', '2026-01-01'],
  ])('今年对应去年同月日，闰日与年初不多算天数：%s', (base, previousTo) => {
    expect(comparisonRanges('thisYear', periodRange('thisYear', base), base)).toEqual({ current: { from: `${base.slice(0, 4)}-01-01`, to: base }, previous: { from: `${previousTo.slice(0, 4)}-01-01`, to: previousTo } });
  });
  it('去年完整比较两个自然年，跨闰年仍各自使用12月31日', () => {
    expect(comparisonRanges('lastYear', periodRange('lastYear', '2025-02-01'), '2025-02-01')).toEqual({ current: { from: '2024-01-01', to: '2024-12-31' }, previous: { from: '2023-01-01', to: '2023-12-31' } });
    expect(comparisonRanges('lastYear', periodRange('lastYear', '2026-01-01'), '2026-01-01').previous).toEqual({ from: '2024-01-01', to: '2024-12-31' });
  });
  it('本月第一天只比较上月第一天', () => {
    expect(comparisonRanges('thisMonth', periodRange('thisMonth', '2027-01-01'), '2027-01-01')).toEqual({ current: { from: '2027-01-01', to: '2027-01-01' }, previous: { from: '2026-12-01', to: '2026-12-01' } });
  });
  it('只有自定义使用前一段等长区间，支持跨年、闰日与尚未开始的区间', () => {
    expect(comparisonRanges('custom', { from: '2026-03-08', to: '2026-03-10' }, '2026-11-02').previous).toEqual({ from: '2026-03-05', to: '2026-03-07' });
    expect(comparisonRanges('custom', { from: '2027-01-01', to: '2027-01-03' }, '2027-02-01').previous).toEqual({ from: '2026-12-29', to: '2026-12-31' });
    expect(comparisonRanges('custom', { from: '2024-03-01', to: '2024-03-02' }, '2024-04-01').previous).toEqual({ from: '2024-02-28', to: '2024-02-29' });
    expect(comparisonRanges('custom', { from: '2026-11-01', to: '2026-11-30' }, '2026-11-02')).toEqual({ current: { from: '2026-11-01', to: '2026-11-02' }, previous: { from: '2026-10-30', to: '2026-10-31' } });
    expect(comparisonRanges('custom', { from: '2026-12-01', to: '2026-12-03' }, '2026-11-02')).toEqual({ current: { from: '2026-12-01', to: '2026-11-02' }, previous: { from: '2026-12-01', to: '2026-11-02' } });
    expect(comparisonRanges('all', { from: null, to: null }).previous).toEqual({ from: null, to: null });
  });
});

describe('收入明细与导出', () => {
  it('流水按付款日期筛选并保留退款负数，当前待收包含跨期项目且排除取消', () => {
    const seed = createSeed('2026-11-02');
    const first = { ...seed.projects[0], status: 'active' as const, createdAt: '2026-11-01T10:00:00Z', priceCents: 10000, receivedCents: 8000 };
    const cancelled = { ...first, id: 'cancelled', status: 'cancelled' as const, receivedCents: 0 };
    const old = { ...first, id: 'old', createdAt: '2026-09-01T10:00:00Z', receivedCents: 0 };
    const payment = { ...seed.payments[0], projectId: first.id, clientId: first.clientId, clientName: first.clientName, projectTitle: first.title, paidAt: '2026-11-02', method: '微信', amountCents: 10000 };
    const refund = { ...payment, id: 'refund', kind: 'refund' as const, amountCents: 2000 };
    const rows = [payment, refund, { ...payment, id: 'other-method', method: '支付宝' }, { ...payment, id: 'cancelled-pay', projectId: cancelled.id }, { ...payment, id: 'outside', paidAt: '2026-10-31' }];
    const range = { from: '2026-11-01', to: '2026-11-30' };
    expect(incomeLedger([first, cancelled, old], rows, range, '微信').map(row => row.netCents).sort((a, b) => a - b)).toEqual([-2000, 10000]);
    expect(outstandingProjects([first, cancelled, old])).toEqual([{ project: old, outstandingCents: 10000 }, { project: first, outstandingCents: 2000 }]);
    expect(rows[0]).not.toHaveProperty('netCents');
  });
  it('今日页、侧栏与收入页的当前待收合计和项目口径一致，切换周期不变', () => {
    const seed = createSeed('2026-11-02');
    const base = seed.projects[0];
    const projects = [
      { ...base, id: 'old', status: 'active' as const, createdAt: '2025-01-01T10:00:00Z', priceCents: 10000, receivedCents: 4000 },
      { ...base, id: 'refunded', status: 'delivered' as const, createdAt: '2026-11-01T10:00:00Z', priceCents: 8000, receivedCents: -1000 },
      { ...base, id: 'cancelled', status: 'cancelled' as const, priceCents: 999999, receivedCents: 0 },
      { ...base, id: 'overpaid', status: 'done' as const, priceCents: 1000, receivedCents: 2000 },
    ];
    const pending = outstandingProjects(projects);
    const sidebarProjects = filterProjects(projects, { outstanding: true });
    const sidebarCents = sidebarProjects.reduce((sum, project) => sum + project.priceCents - project.receivedCents, 0);
    const overview = todayOverview(projects, [], '2026-11-02');
    expect(pending.map(entry => entry.project.id)).toEqual(['refunded', 'old']);
    expect(sidebarProjects.map(project => project.id).sort()).toEqual(pending.map(entry => entry.project.id).sort());
    expect(overview.unpaid.map(project => project.id)).toEqual(pending.map(entry => entry.project.id));
    expect(overview.outstandingCents).toBe(15000);
    expect(sidebarCents).toBe(overview.outstandingCents);
    for (const range of [periodRange('thisMonth', '2026-11-02'), periodRange('lastYear', '2026-11-02'), { from: '2030-01-01', to: '2030-01-31' }, periodRange('all')]) {
      expect(incomeStats(projects, [], range).outstandingCents).toBe(sidebarCents);
    }
    expect(projects[0].id).toBe('old');
  });
  it('CSV保留换行与引号，退款输出负数，文本公式不会被表格执行', () => {
    const seed = createSeed('2026-11-02'); const project = seed.projects[0];
    const entry = { ...seed.payments[0], kind: 'refund' as const, netCents: -12034, projectTitle: '=1+1', clientId: project.clientId, clientName: '客户,"甲"', note: '第一行\n第二行', method: '@危险文本' };
    const result = incomeCsv([entry]);
    expect(result).toContain('"客户,""甲"""'); expect(result).toContain('"\'=1+1"'); expect(result).toContain('"\'@危险文本"');
    expect(result).toContain(',-120.34,"退款",'); expect(result).toContain('"第一行\n第二行"');
  });
  it('上期为零与负数时没有无穷环比，成本下降显示正向变化', () => {
    expect(metricChange(0, 0)).toEqual({ label: '与上期持平', tone: 'neutral' });
    expect(metricChange(100, 0)).toEqual({ label: '较上期新增', tone: 'success' });
    expect(metricChange(-200, -100)).toEqual({ label: '较上期 -100%', tone: 'danger' });
    expect(metricChange(80, 100, true)).toEqual({ label: '较上期 -20%', tone: 'success' });
  });
});
