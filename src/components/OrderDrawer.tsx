import { useEffect, useState } from "react";
import { ExternalLink, FilePlus2, FolderOpen, RefreshCw, WalletCards } from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { api } from "../lib/api";
import { formatCents, paymentProgress, shortDate } from "../lib/format";
import type { Order } from "../lib/types";
import { Button, Modal, StatusBadge } from "./ui";

export function OrderDrawer({ order, onClose, onChanged }: { order: Order; onClose: () => void; onChanged: () => void }) {
  const [designStatus, setDesignStatus] = useState(order.designStatus);
  const [fulfillmentStatus, setFulfillmentStatus] = useState(order.fulfillmentStatus);
  const [payment, setPayment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const uploadPath = async (path: string) => {
    setBusy(true);
    try {
      await api.addOrderFile(order.id, path, "订单文件");
      setMessage("文件已复制到订单文件夹");
      onChanged();
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (api.isDemo) return;
    let unlisten: (() => void) | undefined;
    getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type === "drop") {
        for (const path of event.payload.paths) await uploadPath(path);
      }
    }).then((value) => { unlisten = value; });
    return () => unlisten?.();
  }, [order.id]);

  return (
    <Modal title={`订单 ${order.externalOrderNo || "内部订单"}`} subtitle={`${order.customerName} · ${order.platform}`} onClose={onClose} wide>
      <div className="detail-hero">
        <div><span>订单应收</span><strong>{formatCents(order.totalCents)}</strong><small>已收 {formatCents(order.receivedCents)}</small></div>
        <div className="payment-meter"><span style={{ width: `${paymentProgress(order.totalCents, order.receivedCents)}%` }} /></div>
        <StatusBadge value={order.paymentStatus} />
      </div>
      <div className="detail-grid">
        <section className="detail-card">
          <h3>进度与截止日期</h3>
          <div className="form-grid two">
            <label><span>设计进度</span><select value={designStatus} onChange={(event) => setDesignStatus(event.target.value)}>{["无需设计", "待设计", "设计中", "待确认", "设计完成"].map((status) => <option key={status}>{status}</option>)}</select></label>
            <label><span>履约进度</span><select value={fulfillmentStatus} onChange={(event) => setFulfillmentStatus(event.target.value)}>{["待处理", "待发货", "已发货", "已签收", "已取消"].map((status) => <option key={status}>{status}</option>)}</select></label>
          </div>
          <div className="date-pair"><span>设计截止 <b>{shortDate(order.designDueAt)}</b></span><span>交付截止 <b>{shortDate(order.deliveryDueAt)}</b></span></div>
          <Button onClick={async () => { setBusy(true); await api.updateOrderStatus(order.id, designStatus, fulfillmentStatus); setBusy(false); onChanged(); }} disabled={busy}>保存进度</Button>
        </section>
        <section className="detail-card">
          <h3>订单文件夹</h3>
          <div className={`folder-state ${order.folderState}`}><FolderOpen size={20} /><div><strong>{order.folderState === "ready" ? "文件夹已创建" : "文件夹创建失败"}</strong><span>{order.folderPath ?? "可点击重试创建"}</span></div></div>
          <div className="button-row">
            {order.folderPath && <Button variant="secondary" onClick={() => api.openInExplorer(order.folderPath!)}><ExternalLink size={16} />打开文件夹</Button>}
            {order.folderState !== "ready" && <Button variant="secondary" onClick={async () => { await api.retryOrderFolder(order.id); onChanged(); }}><RefreshCw size={16} />重试</Button>}
          </div>
          <button className="drop-zone" disabled={busy} onClick={async () => { const path = await api.chooseFile(); if (path) await uploadPath(path); }}>
            <FilePlus2 size={26} /><strong>拖拽文件到窗口，或点击选择</strong><span>系统会复制文件，同名文件自动生成新版本</span>
          </button>
        </section>
      </div>
      <div className="detail-grid">
        <section className="detail-card">
          <h3>计价明细</h3>
          <div className="mini-list">{order.items.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{item.itemType}{item.printSpec ? ` · ${item.printSpec}` : ""}</small></span><strong>{item.quantity} × {formatCents(item.unitPriceCents)}</strong></div>)}</div>
        </section>
        <section className="detail-card">
          <h3>收款记录</h3>
          <div className="inline-row"><div className="money-input"><span>¥</span><input value={payment} type="number" min="0" step="0.01" onChange={(event) => setPayment(event.target.value)} placeholder="本次收款" /></div><Button onClick={async () => {
            const amountCents = Math.round(Number(payment) * 100);
            if (!amountCents) return;
            await api.addPayment(order.id, { amountCents, paidAt: new Date().toISOString().slice(0, 10), method: "手动记录", notes: "" });
            setPayment("");
            onChanged();
          }}><WalletCards size={16} />记录收款</Button></div>
          <div className="mini-list">{order.payments.length === 0 ? <p className="form-hint">暂无收款记录</p> : order.payments.map((item) => <div key={item.id}><span><b>{item.method}</b><small>{shortDate(item.paidAt)}</small></span><strong>{formatCents(item.amountCents)}</strong></div>)}</div>
        </section>
      </div>
      {message && <div className="inline-message">{message}</div>}
    </Modal>
  );
}
