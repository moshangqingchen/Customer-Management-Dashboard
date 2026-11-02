import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonthlyStats } from '../../lib/stats';
import IncomeChart from './IncomeChart';

function months(profits: number[]): MonthlyStats[] {
  return profits.map((profitCents, index) => ({ month: `2026-${String(index + 1).padStart(2, '0')}`, receivedCents: 10000,
    profitCents, costCents: 10000 - profitCents, outstandingCents: 0, expectedProfitCents: 0, dealCount: 0, averageOrderCents: 0 }));
}
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('recharts-responsive-container') ? new DOMRect(0, 0, 800, 288) : new DOMRect();
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('收入趋势图数值边界', () => {
  it('全为非负利润时纵轴从零开始，利润曲线在相邻数据点之间不产生过冲', async () => {
    const { container } = render(<IncomeChart months={months([0, 9500, 1000, 9000, 0])} />);
    await waitFor(() => expect(container.querySelector('.recharts-line-curve')?.getAttribute('d')).toBeTruthy());
    const ticks = [...container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')].map(tick => tick.textContent);
    expect(ticks).toContain('¥0'); expect(ticks.some(tick => tick?.includes('−'))).toBe(false);
    const commands = container.querySelector('.recharts-line-curve')!.getAttribute('d')!.match(/[MLC][^MLC]*/g)!;
    let previousY = 0;
    for (const command of commands) {
      const values = command.slice(1).match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
      const endY = values.at(-1)!;
      if (command.startsWith('C')) {
        const lower = Math.min(previousY, endY) - 0.01; const upper = Math.max(previousY, endY) + 0.01;
        expect(values[1]).toBeGreaterThanOrEqual(lower); expect(values[1]).toBeLessThanOrEqual(upper);
        expect(values[3]).toBeGreaterThanOrEqual(lower); expect(values[3]).toBeLessThanOrEqual(upper);
      }
      previousY = endY;
    }
  });
  it('存在真实负利润时纵轴覆盖负值，保留无障碍说明中的真实金额', async () => {
    const { container } = render(<IncomeChart months={months([4000, -5000, 2000])} />);
    await waitFor(() => expect(container.querySelector('.recharts-line-curve')).toBeTruthy());
    const ticks = [...container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')].map(tick => tick.textContent);
    expect(ticks.some(tick => tick?.includes('−'))).toBe(true);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('利润−¥50');
  });
});
