import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomersPage } from "./CustomersPage";
import type { Customer, Order } from "../lib/types";

const customer: Customer = {
  id: "customer-lin",
  name: "林女士",
  phone: "13800138000",
  wechat: "lin-design",
  vipLevel: 5,
  notes: "偏好暖色",
  tags: ["复购"],
  platformIdentities: [{ platform: "微信", handle: "林女士微信", account: "lin-design" }],
  addresses: [{ label: "公司", recipient: "林女士", phone: "13800138000", address: "上海市浦东新区创意路 18 号" }],
  qrCodePath: null,
  orderCount: 2,
  totalSpentCents: 16800,
  createdAt: "2026-06-06T00:00:00Z",
  updatedAt: "2026-06-06T00:00:00Z",
};

const order: Order = {
  id: "order-logo",
  customerId: customer.id,
  customerName: customer.name,
  customerPhone: customer.phone,
  customerWechat: customer.wechat,
  customerVipLevel: customer.vipLevel,
  platform: "微信",
  platformAccount: "林女士微信",
  externalOrderNo: "",
  designStatus: "待设计",
  fulfillmentStatus: "待处理",
  designDueAt: null,
  deliveryDueAt: null,
  notes: "",
  tags: [],
  items: [{ id: "item-logo", orderId: "order-logo", itemType: "设计", name: "Logo", quantity: 1, unitPriceCents: 16800, printSpec: null, sourceQuoteId: null, sourceFactoryId: null, sourceFactoryName: "", sourceQuoteSummary: "", sourceProductionCostCents: 0, sourceShippingCostCents: 0 }],
  payments: [],
  totalCents: 16800,
  receivedCents: 0,
  paymentStatus: "未收",
  shipmentCompany: "",
  shipmentTrackingNo: "",
  shippingAddress: null,
  folderPath: null,
  folderState: "pending",
  createdAt: "2026-06-07T00:00:00Z",
  updatedAt: "2026-06-07T00:00:00Z",
};

describe("CustomersPage", () => {
  it("shows selected customer details on the right and copies contact fields", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <CustomersPage
        customers={[customer]}
        orders={[order]}
        selectedCustomerId={customer.id}
        onSelect={vi.fn()}
        onSelectOrder={vi.fn()}
        onNew={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "客户详情" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "历史订单" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Logo/ })).toBeInTheDocument();
    expect(screen.getByText("林女士微信")).toBeInTheDocument();
    expect(screen.getByText("上海市浦东新区创意路 18 号")).toBeInTheDocument();
    expect(screen.queryByText("相关文件缩略图")).not.toBeInTheDocument();
    expect(screen.queryByText("成品预览.png")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "复制电话" }));

    expect(writeText).toHaveBeenCalledWith("13800138000");
    expect(await screen.findByText("已复制电话")).toBeInTheDocument();
  });

  it("opens a selected historical order from the customer detail panel", () => {
    const onSelectOrder = vi.fn();
    render(
      <CustomersPage
        customers={[customer]}
        orders={[order]}
        selectedCustomerId={customer.id}
        onSelect={vi.fn()}
        onSelectOrder={onSelectOrder}
        onNew={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Logo/ }));

    expect(onSelectOrder).toHaveBeenCalledWith(order);
  });
});
