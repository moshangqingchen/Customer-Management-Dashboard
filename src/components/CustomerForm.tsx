import { useEffect, useState } from "react";
import type { DragEvent } from "react";
import { MapPin, Plus, QrCode, Trash2, UserRound } from "lucide-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { api } from "../lib/api";
import type { Customer, NewCustomer } from "../lib/types";
import { Button, StarRating } from "./ui";

const emptyCustomer: NewCustomer = {
  name: "",
  phone: "",
  wechat: "",
  vipLevel: 0,
  notes: "",
  tags: [],
  platformIdentities: [{ platform: "微信", handle: "", account: "" }],
  addresses: [],
  qrCodePath: null,
};

export function CustomerForm({ customer, onSaved, onCancel }: { customer?: Customer; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<NewCustomer>(customer ? {
    name: customer.name,
    phone: customer.phone,
    wechat: customer.wechat,
    vipLevel: customer.vipLevel,
    notes: customer.notes,
    tags: customer.tags,
    platformIdentities: customer.platformIdentities,
    addresses: customer.addresses,
    qrCodePath: customer.qrCodePath,
  } : emptyCustomer);
  const [tags, setTags] = useState(form.tags.join("，"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [qrPreview, setQrPreview] = useState("");

  const setQrPath = (path: string) => {
    if (path.trim()) setForm((current) => ({ ...current, qrCodePath: path }));
  };

  useEffect(() => {
    if (!form.qrCodePath) {
      setQrPreview("");
      return;
    }
    api.readImageDataUrl(form.qrCodePath).then(setQrPreview).catch(() => setQrPreview(""));
  }, [form.qrCodePath]);

  useEffect(() => {
    if (api.isDemo) return;
    let unlisten: (() => void) | undefined;
    getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type === "drop") {
        const [path] = event.payload.paths;
        if (path) setQrPath(path);
      }
    }).then((value) => { unlisten = value; });
    return () => unlisten?.();
  }, []);

  const handleQrDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0] as File & { path?: string };
    const path = file?.path || file?.name || "";
    setQrPath(path);
  };

  const updateIdentity = (index: number, key: "platform" | "handle" | "account", value: string) => {
    setForm((current) => ({
      ...current,
      platformIdentities: current.platformIdentities.map((identity, identityIndex) =>
        identityIndex === index ? { ...identity, [key]: value } : identity),
    }));
  };

  const updateAddress = (index: number, key: "label" | "recipient" | "phone" | "address", value: string) => {
    setForm((current) => ({
      ...current,
      addresses: current.addresses.map((address, addressIndex) =>
        addressIndex === index ? { ...address, [key]: value } : address),
    }));
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError("请填写客户名称");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input = { ...form, tags: tags.split(/[,，;；]/).map((tag) => tag.trim()).filter(Boolean) };
      if (customer) await api.updateCustomer(customer.id, input);
      else await api.createCustomer(input);
      onSaved();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-stack">
      <section className="form-section">
        <div className="section-title"><UserRound size={18} /><div><h3>基础资料</h3><p>客户名称和常用联系方式</p></div></div>
        <div className="form-grid three">
          <label><span>客户名称 *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：林女士 / 星河工作室" /></label>
          <label><span>电话</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="手机号或座机" /></label>
          <label><span>微信号</span><input value={form.wechat} onChange={(event) => setForm({ ...form, wechat: event.target.value })} placeholder="常用微信号" /></label>
        </div>
        <div className="form-grid two">
          <label><span>标签</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="复购，加急，设计客户" /></label>
          <label className="rating-field"><span>星级 VIP</span><StarRating value={form.vipLevel} onChange={(vipLevel) => setForm({ ...form, vipLevel })} /></label>
        </div>
        <label><span>备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="偏好、沟通方式、注意事项…" /></label>
      </section>

      <section className="form-section">
        <div className="section-title-row">
          <div className="section-title"><QrCode size={18} /><div><h3>平台身份与二维码</h3><p>同一客户可关联多个平台网名</p></div></div>
          <Button variant="ghost" onClick={() => setForm({ ...form, platformIdentities: [...form.platformIdentities, { platform: "闲鱼", handle: "", account: "" }] })}><Plus size={16} />添加平台</Button>
        </div>
        {form.platformIdentities.map((identity, index) => (
          <div className="inline-row" key={index}>
            <select value={identity.platform} onChange={(event) => updateIdentity(index, "platform", event.target.value)}>
              {["微信", "闲鱼", "淘宝", "小红书", "抖音", "其他"].map((platform) => <option key={platform}>{platform}</option>)}
            </select>
            <input value={identity.handle} onChange={(event) => updateIdentity(index, "handle", event.target.value)} placeholder="平台网名 / 昵称" />
            <input value={identity.account} onChange={(event) => updateIdentity(index, "account", event.target.value)} placeholder="平台账号" />
            <button className="icon-button danger" onClick={() => setForm({ ...form, platformIdentities: form.platformIdentities.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={16} /></button>
          </div>
        ))}
        <div className="qr-picker qr-drop-zone" aria-label="拖入客户二维码" onDragOver={(event) => event.preventDefault()} onDrop={handleQrDrop}>
          <div>{qrPreview ? <img src={qrPreview} alt="客户二维码预览" /> : <QrCode size={22} />}<span>{form.qrCodePath ? form.qrCodePath.split(/[\\/]/).pop() : "点击选择，或把客户二维码图片拖到这里"}</span></div>
          <Button variant="secondary" onClick={async () => {
            const path = await api.chooseFile();
            if (path) setForm({ ...form, qrCodePath: path });
          }}>选择二维码图片</Button>
        </div>
      </section>

      <section className="form-section">
        <div className="section-title-row">
          <div className="section-title"><MapPin size={18} /><div><h3>收货地址</h3><p>可保存多个常用地址</p></div></div>
          <Button variant="ghost" onClick={() => setForm({ ...form, addresses: [...form.addresses, { label: "常用地址", recipient: form.name, phone: form.phone, address: "" }] })}><Plus size={16} />添加地址</Button>
        </div>
        {form.addresses.length === 0 && <p className="form-hint">暂无地址，可在需要发货时补充。</p>}
        {form.addresses.map((address, index) => (
          <div className="address-card" key={index}>
            <div className="form-grid three">
              <label><span>地址名称</span><input value={address.label} onChange={(event) => updateAddress(index, "label", event.target.value)} /></label>
              <label><span>收件人</span><input value={address.recipient} onChange={(event) => updateAddress(index, "recipient", event.target.value)} /></label>
              <label><span>联系电话</span><input value={address.phone} onChange={(event) => updateAddress(index, "phone", event.target.value)} /></label>
            </div>
            <div className="inline-row"><input value={address.address} onChange={(event) => updateAddress(index, "address", event.target.value)} placeholder="详细地址" /><button className="icon-button danger" onClick={() => setForm({ ...form, addresses: form.addresses.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={16} /></button></div>
          </div>
        ))}
      </section>

      {error && <div className="form-error">{error}</div>}
      <div className="form-actions"><Button variant="secondary" onClick={onCancel}>取消</Button><Button onClick={submit} disabled={saving}>{saving ? "保存中…" : customer ? "保存修改" : "创建客户"}</Button></div>
    </div>
  );
}
