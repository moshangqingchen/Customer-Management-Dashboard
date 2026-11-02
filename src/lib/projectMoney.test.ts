import { describe, expect, it } from 'vitest';
import { paymentOverage, projectMoney } from './projectMoney';

describe('项目钱卡片', () => {
  it('计算预计利润、实得利润与部分收款', () => {
    expect(projectMoney({ priceCents: 100000, costCents: 20000, receivedCents: 35000, status: 'active' })).toEqual({
      expectedProfitCents: 80000, profitCents: 15000, outstandingCents: 65000, paymentStatus: 'partial', canComplete: false,
    });
  });
  it('退款使待收增加，取消项目不计待收', () => {
    expect(projectMoney({ priceCents: 10000, costCents: 5000, receivedCents: -1000, status: 'active' }).outstandingCents).toBe(11000);
    expect(projectMoney({ priceCents: 10000, costCents: 5000, receivedCents: -1000, status: 'cancelled' }).outstandingCents).toBe(0);
  });
  it('仅已交付且收清的项目提示完成，超收也可完成', () => {
    expect(projectMoney({ priceCents: 10000, costCents: 0, receivedCents: 10000, status: 'delivered' }).canComplete).toBe(true);
    expect(projectMoney({ priceCents: 10000, costCents: 0, receivedCents: 12000, status: 'delivered' }).paymentStatus).toBe('over');
    expect(projectMoney({ priceCents: 10000, costCents: 0, receivedCents: 12000, status: 'active' }).canComplete).toBe(false);
  });
  it('新增收款按净收款计算超收，退款不触发多收确认', () => {
    const project = { priceCents: 10000, receivedCents: 8000 };
    expect(paymentOverage(project, { kind: 'income', amountCents: 3000 })).toBe(1000);
    expect(paymentOverage(project, { kind: 'refund', amountCents: 3000 })).toBe(0);
  });
  it('编辑已有收款先去除旧金额，避免重复计入', () => {
    const project = { priceCents: 10000, receivedCents: 8000 };
    expect(paymentOverage(project, { kind: 'income', amountCents: 6000 }, { kind: 'income', amountCents: 5000 })).toBe(0);
    expect(paymentOverage(project, { kind: 'income', amountCents: 9000 }, { kind: 'income', amountCents: 5000 })).toBe(2000);
    expect(paymentOverage(project, { kind: 'income', amountCents: 1000 }, { kind: 'refund', amountCents: 2000 })).toBe(1000);
  });
});
