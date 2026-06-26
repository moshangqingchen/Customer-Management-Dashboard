import { DatabaseBackup, FolderCog, HardDrive, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { api } from "../lib/api";
import type { AppSettings } from "../lib/types";
import { Button, PageHeader } from "../components/ui";

export function SettingsPage({ settings, onChanged }: { settings: AppSettings; onChanged: () => void }) {
  const [message, setMessage] = useState("");
  const choose = async (type: "library" | "backup") => {
    const path = await api.chooseDirectory();
    if (!path) return;
    if (type === "library") await api.setLibraryRoot(path);
    else await api.setBackupDir(path);
    setMessage("设置已保存");
    onChanged();
  };
  return (
    <div className="page-content">
      <PageHeader eyebrow="本地优先" title="设置" description="管理客户文件库与备份位置。App 不需要登录，也不会自动上传数据。" />
      <div className="settings-grid">
        <section className="settings-card"><div className="settings-icon"><FolderCog size={22} /></div><div><h2>客户文件库</h2><p>新建订单后，系统会在这里自动创建客户和订单文件夹。</p><code>{settings.libraryRoot ?? "尚未设置"}</code></div><Button variant="secondary" onClick={() => choose("library")}>更换目录</Button></section>
        <section className="settings-card"><div className="settings-icon purple"><DatabaseBackup size={22} /></div><div><h2>数据库自动备份</h2><p>每天启动时自动备份一次，最多保留最近 30 份。</p><code>{settings.backupDir ?? "默认保存在 Windows 文档目录"}</code></div><Button variant="secondary" onClick={() => choose("backup")}>设置备份目录</Button></section>
        <section className="settings-card static"><div className="settings-icon yellow"><ShieldCheck size={22} /></div><div><h2>隐私与数据</h2><p>不设置额外应用锁，依赖 Windows 账户与锁屏保护。业务数据存储在本机 SQLite 数据库中。</p></div></section>
        <section className="settings-card static"><div className="settings-icon coral"><HardDrive size={22} /></div><div><h2>文件处理规则</h2><p>拖入文件时复制原文件；同名不覆盖；删除时移动到文件库的 _回收站，由你手动清理。</p></div></section>
      </div>
      {message && <div className="inline-message">{message}</div>}
    </div>
  );
}

