import { useState } from "react";
import { FolderHeart, HardDrive, Sparkles } from "lucide-react";

import { api } from "../lib/api";
import { Button } from "../components/ui";

export function Onboarding({ onReady }: { onReady: () => void }) {
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="onboarding">
      <section className="onboarding-card">
        <div className="onboarding-art"><div><Sparkles size={30} /></div><FolderHeart size={76} /></div>
        <span className="eyebrow">第一次使用</span>
        <h1>先选择你的客户文件库</h1>
        <p>以后每次新建订单，系统都会自动为客户创建文件夹，并把设计稿、成品和资料整理到对应订单中。</p>
        <button className="path-picker" onClick={async () => { const selected = await api.chooseDirectory(); if (selected) setPath(selected); }}><HardDrive size={20} /><span>{path || "点击选择数据盘或网盘同步目录"}</span></button>
        <div className="onboarding-points"><span>原文件会保留</span><span>同名文件不覆盖</span><span>完全离线可用</span></div>
        <Button disabled={!path || busy} onClick={async () => { setBusy(true); await api.setLibraryRoot(path); onReady(); }}>{busy ? "正在准备…" : "开始使用工作台"}</Button>
      </section>
    </main>
  );
}
