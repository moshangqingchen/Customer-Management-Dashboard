import { ContactRound, Edit3, Plus, Search, Star, Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CustomerDetailPanel } from "../components/CustomerDetailPanel";
import { formatCents } from "../lib/format";
import type { Customer, Order } from "../lib/types";
import { Button, EmptyState, PageHeader, StarRating } from "../components/ui";

export function CustomersPage({
  customers,
  orders = [],
  selectedCustomerId,
  vipOnly = false,
  onSelect,
  onSelectOrder,
  onNew,
  onEdit,
  onDelete,
}: {
  customers: Customer[];
  orders?: Order[];
  selectedCustomerId?: string | null;
  vipOnly?: boolean;
  onSelect?: (customer: Customer) => void;
  onSelectOrder?: (order: Order) => void;
  onNew: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}) {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; customer: Customer } | null>(null);
  const filtered = useMemo(() => customers
    .filter((customer) => !vipOnly || customer.vipLevel > 0)
    .filter((customer) => JSON.stringify(customer).toLowerCase().includes(query.toLowerCase())), [customers, query, vipOnly]);
  const selectedCustomer = filtered.find((customer) => customer.id === selectedCustomerId) ?? filtered[0] ?? null;

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
      <PageHeader
        eyebrow={vipOnly ? "重要客户" : "客户档案"}
        title={vipOnly ? "星级 VIP 客户" : "客户管理"}
        description={vipOnly ? "所有已标星客户会自动汇总到这里。" : "统一管理跨平台身份、联系方式、地址与历史订单。"}
        actions={<Button onClick={onNew}><Plus size={17} />新建客户</Button>}
      />
      <div className="toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、电话、微信或平台网名…" /></label><span className="result-count">{filtered.length} 位客户</span></div>
      {filtered.length === 0 ? <EmptyState icon={vipOnly ? <Star size={28} /> : <ContactRound size={28} />} title={vipOnly ? "还没有星级 VIP" : "还没有客户"} description={vipOnly ? "在客户档案中点亮星级后，会自动出现在这里。" : "先创建客户，再为客户录入订单。"} action={<Button onClick={onNew}><Plus size={16} />新建客户</Button>} /> :
      <div className="customers-split">
      <div className="customer-list-panel">{filtered.map((customer) => <article
        className={`customer-card ${selectedCustomer?.id === customer.id ? "active" : ""}`}
        key={customer.id}
        onClick={() => onSelect?.(customer)}
        onContextMenu={(event) => {
          event.preventDefault();
          onSelect?.(customer);
          setMenu({ x: event.clientX, y: event.clientY, customer });
        }}
      >
        <div className="customer-card-top"><div className="avatar">{customer.name.slice(0, 2)}</div><div className="customer-title"><h3>{customer.name}</h3><StarRating value={customer.vipLevel} compact /></div><button className="icon-button" onClick={(event) => { event.stopPropagation(); onEdit(customer); }}><Edit3 size={16} /></button></div>
        <p className="customer-note">{customer.notes || "暂无客户备注"}</p>
        <div className="identity-list">{customer.platformIdentities.length === 0 ? <span>暂无平台身份</span> : customer.platformIdentities.slice(0, 3).map((identity, index) => <span key={index} className={`platform platform-${identity.platform}`}>{identity.platform}<b>{identity.handle || identity.account}</b></span>)}</div>
        <div className="tag-list">{customer.tags.map((tag) => <span key={tag}><Tag size={12} />{tag}</span>)}</div>
        <div className="customer-stats"><span><b>{customer.orderCount}</b><small>历史订单</small></span><span><b>{formatCents(customer.totalSpentCents)}</b><small>累计成交</small></span></div>
        <div className="customer-contact"><span>{customer.phone || "未填写电话"}</span><span>{customer.wechat || "未填写微信"}</span></div>
      </article>)}</div>
      <CustomerDetailPanel customer={selectedCustomer} orders={orders} onSelectOrder={onSelectOrder} onEdit={onEdit} onDelete={onDelete} />
      </div>}
      {menu && <div className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
        <button role="menuitem" onClick={() => { onEdit(menu.customer); setMenu(null); }}><Edit3 size={15} />修改客户</button>
        <button role="menuitem" className="danger" onClick={() => { onDelete(menu.customer); setMenu(null); }}><Trash2 size={15} />删除客户</button>
      </div>}
    </div>
  );
}
