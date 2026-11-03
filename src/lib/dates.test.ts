import { describe, expect, it } from 'vitest';
import { activityDayLabel, relativeActivityTime } from './activity';
import { cooperationDate } from './clients';
import { formatDate, formatDateTime, formatDateWithWeekday, formatMonth, relativeDate } from './dates';

describe('统一日期展示', () => {
  it('当前年省略年份，往年和未来年份完整显示', () => {
    expect(formatDate('2026-11-08', '2026-11-02')).toBe('11月8日');
    expect(formatDate('2025-01-24', '2026-11-02')).toBe('2025年1月24日');
    expect(formatDate('2027-01-24', '2026-11-02')).toBe('2027年1月24日');
    expect(formatMonth('2025-12', '2026-11-02')).toBe('2025年12月');
    expect(formatMonth('2026-11', '2026-11-02')).toBe('11月');
    expect(formatDateWithWeekday('2025-01-24', '2026-11-02')).toBe('2025年1月24日 星期五');
  });
  it('时间戳使用本地日历，空值和无效值有明确占位', () => {
    expect(formatDateTime('2025-01-24T10:30:00', '2026-11-02')).toBe('2025年1月24日 10:30');
    expect(formatDate(null)).toBe('—'); expect(formatDate('invalid')).toBe('—');
    expect(formatDateTime('invalid')).toBe('—'); expect(formatMonth('invalid')).toBe('—');
  });
  it('跨年合作和动态即使相差一天也显示年份，逾期语义保留', () => {
    expect(relativeDate('2025-12-31', '2026-01-01')).toBe('2025年12月31日');
    expect(cooperationDate('2025-01-24T12:00:00', '2026-11-02')).toBe('2025年1月24日');
    expect(activityDayLabel('2025-12-31', '2026-01-01')).toBe('2025年12月31日');
    expect(relativeActivityTime('2025-12-31T20:00:00', new Date(2026, 0, 1, 10))).toBe('2025年12月31日 20:00');
    expect(relativeActivityTime('2025-12-31T23:59:00', new Date(2026, 0, 1, 0, 1))).toBe('2025年12月31日 23:59');
    expect(relativeDate('2025-12-31', '2026-01-01', true)).toBe('2025年12月31日（逾期 1 天）');
  });
});
