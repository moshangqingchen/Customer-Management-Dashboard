import { describe, expect, it } from 'vitest';
import type { Client, PaymentWithContext, Project } from '../api/types';
import { avatarColor, colorClasses, hashString, initial, tagColors } from './colors';
import { dateOffset, dayDifference, isDueSoon, isOverdue, quickDates, relativeDate, today, validDate } from './dates';
import { canThumbnail, fileExtension, fileKind, formatFileSize, middleEllipsis } from './files';
import { filterClients, filterProjects, sortClients, sortProjects } from './filters';
import { expectedProfit, formatMoney, netReceived, outstanding, parseMoney, paymentStatus, profit } from './money';
import { matchesSearch, searchScore } from './search';
import { clientRanking, incomeStats, monthlyStats, periodRange } from './stats';
import { boardStatuses, statusMeta, statuses } from './status';

function project(patch: Partial<Project> = {}): Project {
  return { id: 'p1', clientId: 'c1', clientName: '林女士', title: '秋日海报', status: 'active', pinned: false, brief: '', sourcePlatform: '微信', sourceOrderNo: '', startDate: null, dueDate: '2026-11-03', deliveredAt: null, completedAt: null, priceCents: 100000, costCents: 10000, tagIds: ['red', 'blue'], folder: null, createdAt: '2026-11-02T12:00:00Z', updatedAt: '2026-11-02T12:00:00Z', receivedCents: 40000, paymentCount: 1, fileCount: 0, coverPath: null, ...patch };
}
function client(patch: Partial<Client> = {}): Client {
  return { id: 'c1', name: '林女士', company: '木间咖啡', phone: '13812345678', wechat: 'MujianCafe', email: '', address: '', accounts: [{ platform: '淘宝', handle: '木间官方店' }], rating: 4, pinned: false, notes: '需要设计菜单', folder: null, tagIds: ['red'], createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-11-02T12:00:00Z', projectCount: 1, openProjectCount: 1, billedCents: 100000, receivedCents: 40000, outstandingCents: 60000, firstProjectAt: null, lastActivityAt: '2026-11-02T12:00:00Z', ...patch };
}
function payment(patch: Partial<PaymentWithContext> = {}): PaymentWithContext {
  return { id: 'pay1', projectId: 'p1', kind: 'income', amountCents: 50000, paidAt: '2026-11-01', method: '微信', note: '', createdAt: '2026-11-01T12:00:00Z', projectTitle: '秋日海报', clientId: 'c1', clientName: '林女士', ...patch };
}

describe('金额精度与收款规则', () => {
  it.each([['¥1,280', 128000], ['0.29', 29], ['12.3', 1230], ['12.', 1200], ['-1.01', -101], ['￥ 2', 200]])('精确解析 %s', (input, cents) => expect(parseMoney(input)).toBe(cents));
  it.each(['', '12.345', 'abc', '1e5', 'Infinity', '90071992547410'])('拒绝无效或超出安全整数 %s', input => expect(parseMoney(input)).toBeNull());
  it('格式化千分位、整数和负数', () => {
    expect(formatMoney(128000)).toBe('¥1,280'); expect(formatMoney(128001)).toBe('¥1,280.01');
    expect(formatMoney(-101)).toBe('−¥1.01'); expect(formatMoney(100, false)).toBe('1');
  });
  it('退款减少净收款，取消不产生待收，允许多收', () => {
    expect(netReceived([{ kind: 'income', amountCents: 1000 }, { kind: 'refund', amountCents: 200 }])).toBe(800);
    expect(paymentStatus(1000, 0)).toBe('unpaid'); expect(paymentStatus(1000, 500)).toBe('partial');
    expect(paymentStatus(1000, 1000)).toBe('paid'); expect(paymentStatus(1000, 1200)).toBe('over');
    expect(outstanding(1000, 1200)).toBe(0); expect(outstanding(1000, -100)).toBe(1100); expect(outstanding(1000, 0, 'cancelled')).toBe(0);
    expect(profit(800, 300)).toBe(500); expect(expectedProfit(1000, 300)).toBe(700);
  });
});
describe('本地日历与截止日', () => {
  it('可注入today，跨月与闰年不依赖UTC切片', () => {
    expect(today(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
    expect(dateOffset(1, '2024-02-28')).toBe('2024-02-29'); expect(dayDifference('2026-03-09', '2026-03-07')).toBe(2);
    expect(validDate('2026-02-30')).toBe(false); expect(validDate('2024-02-29')).toBe(true);
  });
  it('逾期排除完成和取消，三天窗口含今天', () => {
    expect(isOverdue('2026-11-01', 'active', '2026-11-02')).toBe(true);
    expect(isOverdue('2026-11-01', 'done', '2026-11-02')).toBe(false);
    expect(isOverdue('2026-11-01', 'cancelled', '2026-11-02')).toBe(false);
    expect(isDueSoon('2026-11-02', 'review', '2026-11-02')).toBe(true);
    expect(isDueSoon('2026-11-05', 'active', '2026-11-02')).toBe(true);
    expect(isDueSoon('2026-11-06', 'active', '2026-11-02')).toBe(false);
  });
  it('中文相对时间与下周一快捷选择', () => {
    expect(relativeDate(null)).toBe('无截止日'); expect(relativeDate('2026-11-03', '2026-11-02')).toBe('明天');
    expect(relativeDate('2026-10-31', '2026-11-02', true)).toBe('逾期 2 天');
    expect(relativeDate('2026-10-28', '2026-11-02')).toBe('上周三');
    expect(quickDates('2026-11-02').map(item => item.value)).toEqual(['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-09']);
  });
});
describe('收入统计', () => {
  const projects = [project(), project({ id: 'p2', clientId: 'c2', status: 'cancelled', costCents: 99999 }), project({ id: 'p3', status: 'lead', priceCents: 20000, costCents: 0, receivedCents: 0 }), project({ id: 'p4', clientId: 'c2', priceCents: 200000, costCents: 20000, createdAt: '2026-10-01T12:00:00Z' })];
  const payments = [payment(), payment({ id: 'refund', kind: 'refund', amountCents: 10000 }), payment({ id: 'cancelled', projectId: 'p2', amountCents: 999999 }), payment({ id: 'old-project', projectId: 'p4', clientId: 'c2', clientName: '周先生', amountCents: 80000 }), payment({ id: 'october', amountCents: 12000, paidAt: '2026-10-20' })];
  it('按付款日期汇总含退款，成本按创建周期，排除取消', () => {
    expect(incomeStats(projects, payments, { from: '2026-11-01', to: '2026-11-30' })).toEqual({ receivedCents: 120000, outstandingCents: 240000, costCents: 10000, profitCents: 110000, expectedProfitCents: 110000, dealCount: 1, averageOrderCents: 100000 });
  });
  it('空集无NaN，月序列补零，排行扣退款', () => {
    expect(incomeStats([], []).averageOrderCents).toBe(0);
    const series = monthlyStats(projects, payments, 3, '2026-11-02');
    expect(series.map(item => item.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(series.map(item => item.receivedCents)).toEqual([0, 12000, 120000]);
    expect(clientRanking(projects, payments, { from: '2026-11-01', to: '2026-11-30' })).toEqual([{ clientId: 'c2', clientName: '周先生', receivedCents: 80000 }, { clientId: 'c1', clientName: '林女士', receivedCents: 40000 }]);
  });
  it('周期边界跨年与闰年正确', () => {
    expect(periodRange('lastMonth', '2026-01-01')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(periodRange('thisQuarter', '2026-11-02')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(periodRange('thisMonth', '2024-02-10').to).toBe('2024-02-29');
    expect(periodRange('lastYear', '2026-11-02')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
});
describe('筛选、排序与搜索', () => {
  it('项目组合筛选标签AND、预设截止日和收款状态', () => {
    const projects = [project(), project({ id: 'p2', tagIds: ['red'], dueDate: null }), project({ id: 'p3', status: 'cancelled', dueDate: '2026-11-01' })];
    expect(filterProjects(projects, { tagIds: ['red', 'blue'], paymentStatus: 'partial', due: 'week', query: '林 海报' }, '2026-11-02').map(item => item.id)).toEqual(['p1']);
    expect(filterProjects(projects, { due: 'none' }).map(item => item.id)).toEqual(['p2']);
    expect(filterProjects(projects, { due: 'overdue' }, '2026-11-02')).toEqual([]);
    expect(filterProjects(projects, { outstanding: true }).map(item => item.id)).toEqual(['p1', 'p2']);
  });
  it('置顶置顶、空截止日最后，排序不改变原数组', () => {
    const projects = [project({ id: 'null', dueDate: null }), project({ id: 'early', dueDate: '2026-10-01' }), project({ id: 'pinned', pinned: true, dueDate: null })];
    expect(sortProjects(projects).map(item => item.id)).toEqual(['pinned', 'early', 'null']); expect(projects[0].id).toBe('null');
  });
  it('本周与本月使用完整日历周期，包含周期内已过日期', () => {
    const projects = [project({ id: 'monday', dueDate: '2026-11-02' }), project({ id: 'sunday', dueDate: '2026-11-01' }), project({ id: 'last-month', dueDate: '2026-10-31' })];
    expect(filterProjects(projects, { due: 'week' }, '2026-11-04').map(item => item.id)).toEqual(['monday']);
    expect(filterProjects(projects, { due: 'month' }, '2026-11-04').map(item => item.id)).toEqual(['monday', 'sunday']);
  });
  it('客户可搜平台账号、备注和忽略大小写的微信', () => {
    const clients = [client(), client({ id: 'c2', name: '周先生', pinned: true, receivedCents: 0 })];
    expect(filterClients(clients, '木间官方店', ['red'])).toHaveLength(2);
    expect(filterClients([client()], 'mUJIAN')).toHaveLength(1); expect(filterClients([client()], '菜单')).toHaveLength(1);
    expect(sortClients(clients, 'received')[0].id).toBe('c2');
  });
  it('中文子串、英文模糊子序列和多词匹配', () => {
    expect(matchesSearch('春日品牌 Brand design', '品牌 DESIGN')).toBe(true); expect(matchesSearch('Brand design', 'bdg')).toBe(true);
    expect(matchesSearch('品牌设计', '品计')).toBe(false); expect(searchScore('Brand', 'brand')).toBeGreaterThan(searchScore('New Brand', 'brand'));
  });
});
describe('文件、配色与状态元数据', () => {
  it.each([['稿件.AFDESIGN', 'design'], ['报表.xlsx', 'doc'], ['预览.SVG', 'image'], ['pack.7z', 'archive'], ['预览.pdf', 'pdf'], ['clip.mov', 'video'], ['未知', 'other']])('文件类型 %s', (name, kind) => expect(fileKind(name)).toBe(kind));
  it('文件大小与中间省略保留扩展名', () => {
    expect(fileExtension('a.tar.zip')).toBe('zip'); expect(formatFileSize(1024)).toBe('1 KB'); expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(middleEllipsis('这是一个非常长的设计项目文件名字与最终交付版本.psd', 18)).toMatch(/….*\.psd$/);
    expect(canThumbnail('image', 25 * 1024 * 1024)).toBe(true); expect(canThumbnail('image', 25 * 1024 * 1024 + 1)).toBe(false);
  });
  it('头像hash稳定，全部状态文字与看板列完整', () => {
    expect(hashString('客户一')).toBe(hashString('客户一')); expect(tagColors).toContain(avatarColor('客户一'));
    expect(initial(' alice')).toBe('A'); expect(initial('林女士')).toBe('林'); expect(initial('')).toBe('?');
    expect(Object.keys(colorClasses)).toHaveLength(11); expect(statuses).toHaveLength(6); expect(boardStatuses).not.toContain('cancelled'); expect(statusMeta.active.label).toBe('进行中');
  });
});
