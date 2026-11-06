import { describe, expect, it } from 'vitest';
import { projectDateError } from './projectDraft';

describe('项目日期规则', () => {
  it('拒绝非法日期和截止早于开始，允许同日、跨年和未设日期', () => {
    expect(projectDateError('2026-02-30', null)).toBe('请填写有效的项目日期');
    expect(projectDateError('2026-11-05', '2026-11-04')).toBe('截止日不能早于开始日期，请调整项目日期。');
    expect(projectDateError('2026-11-05', '2026-11-05')).toBeNull();
    expect(projectDateError('2026-12-31', '2027-01-01')).toBeNull();
    expect(projectDateError(null, '2026-01-01')).toBeNull();
    expect(projectDateError('2026-01-01', null)).toBeNull();
  });
});
