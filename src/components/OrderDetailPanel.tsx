import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Edit3, ExternalLink, FilePlus2, FolderOpen, MapPin, RefreshCw, Trash2, Truck, UserRound, WalletCards } from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { api } from "../lib/api";
import { fileSize, formatCents, paymentProgress, shortDate } from "../lib/format";
import { absoluteFilePath, fileKindLabel } from "../lib/files";
import { orderProjectNames } from "../lib/orders";
import type { AddressInput, Customer, FileRecord, NewOrder, Order } from "../lib/types";
import { Button, EmptyState, StatusBadge } from "./ui";
import { FileThumbnail } from "./FileThumbnail";

function addressLabel(address: AddressInput) {
  return `${address.label || "地址"} | ${address.recipient || "未填收件人"} | ${address.phone || "未填电话"} | ${address.address || "未填详细地址"}`;
}

function findAddressChoice(customer: Customer | undefined, address?: AddressInput | null) {
  if (!customer || !address) return "";
  const index = customer.addresses.findIndex((item) =>
    item.label === address.label &&
    item.recipient === address.recipient &&
    item.phone === address.phone &&
    item.address === address.address);
  return index >= 0 ? String(index) : "custom";
}

function fileMergeKey(file: FileRecord) {
  return file.name.trim().toLocaleLowerCase();
}

function mergeOrderFiles(folderFiles: FileRecord[], databaseFiles: FileRecord[]) {
  const seen = new Set<string>();
  const merged: FileRecord[] = [];
  for (const file of [...folderFiles, ...databaseFiles]) {
    const key = fileMergeKey(file);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(file);
  }
  return merged.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) || left.name.localeCompare(right.name, "zh-Hans-CN"),
  );
}

async function copyText(value: string) {
  if (!value.trim()) return false;
  await navigator.clipboard?.writeText(value);
  return true;
}

function editableOrderInput(order: Order, patch: Partial<NewOrder>): NewOrder {
  return {
    customerId: order.customerId,
    platform: order.platform,
    platformAccount: order.platformAccount,
    externalOrderNo: order.externalOrderNo,
    designStatus: order.designStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    designDueAt: order.designDueAt,
    deliveryDueAt: order.deliveryDueAt,
    notes: order.notes,
    tags: order.tags,
    items: order.items.map((item) => ({
      itemType: item.itemType,
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      printSpec: item.printSpec,
      sourceQuoteId: item.sourceQuoteId,
      sourceFactoryId: item.sourceFactoryId,
      sourceFactoryName: item.sourceFactoryName,
      sourceQuoteSummary: item.sourceQuoteSummary,
      sourceProductionCostCents: item.sourceProductionCostCents,
      sourceShippingCostCents: item.sourceShippingCostCents,
    })),
    shipmentCompany: order.shipmentCompany,
    shipmentTrackingNo: order.shipmentTrackingNo,
    shippingAddress: order.shippingAddress,
    ...patch,
  };
}

export function OrderDetailPanel({
  order,
  customers,
  files = [],
  libraryRoot,
  folderRefreshKey = 0,
  onChanged,
  onEdit,
  onDelete,
}: {
  order?: Order | null;
  customers: Customer[];
  files?: FileRecord[];
  libraryRoot?: string | null;
  folderRefreshKey?: number;
  onChanged: () => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
}) {
  const customer = customers.find((item) => item.id === order?.customerId);
  const [designStatus, setDesignStatus] = useState(order?.designStatus ?? "待设计");
  const [fulfillmentStatus, setFulfillmentStatus] = useState(order?.fulfillmentStatus ?? "待处理");
  const [shipmentCompany, setShipmentCompany] = useState(order?.shipmentCompany ?? "");
  const [shipmentTrackingNo, setShipmentTrackingNo] = useState(order?.shipmentTrackingNo ?? "");
  const [shippingAddress, setShippingAddress] = useState<AddressInput | null>(order?.shippingAddress ?? null);
  const [addressChoice, setAddressChoice] = useState(findAddressChoice(customer, order?.shippingAddress));
  const [payment, setPayment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");
  const [folderFiles, setFolderFiles] = useState<FileRecord[]>([]);
  const databaseOrderFiles = useMemo(() => files.filter((file) => file.orderId === order?.id), [files, order?.id]);
  const orderFiles = useMemo(() => mergeOrderFiles(folderFiles, databaseOrderFiles), [folderFiles, databaseOrderFiles]);
  const sourceProductionCost = useMemo(
    () => order?.items.reduce((sum, item) => sum + item.sourceProductionCostCents, 0) ?? 0,
    [order?.items],
  );
  const sourceShippingCost = useMemo(
    () => order?.items.reduce((sum, item) => sum + item.sourceShippingCostCents, 0) ?? 0,
    [order?.items],
  );
  const sourceCost = sourceProductionCost + sourceShippingCost;

  useEffect(() => {
    setDesignStatus(order?.designStatus ?? "待设计");
    setFulfillmentStatus(order?.fulfillmentStatus ?? "待处理");
    setShipmentCompany(order?.shipmentCompany ?? "");
    setShipmentTrackingNo(order?.shipmentTrackingNo ?? "");
    setShippingAddress(order?.shippingAddress ?? null);
    setAddressChoice(findAddressChoice(customer, order?.shippingAddress));
    setPayment("");
    setMessage("");
    setCopied("");
  }, [order?.id]);

  useEffect(() => {
    let alive = true;
    setFolderFiles([]);
    if (!order?.folderPath) return () => { alive = false; };

    api.listOrderFolderFiles(order.folderPath, order.id, order.customerId)
      .then((nextFiles) => {
        if (alive) setFolderFiles(nextFiles);
      })
      .catch((reason) => {
        if (alive) setMessage(`读取订单文件夹失败：${String(reason)}`);
      });

    return () => { alive = false; };
  }, [order?.id, order?.folderPath, order?.customerId, folderRefreshKey]);

  const uploadPath = async (path: string) => {
    if (!order) return;
    setBusy(true);
    try {
      await api.addOrderFile(order.id, path, "订单文件");
      if (order.folderPath) {
        setFolderFiles(await api.listOrderFolderFiles(order.folderPath, order.id, order.customerId));
      }
      setMessage("文件已复制到订单文件夹");
      onChanged();
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (api.isDemo || !order) return;
    let unlisten: (() => void) | undefined;
    getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type === "drop") {
        for (const path of event.payload.paths) await uploadPath(path);
      }
    }).then((value) => { unlisten = value; });
    return () => unlisten?.();
  }, [order?.id]);

  const selectAddress = (value: string) => {
    setAddressChoice(value);
    if (value === "") {
      setShippingAddress(null);
      return;
    }
    if (value === "custom") return;
    setShippingAddress(customer?.addresses[Number(value)] ?? null);
  };

  const saveQuickEdits = async () => {
    if (!order) return;
    setBusy(true);
    setMessage("");
    try {
      await api.updateOrder(order.id, editableOrderInput(order, {
        designStatus,
        fulfillmentStatus,
        shipmentCompany,
        shipmentTrackingNo,
        shippingAddress,
      }));
      setMessage("订单详情已保存");
      onChanged();
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (label: string, value: string) => {
    if (await copyText(value)) {
      setCopied(`已复制${label}`);
      window.setTimeout(() => setCopied((current) => current === `已复制${label}` ? "" : current), 1400);
    }
  };

  const applyStatusPreset = async (nextDesignStatus: string, nextFulfillmentStatus: string) => {
    if (!order) return;
    setBusy(true);
    setMessage("");
    try {
      await api.updateOrderStatus(order.id, nextDesignStatus, nextFulfillmentStatus);
      setDesignStatus(nextDesignStatus);
      setFulfillmentStatus(nextFulfillmentStatus);
      setMessage("订单状态已更新");
      onChanged();
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setBusy(false);
    }
  };

  const settleRemainingPayment = async () => {
    if (!order) return;
    const remainingCents = Math.max(0, order.totalCents - order.receivedCents);
    if (!remainingCents) return;
    setBusy(true);
    setMessage("");
    try {
      await api.addPayment(order.id, { amountCents: remainingCents, paidAt: new Date().toISOString().slice(0, 10), method: "结清尾款", notes: "" });
      setMessage("尾款已结清");
      onChanged();
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setBusy(false);
    }
  };

  if (!order) {
    return (
      <aside className="order-detail-panel empty">
        <EmptyState icon={<Truck size={28} />} title="选择一笔订单" description="点击左侧订单后，这里会显示客户、地址、快递、文件夹和收款详情。" />
      </aside>
    );
  }

  return (
    <aside className="order-detail-panel">
      <div className="detail-panel-header">
        <div>
          <span className="eyebrow">订单详情 · 快速查看与修改</span>
          <h2 title={orderProjectNames(order)}>{orderProjectNames(order)}</h2>
          <p>{order.customerName} · {order.platform} · {order.externalOrderNo || "内部订单"}</p>
        </div>
        <div className="panel-actions">
          <button className="icon-button" onClick={() => onEdit(order)} aria-label="修改订单"><Edit3 size={16} /></button>
          <button className="icon-button danger" onClick={() => onDelete(order)} aria-label="删除订单"><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="detail-hero compact">
        <div><span>订单应收</span><strong>{formatCents(order.totalCents)}</strong><small>已收 {formatCents(order.receivedCents)}</small></div>
        <div className="payment-meter"><span style={{ width: `${paymentProgress(order.totalCents, order.receivedCents)}%` }} /></div>
        <StatusBadge value={order.paymentStatus} />
      </div>
      <div className={`profit-strip ${sourceShippingCost > 0 ? "with-shipping" : ""}`}>
        <span><b>生产成本</b><strong>{formatCents(sourceProductionCost)}</strong></span>
        {sourceShippingCost > 0 && <span><b>运费</b><strong>{formatCents(sourceShippingCost)}</strong></span>}
        <span><b>预估毛利</b><strong className={order.totalCents - sourceCost < 0 ? "negative" : ""}>{formatCents(order.totalCents - sourceCost)}</strong></span>
        <span><b>成本口径</b><strong>生产价 + 运费</strong></span>
      </div>

      <section className="detail-card">
        <h3><UserRound size={16} /> 客户与平台</h3>
        <div className="info-list copy-info-list">
          <span><b>客户</b><strong>{order.customerName}</strong><button type="button" onClick={() => copy("客户", order.customerName)} aria-label="复制客户"><Copy size={13} /></button></span>
          <span><b>电话</b><strong>{order.customerPhone || customer?.phone || "未填写"}</strong>{(order.customerPhone || customer?.phone) && <button type="button" onClick={() => copy("电话", order.customerPhone || customer?.phone || "")} aria-label="复制电话"><Copy size={13} /></button>}</span>
          <span><b>微信</b><strong>{order.customerWechat || customer?.wechat || "未填写"}</strong>{(order.customerWechat || customer?.wechat) && <button type="button" onClick={() => copy("微信", order.customerWechat || customer?.wechat || "")} aria-label="复制微信"><Copy size={13} /></button>}</span>
          <span><b>网名</b><strong>{order.platformAccount || "未填写"}</strong>{order.platformAccount && <button type="button" onClick={() => copy("网名", order.platformAccount)} aria-label="复制网名"><Copy size={13} /></button>}</span>
        </div>
      </section>

      <section className="detail-card">
        <h3><Truck size={16} /> 状态、地址与快递</h3>
        <div className="form-grid two">
          <label><span>设计状态</span><select value={designStatus} onChange={(event) => setDesignStatus(event.target.value)}>{["无需设计", "待设计", "设计中", "待确认", "设计完成"].map((status) => <option key={status}>{status}</option>)}</select></label>
          <label><span>履约状态</span><select value={fulfillmentStatus} onChange={(event) => setFulfillmentStatus(event.target.value)}>{["待处理", "待发货", "已发货", "已签收", "已取消"].map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>
        <div className="status-shortcuts">
          <button type="button" onClick={() => applyStatusPreset("待设计", "待处理")} disabled={busy}><CheckCircle2 size={14} />待设计</button>
          <button type="button" onClick={() => applyStatusPreset("设计完成", "待发货")} disabled={busy}><CheckCircle2 size={14} />设计完成</button>
          <button type="button" onClick={() => applyStatusPreset(designStatus, "已发货")} disabled={busy}><CheckCircle2 size={14} />已发货</button>
          <button type="button" onClick={() => applyStatusPreset(designStatus, "已签收")} disabled={busy}><CheckCircle2 size={14} />已签收</button>
        </div>
        <label><span>收货地址</span><select value={addressChoice} onChange={(event) => selectAddress(event.target.value)}>
          <option value="">不选择地址</option>
          {customer?.addresses.map((address, index) => <option value={String(index)} key={`${address.label}-${index}`}>{addressLabel(address)}</option>)}
          {shippingAddress && addressChoice === "custom" && <option value="custom">{addressLabel(shippingAddress)}</option>}
        </select></label>
        {shippingAddress ? <div className="address-preview"><MapPin size={15} /><div><strong>{shippingAddress.recipient || "未填收件人"} {shippingAddress.phone}</strong><span>{shippingAddress.address}</span></div><button type="button" className="copy-mini-button" onClick={() => copy("地址", addressLabel(shippingAddress))} aria-label="复制地址"><Copy size={13} /></button></div> : <p className="form-hint">这笔订单暂未选择收货地址。</p>}
        <div className="form-grid two">
          <label><span>快递公司</span><input value={shipmentCompany} onChange={(event) => setShipmentCompany(event.target.value)} /></label>
          <label><span>快递单号</span><input value={shipmentTrackingNo} onChange={(event) => setShipmentTrackingNo(event.target.value)} /></label>
        </div>
        {shipmentTrackingNo && <button type="button" className="text-button inline-copy-action" onClick={() => copy("快递单号", shipmentTrackingNo)}><Copy size={14} />复制快递单号</button>}
        <div className="date-pair"><span>设计截止 <b>{shortDate(order.designDueAt)}</b></span><span>交付截止 <b>{shortDate(order.deliveryDueAt)}</b></span></div>
        <Button onClick={saveQuickEdits} disabled={busy}>保存详情</Button>
      </section>

      <section className="detail-card">
        <h3><FolderOpen size={16} /> 文件夹</h3>
        <div className={`folder-state ${order.folderState}`}><FolderOpen size={20} /><div><strong>{order.folderState === "ready" ? "文件夹已创建" : "文件夹创建失败"}</strong><span>{order.folderPath ?? "可点击重试创建"}</span></div></div>
        <div className="button-row">
          {order.folderPath && <Button variant="secondary" onClick={() => api.openInExplorer(order.folderPath!)}><ExternalLink size={16} />打开</Button>}
          {order.folderState !== "ready" && <Button variant="secondary" onClick={async () => { await api.retryOrderFolder(order.id); onChanged(); }}><RefreshCw size={16} />重试</Button>}
        </div>
        <button className="drop-zone compact" disabled={busy} onClick={async () => { const path = await api.chooseFile(); if (path) await uploadPath(path); }}>
          <FilePlus2 size={22} /><strong>拖入或选择文件</strong><span>复制到受管文件库，不覆盖原文件</span>
        </button>
        {orderFiles.length > 0 && (
          <div className="order-file-section">
            <div className="order-files-heading"><strong>订单文件</strong><span>{orderFiles.length} 个订单文件</span></div>
            <div className="order-file-list">
              {orderFiles.map((file) => {
                const path = absoluteFilePath(file, libraryRoot);
                return (
                  <div className="order-file-row" key={file.id}>
                    <FileThumbnail file={file} libraryRoot={libraryRoot} compact />
                    <div>
                      <strong>{file.name}</strong>
                      <span>{file.category || fileKindLabel(file)} · {fileSize(file.sizeBytes)} · {shortDate(file.createdAt)}</span>
                    </div>
                    <button className="icon-button" onClick={() => api.openInExplorer(path)} aria-label={`打开${file.name}`}><FolderOpen size={16} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="detail-card">
        <h3>计价明细</h3>
        <div className="mini-list">{order.items.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{item.itemType}{item.printSpec ? ` · ${item.printSpec}` : ""}{item.sourceFactoryName ? ` · ${item.sourceFactoryName} · 成本 ${formatCents(item.sourceProductionCostCents + item.sourceShippingCostCents)}` : ""}</small>{item.sourceQuoteSummary && <small>{item.sourceQuoteSummary}</small>}</span><strong>{item.quantity} × {formatCents(item.unitPriceCents)}</strong></div>)}</div>
      </section>

      <section className="detail-card">
        <h3>收款记录</h3>
        <div className="inline-row"><div className="money-input"><span>¥</span><input value={payment} type="number" min="0" step="0.01" onChange={(event) => setPayment(event.target.value)} placeholder="本次收款" /></div><Button onClick={async () => {
          const amountCents = Math.round(Number(payment) * 100);
          if (!amountCents) return;
          await api.addPayment(order.id, { amountCents, paidAt: new Date().toISOString().slice(0, 10), method: "手动记录", notes: "" });
          setPayment("");
          onChanged();
        }}><WalletCards size={16} />记录</Button>{order.totalCents > order.receivedCents && <Button variant="secondary" onClick={settleRemainingPayment} disabled={busy}>结清尾款</Button>}</div>
        <div className="mini-list">{order.payments.length === 0 ? <p className="form-hint">暂无收款记录</p> : order.payments.map((item) => <div key={item.id}><span><b>{item.method}</b><small>{shortDate(item.paidAt)}</small></span><strong>{formatCents(item.amountCents)}</strong></div>)}</div>
      </section>

      {order.notes && <section className="detail-card"><h3>备注</h3><p className="detail-note">{order.notes}</p></section>}
      {(message || copied) && <div className="inline-message">{message || copied}</div>}
    </aside>
  );
}
