import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrdersPage } from "./OrdersPage";
import { api } from "../lib/api";
import type { Customer, FileRecord, Order } from "../lib/types";

const customer: Customer = {
  id: "customer-lin",
  name: "林女士",
  phone: "13800138000",
  wechat: "lin-design",
  vipLevel: 4,
  notes: "",
  tags: [],
  platformIdentities: [{ platform: "闲鱼", handle: "林林的店", account: "xy-1001" }],
  addresses: [{ label: "公司", recipient: "林女士", phone: "13800138000", address: "上海市浦东新区创意路 18 号" }],
  qrCodePath: null,
  orderCount: 1,
  totalSpentCents: 16800,
  createdAt: "2026-06-06T00:00:00Z",
  updatedAt: "2026-06-06T00:00:00Z",
};

const order: Order = {
  id: "order-001",
  customerId: "customer-lin",
  customerName: "林女士",
  customerPhone: "13800138000",
  customerWechat: "lin-design",
  customerVipLevel: 4,
  platform: "闲鱼",
  platformAccount: "林林的店",
  externalOrderNo: "XY-ADDR-001",
  designStatus: "待设计",
  fulfillmentStatus: "已发货",
  designDueAt: "2026-06-08",
  deliveryDueAt: "2026-06-10",
  notes: "A4 宣传单",
  tags: ["加急"],
  items: [{ id: "item-1", orderId: "order-001", itemType: "设计", name: "宣传单设计", quantity: 1, unitPriceCents: 16800, printSpec: null, sourceQuoteId: null, sourceFactoryId: null, sourceFactoryName: "", sourceQuoteSummary: "", sourceProductionCostCents: 0, sourceShippingCostCents: 0 }],
  payments: [],
  totalCents: 16800,
  receivedCents: 0,
  paymentStatus: "未收",
  shipmentCompany: "顺丰",
  shipmentTrackingNo: "SF123456",
  shippingAddress: { label: "公司", recipient: "林女士", phone: "13800138000", address: "上海市浦东新区创意路 18 号" },
  folderPath: "D:\\客户文件库\\林女士\\订单\\XY-ADDR-001",
  folderState: "ready",
  createdAt: "2026-06-06T00:00:00Z",
  updatedAt: "2026-06-06T00:00:00Z",
};

const orderFile: FileRecord = {
  id: "file-order-1",
  orderId: "order-001",
  customerId: "customer-lin",
  category: "订单文件",
  name: "新建 文本文档.txt",
  relativePath: "林女士\\订单\\XY-ADDR-001\\新建 文本文档.txt",
  sizeBytes: 128,
  createdAt: "2026-06-06T00:00:00Z",
};

const paidOrder: Order = {
  ...order,
  id: "order-paid",
  externalOrderNo: "XY-PAID-001",
  designStatus: "设计完成",
  fulfillmentStatus: "待发货",
  paymentStatus: "已结清",
  receivedCents: 16800,
};

const unpaidOrder: Order = {
  ...order,
  id: "order-unpaid",
  externalOrderNo: "XY-UNPAID-001",
  designStatus: "设计完成",
  fulfillmentStatus: "已签收",
  paymentStatus: "部分收款",
  receivedCents: 8000,
};

const extraOrderFiles: FileRecord[] = [
  "反.jpg",
  "正.jpg",
  "Backup_of_肩颈.cdr",
  "肩颈.cdr",
  "尺寸说明.txt",
  "效果图.png",
].map((name, index) => ({
  id: `file-extra-${index}`,
  orderId: "order-001",
  customerId: "customer-lin",
  category: "订单文件",
  name,
  relativePath: `林女士\\订单\\XY-ADDR-001\\${name}`,
  sizeBytes: 1024 + index,
  createdAt: "2026-06-06T00:00:00Z",
}));

describe("OrdersPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "listOrderFolderFiles").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the selected order in a right-side detail panel", () => {
    render(
      <OrdersPage
        orders={[order]}
        customers={[customer]}
        files={[orderFile]}
        selectedOrderId={order.id}
        onNew={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "宣传单设计" })).toBeInTheDocument();
    expect(screen.getByText("林女士 的订单")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /宣传单设计 闲鱼 · XY-ADDR-001/ })).toBeInTheDocument();
    expect(screen.getByText("林女士 · 闲鱼 · XY-ADDR-001")).toBeInTheDocument();
    expect(screen.getByText("13800138000")).toBeInTheDocument();
    expect(screen.getByText("上海市浦东新区创意路 18 号")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SF123456")).toBeInTheDocument();
    expect(screen.getByText("新建 文本文档.txt")).toBeInTheDocument();
  });

  it("shows customers first and opens that customer's orders as the second layer", () => {
    render(
      <OrdersPage
        orders={[order, paidOrder]}
        customers={[customer]}
        selectedOrderId={null}
        onNew={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /林女士 2 笔订单/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /宣传单设计 闲鱼 · XY-ADDR-001/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /林女士 2 笔订单/ }));

    expect(screen.getByText("林女士 的订单")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /宣传单设计 闲鱼 · XY-ADDR-001/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回客户列表" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回客户列表" }));

    expect(screen.getByRole("button", { name: /林女士 2 笔订单/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /宣传单设计 闲鱼 · XY-ADDR-001/ })).not.toBeInTheDocument();
  });

  it("shows every related order file in the right-side detail panel", () => {
    render(
      <OrdersPage
        orders={[order]}
        customers={[customer]}
        files={[orderFile, ...extraOrderFiles]}
        selectedOrderId={order.id}
        onNew={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    for (const file of [orderFile, ...extraOrderFiles]) {
      expect(screen.getByText(file.name)).toBeInTheDocument();
    }
    expect(screen.getByText("7 个订单文件")).toBeInTheDocument();
  });

  it("includes files found directly in the physical order folder", async () => {
    vi.mocked(api.listOrderFolderFiles).mockResolvedValue([
      {
        id: "folder-file-cdr",
        orderId: order.id,
        customerId: customer.id,
        category: "CorelDRAW",
        name: "新建 CorelDRAW 2024 Graphic.cdr",
        relativePath: `${order.folderPath}\\新建 CorelDRAW 2024 Graphic.cdr`,
        sizeBytes: 2048,
        createdAt: "2026-06-06T09:38:00Z",
      },
      {
        id: "folder-file-txt",
        orderId: order.id,
        customerId: customer.id,
        category: "文本文档",
        name: "新建 文本文档.txt",
        relativePath: `${order.folderPath}\\新建 文本文档.txt`,
        sizeBytes: 128,
        createdAt: "2026-06-06T09:39:00Z",
      },
    ]);

    render(
      <OrdersPage
        orders={[order]}
        customers={[customer]}
        selectedOrderId={order.id}
        onNew={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(await screen.findByText("新建 CorelDRAW 2024 Graphic.cdr")).toBeInTheDocument();
    expect(screen.getByText("新建 文本文档.txt")).toBeInTheDocument();
    expect(api.listOrderFolderFiles).toHaveBeenCalledWith(order.folderPath, order.id, order.customerId);
  });

  it("rescans the physical order folder when the refresh key changes", async () => {
    vi.mocked(api.listOrderFolderFiles)
      .mockResolvedValueOnce([
        {
          id: "folder-file-old",
          orderId: order.id,
          customerId: customer.id,
          category: "图片文件",
          name: "旧文件.png",
          relativePath: `${order.folderPath}\\旧文件.png`,
          sizeBytes: 1024,
          createdAt: "2026-06-06T09:38:00Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "folder-file-new",
          orderId: order.id,
          customerId: customer.id,
          category: "图片文件",
          name: "新文件.png",
          relativePath: `${order.folderPath}\\新文件.png`,
          sizeBytes: 2048,
          createdAt: "2026-06-06T09:39:00Z",
        },
      ]);

    const view = render(
      <OrdersPage
        orders={[order]}
        customers={[customer]}
        selectedOrderId={order.id}
        folderRefreshKey={0}
        onNew={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(await screen.findByText("旧文件.png")).toBeInTheDocument();

    view.rerender(
      <OrdersPage
        orders={[order]}
        customers={[customer]}
        selectedOrderId={order.id}
        folderRefreshKey={1}
        onNew={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    expect(await screen.findByText("新文件.png")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("旧文件.png")).not.toBeInTheDocument());
    expect(api.listOrderFolderFiles).toHaveBeenCalledTimes(2);
  });

  it("opens order actions from the right-click menu", () => {
    render(
      <OrdersPage
        orders={[order]}
        customers={[customer]}
        selectedOrderId={order.id}
        onNew={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: /宣传单设计 闲鱼 · XY-ADDR-001/ }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "修改订单" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "删除订单" })).toBeInTheDocument();
  });

  it("filters orders with one-click shortcut buttons", () => {
    render(
      <OrdersPage
        orders={[order, paidOrder, unpaidOrder]}
        customers={[customer]}
        selectedOrderId={null}
        onNew={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /林女士 3 笔订单/ }));

    fireEvent.click(screen.getByRole("button", { name: "待收款" }));
    expect(screen.getByRole("button", { name: /XY-ADDR-001/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /XY-UNPAID-001/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /XY-PAID-001/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "待发货" }));
    expect(screen.getByRole("button", { name: /XY-PAID-001/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /XY-UNPAID-001/ })).not.toBeInTheDocument();
  });
});
