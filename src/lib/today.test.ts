import { describe, expect, it } from 'vitest';
import type { PaymentWithContext, Project } from '../api/types';
import { activityTime, attentionProjects, dueThisWeek, heroContent, incomeChange, todayOverview } from './today';

const project = (id: string, dueDate: string | null, status: Project['status'] = 'active'): Project => ({ id, clientId: 'c', clientName: '林女士', title: id, status, dueDate, pinned: false, brief: '', sourcePlatform: '', sourceOrderNo: '', startDate: null, deliveredAt: null, completedAt: null, priceCents: 10000, costCents: 0, tagIds: [], folder: null, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z', receivedCents: 0, paymentCount: 0, fileCount: 0, coverPath: null });
describe('今日数据派生', () => {
  it('关注列表逾期在前，包含今天和三天边界，排除归档及无日期', () => {
    const input = [project('future', '2026-11-06'), project('soon', '2026-11-05'), project('late1', '2026-11-01'), project('late2', '2026-10-30'), project('today', '2026-11-02'), project('none', null), project('done', '2026-10-28', 'done'), project('cancelled', '2026-10-28', 'cancelled')];
    expect(attentionProjects(input, '2026-11-02').map(p => p.id)).toEqual(['late2', 'late1', 'today', 'soon']);
    expect(input[0].id).toBe('future');
  });
  it('本周按周一至周日，包含已过的本周日期但排除关闭项目，支持跨年', () => {
    expect(dueThisWeek([project('mon', '2026-11-02'), project('sun', '2026-11-08'), project('before', '2026-11-01'), project('after', '2026-11-09'), project('done', '2026-11-04', 'done')], '2026-11-04').map(p => p.id)).toEqual(['mon', 'sun']);
    expect(dueThisWeek([project('nextYear', '2027-01-03')], '2026-12-31')).toHaveLength(1);
  });
  it('环比处理增长、下降、零基数和负基数，不出现无穷大', () => {
    expect(incomeChange(11200, 10000)).toMatchObject({ percent: 12, tone: 'success' });
    expect(incomeChange(8000, 10000)).toMatchObject({ percent: -20, tone: 'danger' });
    expect(incomeChange(0, 0).label).toBe('与上月持平');
    expect(incomeChange(100, 0)).toMatchObject({ percent: null, label: '本月新增收入' });
    expect(incomeChange(-100, 0).tone).toBe('danger');
    expect(incomeChange(100, -100).percent).toBe(200);
  });
  it('总览净收入包含退款，待收排除取消，并只返回金额最高五项', () => {
    const projects = Array.from({ length: 7 }, (_, i) => ({ ...project(`p${i}`, '2026-11-03'), priceCents: (i + 1) * 10000 }));
    projects.push(project('cancelled', null, 'cancelled'));
    const payment = (kind: 'income' | 'refund', amountCents: number, paidAt: string): PaymentWithContext => ({ id: paidAt + kind, projectId: 'p0', kind, amountCents, paidAt, method: '微信', note: '', createdAt: paidAt, clientId: 'c', clientName: '林女士', projectTitle: 'p0' });
    const overview = todayOverview(projects, [payment('income', 10000, '2026-11-02'), payment('refund', 2000, '2026-11-02'), payment('income', 4000, '2026-10-02')], '2026-11-02');
    expect(overview.current).toBe(8000); expect(overview.change.percent).toBe(100);
    expect(overview.outstandingCents).toBe(280000); expect(overview.unpaid.map(p => p.id)).toEqual(['p6', 'p5', 'p4', 'p3', 'p2']);
    expect(overview.months).toHaveLength(6);
  });
  it('横幅按本地时段切换，深色始终夜景，每日文案稳定', () => {
    expect(heroContent(new Date(2026, 10, 2, 5)).image).toBe('hero-morning');
    expect(heroContent(new Date(2026, 10, 2, 11)).image).toBe('hero-afternoon');
    expect(heroContent(new Date(2026, 10, 2, 18)).image).toBe('hero-night');
    expect(heroContent(new Date(2026, 10, 2, 9), true).image).toBe('hero-night');
    expect(heroContent(new Date(2026, 10, 2, 9)).message).toBe(heroContent(new Date(2026, 10, 2, 19)).message);
    expect(activityTime('2026-11-02T00:00:00Z', new Date('2026-11-02T01:00:00Z'))).toContain('1 小时前');
  });
});
