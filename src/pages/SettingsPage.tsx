import { useCallback, useEffect, useState } from "react";
import {
  DatabaseBackup,
  DownloadCloud,
  FolderCog,
  HardDrive,
  ShieldCheck,
} from "lucide-react";

import { api } from "../lib/api";
import type { AppSettings, BackupStatus, StorageHealth } from "../lib/types";
import { Button, PageHeader } from "../components/ui";

const healthLabels: Record<StorageHealth["status"], string> = {
  ready: "可正常读写",
  notConfigured: "尚未设置",
  missing: "目录或磁盘暂不可用",
  notDirectory: "路径不是文件夹",
  readOnly: "目录不可写",
  error: "检查失败",
};

function formatBytes(value: number | null) {
  if (value == null) return "空间未知";
  if (value >= 1024 ** 3) return `剩余 ${(value / 1024 ** 3).toFixed(1)} GB`;
  return `剩余 ${(value / 1024 ** 2).toFixed(0)} MB`;
}

function formatTime(value: string | null) {
  if (!value) return "尚无成功记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

export function SettingsPage({
  settings,
  onChanged,
  onCheckUpdates,
  checkingUpdate = false,
}: {
  settings: AppSettings;
  onChanged: () => void;
  onCheckUpdates?: () => void | Promise<void>;
  checkingUpdate?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<"library" | "backup-dir" | "backup" | null>(null);
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    const [healthResult, backupResult] = await Promise.allSettled([
      api.getStorageHealth(),
      api.getBackupStatus(),
    ]);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    if (backupResult.status === "fulfilled") setBackupStatus(backupResult.value);
    const failures = [healthResult, backupResult]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => String(result.reason));
    if (failures.length) setError(`状态读取失败：${failures.join("；")}`);
  }, []);

  useEffect(() => { void refreshStatus(); }, [refreshStatus, settings.libraryRoot, settings.backupDir]);

  const chooseLibrary = async () => {
    if (busyAction) return;
    setBusyAction("library");
    setMessage("");
    setError("");
    try {
      const path = await api.chooseDirectory();
      if (!path || path === settings.libraryRoot) return;
      const nextHealth = await api.validateLibraryRoot(path);
      if (nextHealth.status !== "ready" || !nextHealth.writable) {
        throw new Error(nextHealth.message || "所选目录当前不可写");
      }
      if (settings.libraryRoot) {
        const confirmed = window.confirm(
          `确定开始安全迁移客户文件库吗？\n\n新目录：${path}\n\n系统会先复制并校验全部文件，校验成功后才切换工作台。旧目录会原样保留，不会自动删除。迁移期间请不要关闭应用或断开磁盘。`,
        );
        if (!confirmed) return;
      }
      if (settings.libraryRoot) {
        const result = await api.migrateLibraryRoot(path);
        setMessage(`文件库迁移完成：已复制并校验 ${result.copiedFiles} 个文件（${formatBytes(result.copiedBytes).replace("剩余 ", "")}）。旧目录仍保留在 ${result.oldRoot}。`);
      } else {
        await api.setLibraryRoot(path);
        setMessage("客户文件库已设置。");
      }
      await refreshStatus();
      onChanged();
    } catch (reason) {
      setError(`更换文件库失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const chooseBackupDirectory = async () => {
    if (busyAction) return;
    setBusyAction("backup-dir");
    setMessage("");
    setError("");
    try {
      const path = await api.chooseDirectory();
      if (!path) return;
      await api.setBackupDir(path);
      setMessage("数据库备份目录已保存。以后自动和手动备份都会使用这个位置。");
      await refreshStatus();
      onChanged();
    } catch (reason) {
      setError(`设置备份目录失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const runBackup = async () => {
    if (busyAction) return;
    setBusyAction("backup");
    setMessage("");
    setError("");
    try {
      const path = await api.runBackup();
      setMessage(`数据库快照已创建：${path}`);
      await refreshStatus();
      onChanged();
    } catch (reason) {
      setError(`备份失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="page-content">
      <PageHeader eyebrow="本地优先" title="设置" description="查看真实存储状态，管理客户文件库、数据库备份与应用更新。" />
      <div className="settings-grid">
        <section className="settings-card settings-card-actions">
          <div className="settings-icon"><FolderCog size={22} /></div>
          <div>
            <h2>客户文件库</h2>
            <p>新建订单后，系统会在这里创建客户和订单文件夹。磁盘离线时只会告警，不会隐藏客户或订单。</p>
            <code>{health?.path ?? settings.libraryRoot ?? "尚未设置"}</code>
            <div className={`settings-health health-${health?.status ?? "error"}`}>
              <strong>{health ? healthLabels[health.status] : "正在检查…"}</strong>
              {health && <span>{health.message} · {formatBytes(health.freeBytes)}</span>}
            </div>
          </div>
          <Button variant="secondary" onClick={chooseLibrary} disabled={busyAction !== null}>
              {busyAction === "library" ? "迁移处理中…" : settings.libraryRoot ? "安全迁移文件库" : "设置目录"}
          </Button>
        </section>

        <section className="settings-card settings-card-actions">
          <div className="settings-icon purple"><DatabaseBackup size={22} /></div>
          <div>
            <h2>数据库自动备份</h2>
            <p>每天启动时自动备份一次，手动备份每次都会新建快照，最多保留最近 30 份自动备份。</p>
            <code>{backupStatus?.backupDir ?? settings.backupDir ?? "由系统解析默认文档目录"}</code>
            <div className="settings-backup-status">
              <span>最近成功：{formatTime(backupStatus?.lastBackupAt ?? null)}</span>
              {backupStatus?.lastBackupPath && <small title={backupStatus.lastBackupPath}>{backupStatus.lastBackupPath}</small>}
              {backupStatus?.lastError && <small className="invalid">最近错误：{backupStatus.lastError}</small>}
            </div>
          </div>
          <div className="settings-action-stack">
            <Button variant="secondary" onClick={chooseBackupDirectory} disabled={busyAction !== null}>
              {busyAction === "backup-dir" ? "保存中…" : "设置备份目录"}
            </Button>
            <Button onClick={runBackup} disabled={busyAction !== null}>
              {busyAction === "backup" ? "备份中…" : "立即备份"}
            </Button>
          </div>
        </section>

        <section className="settings-card static">
          <div className="settings-icon yellow"><ShieldCheck size={22} /></div>
          <div><h2>隐私与数据</h2><p>应用无需登录，也不会自动上传业务数据。请使用 Windows 账户、锁屏和独立备份共同保护数据。</p></div>
        </section>
        <section className="settings-card static">
          <div className="settings-icon coral"><HardDrive size={22} /></div>
          <div><h2>文件处理规则</h2><p>拖入文件时复制原文件；同名不覆盖；删除时移动到文件库的 `_回收站`，由你确认后手动清理。</p></div>
        </section>
        {onCheckUpdates && (
          <section className="settings-card settings-card-actions">
            <div className="settings-icon"><DownloadCloud size={22} /></div>
            <div><h2>应用更新</h2><p>启动后会自动检查更新，也可以在这里手动检查。</p></div>
            <Button variant="secondary" onClick={() => void onCheckUpdates()} disabled={checkingUpdate}>
              {checkingUpdate ? "检查中…" : "检查更新"}
            </Button>
          </section>
        )}
      </div>
      {message && <div className="inline-message" role="status" aria-live="polite">{message}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}
