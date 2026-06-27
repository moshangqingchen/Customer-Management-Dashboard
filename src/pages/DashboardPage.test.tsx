import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardSummary } from "../lib/types";
import { DashboardPage } from "./DashboardPage";

const order: DashboardSummary["recentOrders"][number] = {
    id: "order-1",
    customerId: "customer-1",
    customerName: "叙图视觉设计",
    customerPhone: "",
    customerWechat: "",
    customerVipLevel: 0,
    platform: "微信",
    platformAccount: "",
    externalOrderNo: "",
    designStatus: "待设计",
    fulfillmentStatus: "待处理",
    designDueAt: null,
    deliveryDueAt: null,
    notes: "",
    tags: [],
    items: [
      { id: "item-1", orderId: "order-1", itemType: "设计", name: "Logo", quantity: 1, unitPriceCents: 1_000, printSpec: null, sourceQuoteId: null, sourceFactoryId: null, sourceFactoryName: "", sourceQuoteSummary: "", sourceProductionCostCents: 0, sourceShippingCostCents: 0 },
      { id: "item-2", orderId: "order-1", itemType: "打印", name: "名片", quantity: 1, unitPriceCents: 1_000, printSpec: null, sourceQuoteId: null, sourceFactoryId: null, sourceFactoryName: "", sourceQuoteSummary: "", sourceProductionCostCents: 0, sourceShippingCostCents: 0 },
    ],
    payments: [],
    totalCents: 2_000,
    receivedCents: 0,
    paymentStatus: "未收",
    shipmentCompany: "",
    shipmentTrackingNo: "",
    shippingAddress: null,
    folderPath: null,
    folderState: "created",
    createdAt: "2026-06-22T00:00:00Z",
    updatedAt: "2026-06-22T00:00:00Z",
};

const summary: DashboardSummary = {
  pendingDesign: 1,
  dueSoon: 0,
  overdue: 0,
  pendingShipment: 1,
  unpaidCents: 2_000,
  monthRevenueCents: 0,
  recentFiles: [],
  todoOrders: [order],
  recentOrders: [order],
};

describe("DashboardPage", () => {
  it("shows the entered project names above the customer and order details", () => {
    render(
      <DashboardPage
        summary={summary}
        onNewCustomer={vi.fn()}
        onNavigate={vi.fn()}
        onSelectOrder={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Logo、名片").length).toBeGreaterThan(0);
    expect(screen.getByText("叙图视觉设计 · 微信 · 内部订单")).toBeInTheDocument();
  });

  it("shows the actionable todo queue from dashboard summary", () => {
    const oldRecentOrder = {
      ...order,
      id: "order-old",
      externalOrderNo: "OLD-NEEDS-MONEY",
      items: [{ ...order.items[0], name: "复购尾款" }],
      totalCents: 8_000,
      receivedCents: 2_000,
      paymentStatus: "部分收款",
      designStatus: "设计完成",
      fulfillmentStatus: "已签收",
      deliveryDueAt: "2026-06-20",
      createdAt: "2026-05-01T00:00:00Z",
    };
    render(
      <DashboardPage
        summary={{ ...summary, todoOrders: [oldRecentOrder], recentOrders: [order] }}
        onNewCustomer={vi.fn()}
        onNavigate={vi.fn()}
        onSelectOrder={vi.fn()}
      />,
    );

    expect(screen.getByText("今天先处理")).toBeInTheDocument();
    expect(screen.getByText("复购尾款")).toBeInTheDocument();
    expect(screen.getAllByText("待收款").length).toBeGreaterThan(0);
    expect(screen.getByText("¥60.00")).toBeInTheDocument();
  });
});
