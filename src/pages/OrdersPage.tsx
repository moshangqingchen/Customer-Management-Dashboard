import { ChevronLeft, Edit3, Filter, PackageCheck, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { OrderDetailPanel } from "../components/OrderDetailPanel";
import { formatCents, shortDate } from "../lib/format";
import { orderProjectNames } from "../lib/orders";
import type { Customer, FileRecord, Order } from "../lib/types";
import { Button, EmptyState, PageHeader, StatusBadge } from "../components/ui";

export function OrdersPage({
  orders,
  customers,
  files = [],
  libraryRoot,
  selectedOrderId,
  folderRefreshKey = 0,
  onNew,
  onSelect,
  onEdit,
  onDelete,
  onChanged,
}: {
  orders: Order[];
  customers: Customer[];
  files?: FileRecord[];
  libraryRoot?: string | null;
  selectedOrderId?: string | null;
  folderRefreshKey?: number;
  onNew: () => void;
  onSelect: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部");
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(() =>
    orders.find((order) => order.id === selectedOrderId)?.customerId ?? null,
  );
  const [menu, setMenu] = useState<{ x: number; y: number; order: Order } | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => orders.filter((order) => {
    const matchesQuery = JSON.stringify(order).toLowerCase().includes(query.toLowerCase());
    const dueDate = order.deliveryDueAt ?? order.designDueAt;
    const isOpen = !["已签收", "已取消"].includes(order.fulfillmentStatus);
    const matchesStatus =
      status === "全部" ||
      order.designStatus === status ||
      order.fulfillmentStatus === status ||
      order.paymentStatus === status ||
      (status === "待收款" && ["未收", "部分收款"].includes(order.paymentStatus)) ||
      (status === "逾期" && Boolean(dueDate && dueDate < today && isOpen));
    return matchesQuery && matchesStatus;
  }), [orders, query, status, today]);
  const customerGroups = useMemo(() => {
    const groups = new Map<string, {
      customerId: string;
      customerName: string;
      orders: Order[];
      totalCents: number;
      unpaidCents: number;
      pendingCount: number;
    }>();
    for (const order of filtered) {
      const customer = customers.find((item) => item.id === order.customerId);
      const group = groups.get(order.customerId) ?? {
        customerId: order.customerId,
        customerName: customer?.name || order.customerName,
        orders: [],
        totalCents: 0,
        unpaidCents: 0,
        pendingCount: 0,
      };
      group.orders.push(order);
      group.totalCents += order.totalCents;
      group.unpaidCents += Math.max(0, order.totalCents - order.receivedCents);
      if (
        ["待设计", "设计中", "待确认"].includes(order.designStatus) ||
        ["待处理", "待发货"].includes(order.fulfillmentStatus) ||
        ["未收", "部分收款"].includes(order.paymentStatus)
      ) {
        group.pendingCount += 1;
      }
      groups.set(order.customerId, group);
    }
    return Array.from(groups.values()).sort((left, right) =>
      (right.orders[0]?.createdAt ?? "").localeCompare(left.orders[0]?.createdAt ?? ""),
    );
  }, [customers, filtered]);
  const activeGroup = customerGroups.find((group) => group.customerId === activeCustomerId) ?? null;
  const activeCustomerOrders = activeGroup?.orders ?? [];
  const selectedOrder = activeCustomerOrders.find((order) => order.id === selectedOrderId) ?? activeCustomerOrders[0] ?? null;

  useEffect(() => {
    const selected = filtered.find((order) => order.id === selectedOrderId);
    if (selected) setActiveCustomerId(selected.customerId);
  }, [filtered, selectedOrderId]);

  useEffect(() => {
    if (activeCustomerId && !customerGroups.some((group) => group.customerId === activeCustomerId)) {
      setActiveCustomerId(null);
    }
  }, [activeCustomerId, customerGroups]);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, []);

  return (
    <div className="page-content">
      <PageHeader eyebrow="订单全流程" title="订单管理" description="设计进度和履约进度独立管理，临时变化也能清楚表达。" actions={<Button onClick={onNew}><Plus size={17} />新建订单</Button>} />
      <div className="toolbar order-toolbar">
        <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索订单号、客户、平台或快递单号…" /></label>
        <label className="filter-select"><Filter size={16} /><select value={status} onChange={(event) => setStatus(event.target.value)}>{["全部", "待设计", "设计中", "待确认", "设计完成", "待处理", "待发货", "已发货", "已签收", "未收", "部分收款"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="quick-filters">
          {["待设计", "待发货", "待收款", "逾期"].map((item) => <button className={status === item ? "active" : ""} key={item} onClick={() => setStatus(item)}>{item}</button>)}
          {status !== "全部" && <button onClick={() => setStatus("全部")}>清除</button>}
        </div>
        <span className="result-count">{activeGroup ? `${activeCustomerOrders.length} 笔订单` : `${customerGroups.length} 位客户 / ${filtered.length} 笔订单`}</span>
      </div>
      {filtered.length === 0 ? <EmptyState icon={<PackageCheck size={28} />} title="没有符合条件的订单" description="调整筛选条件，或创建一笔新订单。" action={<Button onClick={onNew}><Plus size={16} />新建订单</Button>} /> :
      <div className="orders-split">
        <section className="panel order-list-panel">
          {!activeGroup ? (
            <div className="order-table compact-table">
              <div className="table-head"><span>客户</span><span>成交</span><span>待办</span><span>最近</span></div>
              {customerGroups.map((group) => {
                const latestOrder = group.orders[0];
                return (
                  <button
                    className="table-row"
                    key={group.customerId}
                    onClick={() => {
                      setActiveCustomerId(group.customerId);
                      if (latestOrder) onSelect(latestOrder);
                    }}
                  >
                    <span className="customer-cell"><i>{group.customerName.slice(0, 1)}</i><span><b title={group.customerName}>{group.customerName}</b><small>{group.orders.length} 笔订单 · 最近：{latestOrder ? orderProjectNames(latestOrder) : "暂无"}</small></span></span>
                    <span className="amount-cell"><b>{formatCents(group.totalCents)}</b><small>未收 {formatCents(group.unpaidCents)}</small></span>
                    <span>{group.pendingCount > 0 ? `${group.pendingCount} 笔待处理` : "暂无待办"}</span>
                    <span>{shortDate(latestOrder?.createdAt)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="order-layer-header">
                <Button variant="secondary" className="return-customer-button" onClick={() => setActiveCustomerId(null)}><ChevronLeft size={16} />返回客户列表</Button>
                <span><UsersRound size={15} />{activeGroup.customerName} 的订单</span>
              </div>
              <div className="order-table compact-table">
                <div className="table-head"><span>订单名称 / 平台 / 订单号</span><span>金额</span><span>状态</span><span>交付</span></div>
                {activeCustomerOrders.map((order) => <button
                  className={`table-row ${selectedOrder?.id === order.id ? "active" : ""}`}
                  key={order.id}
                  onClick={() => onSelect(order)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onSelect(order);
                    setMenu({ x: event.clientX, y: event.clientY, order });
                  }}
                >
                  <span className="customer-cell"><i>{order.customerName.slice(0, 1)}</i><span><b title={orderProjectNames(order)}>{orderProjectNames(order)}</b><small>{order.platform} · {order.externalOrderNo || "内部订单"}</small></span></span>
                  <span className="amount-cell"><b>{formatCents(order.totalCents)}</b><small>{order.paymentStatus}</small></span>
                  <span className="stacked-status"><StatusBadge value={order.designStatus} /><StatusBadge value={order.fulfillmentStatus} /></span><span>{shortDate(order.deliveryDueAt)}</span>
                </button>)}
              </div>
            </>
          )}
        </section>
        <OrderDetailPanel order={selectedOrder} customers={customers} files={files} libraryRoot={libraryRoot} folderRefreshKey={folderRefreshKey} onChanged={onChanged} onEdit={onEdit} onDelete={onDelete} />
      </div>}
      {menu && <div className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
        <button role="menuitem" onClick={() => { onSelect(menu.order); setMenu(null); }}>查看详情</button>
        <button role="menuitem" onClick={() => { onEdit(menu.order); setMenu(null); }}><Edit3 size={15} />修改订单</button>
        <button role="menuitem" className="danger" onClick={() => { onDelete(menu.order); setMenu(null); }}><Trash2 size={15} />删除订单</button>
      </div>}
    </div>
  );
}
