import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  FileClock,
  PackageOpen,
  Palette,
  Sparkles,
  UserPlus,
} from "lucide-react";

import { fileSize, formatCents, shortDate } from "../lib/format";
import { orderProjectNames } from "../lib/orders";
import type { DashboardSummary, Order, PageId } from "../lib/types";
import { Button, PageHeader, StatusBadge } from "../components/ui";

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function orderDueDate(order: Order) {
  return order.deliveryDueAt || order.designDueAt || "";
}

function isTodoOrder(order: Order) {
  return (
    order.receivedCents < order.totalCents ||
    order.fulfillmentStatus === "待发货" ||
    ["待设计", "设计中", "待确认"].includes(order.designStatus) ||
    Boolean(orderDueDate(order))
  );
}

function todoLabel(order: Order, today = todayString()) {
  const dueDate = orderDueDate(order);
  if (dueDate && dueDate < today && !["已签收", "已取消"].includes(order.fulfillmentStatus)) return "已逾期";
  if (order.receivedCents < order.totalCents) return "待收款";
  if (order.fulfillmentStatus === "待发货") return "待发货";
  if (["待设计", "设计中", "待确认"].includes(order.designStatus)) return order.designStatus;
  if (dueDate === today) return "今天到期";
  return "待跟进";
}

export function DashboardPage({
  summary,
  onNewCustomer,
  onNavigate,
  onSelectOrder,
}: {
  summary: DashboardSummary;
  onNewCustomer: () => void;
  onNavigate: (page: PageId) => void;
  onSelectOrder: (order: Order) => void;
}) {
  const cards = [
    { label: "待处理设计", value: summary.pendingDesign, note: "等待你推进的设计任务", icon: Palette, tone: "coral" },
    { label: "三天内到期", value: summary.dueSoon, note: "建议优先安排时间", icon: CalendarClock, tone: "purple" },
    { label: "待发货", value: summary.pendingShipment, note: "设计完成后及时发出", icon: PackageOpen, tone: "teal" },
    { label: "待收款", value: formatCents(summary.unpaidCents), note: "未收和部分收款合计", icon: CircleDollarSign, tone: "yellow" },
  ];
  const todoOrders = (summary.todoOrders?.length ? summary.todoOrders : summary.recentOrders.filter(isTodoOrder)).slice(0, 8);
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="今日工作概览"
        title="早上好，今天也要有条理"
        description="把需要设计、发货和收款的事情集中处理。"
        actions={<Button variant="secondary" onClick={onNewCustomer}><UserPlus size={17} />新建客户</Button>}
      />
      {summary.overdue > 0 && <div className="alert-banner"><AlertTriangle size={18} /><strong>有 {summary.overdue} 个订单已经逾期</strong><span>现在检查一下，避免遗漏交付。</span><button onClick={() => onNavigate("orders")}>查看订单 <ArrowRight size={15} /></button></div>}
      <div className="stat-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return <article className={`stat-card stat-${card.tone}`} key={card.label}><div className="stat-icon"><Icon size={22} /></div><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></article>;
        })}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="panel panel-large">
            <div className="panel-heading"><div><span className="eyebrow">今天先处理</span><h2>待办队列</h2></div><button className="text-button" onClick={() => onNavigate("orders")}>处理订单 <ArrowRight size={15} /></button></div>
            <div className="todo-list">
              {todoOrders.length === 0 ? (
                <div className="table-empty"><Sparkles size={20} />今天没有特别紧急的订单。</div>
              ) : todoOrders.map((order) => (
                <button className="todo-row" key={order.id} onClick={() => onSelectOrder(order)}>
                  <span className={`todo-label todo-${todoLabel(order)}`}>{todoLabel(order)}</span>
                  <span><b title={orderProjectNames(order)}>{orderProjectNames(order)}</b><small>{order.customerName} · {order.externalOrderNo || "内部订单"}</small></span>
                  <strong>{formatCents(Math.max(0, order.totalCents - order.receivedCents))}</strong>
                  <small>{shortDate(orderDueDate(order))}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="panel panel-large">
            <div className="panel-heading"><div><span className="eyebrow">订单节奏</span><h2>最近订单</h2></div><button className="text-button" onClick={() => onNavigate("orders")}>查看全部 <ArrowRight size={15} /></button></div>
            <div className="order-table">
              <div className="table-head"><span>项目 / 客户 / 订单</span><span>金额</span><span>设计进度</span><span>履约进度</span><span>交付日期</span></div>
              {summary.recentOrders.length === 0 && <div className="table-empty"><Sparkles size={20} />创建第一笔订单后，这里会出现你的工作节奏。</div>}
              {summary.recentOrders.map((order) => <button className="table-row" key={order.id} onClick={() => onSelectOrder(order)}>
                <span className="customer-cell"><i>{order.customerName.slice(0, 1)}</i><span><b title={orderProjectNames(order)}>{orderProjectNames(order)}</b><small>{order.customerName} · {order.platform} · {order.externalOrderNo || "内部订单"}</small></span></span>
                <strong>{formatCents(order.totalCents)}</strong><StatusBadge value={order.designStatus} /><StatusBadge value={order.fulfillmentStatus} /><span>{shortDate(order.deliveryDueAt)}</span>
              </button>)}
            </div>
          </section>
        </div>
        <aside className="dashboard-side">
          <section className="panel focus-panel">
            <div className="panel-heading"><div><span className="eyebrow">本月</span><h2>成交与收款</h2></div><CircleDollarSign size={20} /></div>
            <strong className="big-number">{formatCents(summary.monthRevenueCents)}</strong>
            <p>本月已记录收款金额</p>
            <div className="color-bars"><span /><span /><span /><span /><span /></div>
          </section>
          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">文件动态</span><h2>最近文件</h2></div><FileClock size={20} /></div>
            <div className="file-mini-list">{summary.recentFiles.length === 0 ? <p className="form-hint">暂无文件记录</p> : summary.recentFiles.slice(0, 5).map((file) => <div key={file.id}><i><Clock3 size={16} /></i><span><b>{file.name}</b><small>{file.category} · {fileSize(file.sizeBytes)}</small></span></div>)}</div>
            <button className="text-button full" onClick={() => onNavigate("files")}>打开文件中心 <ArrowRight size={15} /></button>
          </section>
        </aside>
      </div>
    </div>
  );
}
