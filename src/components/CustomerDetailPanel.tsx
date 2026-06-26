import { Copy, Edit3, MapPin, PackageCheck, QrCode, Tag, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../lib/api";
import { formatCents, shortDate } from "../lib/format";
import { orderProjectNames } from "../lib/orders";
import type { Customer, Order } from "../lib/types";
import { EmptyState, StarRating, StatusBadge } from "./ui";

async function copyText(value: string) {
  if (!value.trim()) return false;
  await navigator.clipboard?.writeText(value);
  return true;
}

export function CustomerDetailPanel({
  customer,
  orders = [],
  onSelectOrder,
  onEdit,
  onDelete,
}: {
  customer?: Customer | null;
  orders?: Order[];
  onSelectOrder?: (order: Order) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}) {
  const [copied, setCopied] = useState("");
  const [qrPreview, setQrPreview] = useState("");
  const customerOrders = useMemo(
    () => orders
      .filter((order) => order.customerId === customer?.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [orders, customer?.id],
  );

  useEffect(() => {
    setCopied("");
    setQrPreview("");
    if (!customer?.qrCodePath) return;
    api.readImageDataUrl(customer.qrCodePath).then(setQrPreview).catch(() => setQrPreview(""));
  }, [customer?.id, customer?.qrCodePath]);

  const copy = async (label: string, value: string) => {
    if (await copyText(value)) setCopied(`已复制${label}`);
  };

  if (!customer) {
    return (
      <aside className="customer-detail-panel empty">
        <EmptyState icon={<UserRound size={28} />} title="选择一个客户" description="点击左侧客户后，这里会显示联系方式、平台身份、地址和二维码。" />
      </aside>
    );
  }

  return (
    <aside className="customer-detail-panel">
      <div className="detail-panel-header">
        <div>
          <span className="eyebrow">客户资料</span>
          <h2>客户详情</h2>
          <p>{customer.name} · {customer.orderCount} 笔订单 · {formatCents(customer.totalSpentCents)}</p>
        </div>
        <div className="panel-actions">
          <button className="icon-button" onClick={() => onEdit(customer)} aria-label="修改客户"><Edit3 size={16} /></button>
          <button className="icon-button danger" onClick={() => onDelete(customer)} aria-label="删除客户"><Trash2 size={16} /></button>
        </div>
      </div>

      <section className="detail-card customer-hero-card">
        <div className="customer-detail-avatar">{customer.name.slice(0, 2)}</div>
        <div>
          <h3>{customer.name}</h3>
          <StarRating value={customer.vipLevel} compact />
          <p>{customer.notes || "暂无备注"}</p>
        </div>
      </section>

      <section className="detail-card">
        <h3><UserRound size={16} /> 联系方式</h3>
        <div className="copy-list">
          <span><b>电话</b><strong>{customer.phone || "未填写"}</strong><button onClick={() => copy("电话", customer.phone)} aria-label="复制电话"><Copy size={14} /></button></span>
          <span><b>微信</b><strong>{customer.wechat || "未填写"}</strong><button onClick={() => copy("微信", customer.wechat)} aria-label="复制微信"><Copy size={14} /></button></span>
        </div>
      </section>

      <section className="detail-card">
        <h3><QrCode size={16} /> 平台身份与二维码</h3>
        <div className="copy-list">
          {customer.platformIdentities.length === 0 ? <p className="form-hint">暂无平台身份</p> : customer.platformIdentities.map((identity, index) => {
            const value = [identity.handle, identity.account].filter(Boolean).join(" / ");
            return <span key={index}><b>{identity.platform}</b><strong>{value || "未填写"}</strong><button onClick={() => copy(identity.platform, value)} aria-label={`复制${identity.platform}`}><Copy size={14} /></button></span>;
          })}
        </div>
        <div className="qr-detail-preview">
          {qrPreview ? <img src={qrPreview} alt="客户二维码" /> : <QrCode size={28} />}
          <span>{customer.qrCodePath ? customer.qrCodePath.split(/[\\/]/).pop() : "暂无二维码"}</span>
        </div>
      </section>

      <section className="detail-card">
        <h3><PackageCheck size={16} /> 历史订单</h3>
        {customerOrders.length === 0 ? <p className="form-hint">暂无历史订单</p> : (
          <div className="history-order-list">
            {customerOrders.map((order) => (
              <button key={order.id} className="history-order-row" onClick={() => onSelectOrder?.(order)}>
                <span>
                  <strong>{orderProjectNames(order)}</strong>
                  <small>{order.platform} · {order.externalOrderNo || "内部订单"} · {shortDate(order.createdAt)}</small>
                </span>
                <span>
                  <b>{formatCents(order.totalCents)}</b>
                  <small>{order.paymentStatus}</small>
                </span>
                <i><StatusBadge value={order.designStatus} /><StatusBadge value={order.fulfillmentStatus} /></i>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="detail-card">
        <h3><MapPin size={16} /> 常用地址</h3>
        <div className="address-list">
          {customer.addresses.length === 0 ? <p className="form-hint">暂无地址</p> : customer.addresses.map((address, index) => {
            const fullAddress = `${address.recipient} ${address.phone} ${address.address}`.trim();
            return <div key={index}><strong>{address.label || "地址"} · {address.recipient}</strong><span>{address.phone}</span><p>{address.address}</p><button className="text-button" onClick={() => copy("地址", fullAddress)} aria-label={`复制地址${index + 1}`}><Copy size={14} />复制地址</button></div>;
          })}
        </div>
      </section>

      <section className="detail-card">
        <h3><Tag size={16} /> 标签</h3>
        <div className="tag-list">{customer.tags.length === 0 ? <span>暂无标签</span> : customer.tags.map((tag) => <span key={tag}><Tag size={12} />{tag}</span>)}</div>
      </section>

      {copied && <div className="inline-message">{copied}</div>}
    </aside>
  );
}
