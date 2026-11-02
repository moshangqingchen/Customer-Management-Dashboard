import { describe, expect, it } from 'vitest';
import { comparisonRanges, periodRange } from './stats';
import { todayOverview } from './today';
import { createSeed } from '../api/mock/seed';

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
  it('季度、年与自定义都与前一段等长区间比较', () => {
    expect(comparisonRanges('thisQuarter', periodRange('thisQuarter', '2026-10-03'), '2026-10-03')).toEqual({ current: { from: '2026-10-01', to: '2026-10-03' }, previous: { from: '2026-09-28', to: '2026-09-30' } });
    expect(comparisonRanges('custom', { from: '2026-03-08', to: '2026-03-10' }, '2026-11-02').previous).toEqual({ from: '2026-03-05', to: '2026-03-07' });
    expect(comparisonRanges('all', { from: null, to: null }).previous).toEqual({ from: null, to: null });
  });
});
