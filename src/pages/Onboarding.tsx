import { useState } from "react";
import {
  ArchiveRestore,
  FileSpreadsheet,
  FolderHeart,
  HardDrive,
  Sparkles,
} from "lucide-react";

import { api } from "../lib/api";
import type { PageId } from "../lib/types";
import { Button } from "../components/ui";

type StartIntent = "workspace" | "import" | "restore";

function formatArchiveBytes(value: number) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function formatArchiveDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

export function Onboarding({ onReady }: { onReady: (nextPage?: PageId) => void | Promise<void> }) {
  const [path, setPath] = useState("");
  const [intent, setIntent] = useState<StartIntent>("workspace");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const chooseLibrary = async () => {
    setError("");
    try {
      const selected = await api.chooseDirectory();
      if (selected) setPath(selected);
    } catch (reason) {
      setError(`无法选择文件夹：${String(reason)}`);
    }
  };

  const start = async () => {
    if (!path || busy) return;
    setBusy(true);
    setError("");
    setStatus("正在检查文件库…");
    try {
      const health = await api.validateLibraryRoot(path);
      if (health.status !== "ready" || !health.writable) {
        throw new Error(health.message || "所选目录当前不可写，请换一个文件夹");
      }
      setStatus("正在建立工作台…");
      await api.setLibraryRoot(path);
      await onReady(intent === "import" ? "import" : "dashboard");
    } catch (reason) {
      setError(`无法建立工作台：${String(reason)}`);
    } finally {
      setStatus("");
      setBusy(false);
    }
  };

  const restoreDatabase = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("正在选择数据库备份…");
    try {
      const source = await api.chooseFile("databaseBackup");
      if (!source) return;
      const confirmed = window.confirm(
        "确定恢复这个数据库快照吗？\n\n恢复前会先为当前数据库创建安全副本。恢复完成后，客户、订单和设置会替换为备份中的内容；客户文件不会被删除。",
      );
      if (!confirmed) return;
      setStatus("正在校验并恢复数据库，请不要关闭应用…");
      await api.restoreBackup(source);
      await onReady("dashboard");
    } catch (reason) {
      setError(`数据库恢复失败：${String(reason)}`);
    } finally {
      setStatus("");
      setBusy(false);
    }
  };

  const restoreFullArchive = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("正在选择并检查完整归档…");
    try {
      const source = await api.chooseFile("fullArchive");
      if (!source) return;
      const inspection = await api.inspectFullArchive(source);
      setStatus("归档已通过检查，请选择一个空文件夹作为新文件库…");
      const target = await api.chooseDirectory();
      if (!target) return;
      const health = await api.validateLibraryRoot(target);
      if (health.status !== "ready" || !health.writable) throw new Error(health.message);
      const confirmed = window.confirm(
        `完整归档已通过校验。\n\n导出时间：${formatArchiveDate(inspection.exportedAt)}\n数据库结构版本：${inspection.schemaVersion}\n客户文件：${inspection.libraryFileCount} 个，共 ${formatArchiveBytes(inspection.libraryBytes)}\n原文件库：${inspection.sourceLibraryRoot || "未记录"}\n新文件库：${target}\n\n恢复会先备份当前数据库，再把归档内容恢复到新的空文件夹；原文件库不会删除。确定继续吗？`,
      );
      if (!confirmed) return;
      if (window.prompt("这是完整工作区替换操作。请输入“完整恢复”后继续：")?.trim() !== "完整恢复") {
        setStatus("已取消完整恢复，没有更改数据。");
        return;
      }
      setStatus("正在恢复数据库并校验客户文件，请不要关闭应用…");
      await api.restoreFullArchive(source, target);
      await onReady("dashboard");
    } catch (reason) {
      setError(`完整归档恢复失败：${String(reason)}`);
    } finally {
      setStatus("");
      setBusy(false);
    }
  };

  return (
    <main className="onboarding">
      <section className="onboarding-card onboarding-card-wide">
        <div className="onboarding-art"><div><Sparkles size={30} /></div><FolderHeart size={76} /></div>
        <span className="eyebrow">第一次使用</span>
        <h1>建立你的本地客户工作台</h1>
        <p>先确定客户文件放在哪里。数据库和客户文件都由你掌控，应用不会自动上传业务数据。</p>

        <div className="onboarding-choice-grid" role="group" aria-label="开始方式">
          <button
            className={`onboarding-choice ${intent === "workspace" ? "active" : ""}`}
            onClick={() => setIntent("workspace")}
            aria-pressed={intent === "workspace"}
          >
            <FolderHeart size={22} />
            <span><strong>新建空白工作台</strong><small>适合第一次开始整理客户和订单</small></span>
          </button>
          <button
            className={`onboarding-choice ${intent === "import" ? "active" : ""}`}
            onClick={() => setIntent("import")}
            aria-pressed={intent === "import"}
          >
            <FileSpreadsheet size={22} />
            <span><strong>从客户表格开始</strong><small>建立文件库后直接进入 Excel 导入向导</small></span>
          </button>
          <button
            className={`onboarding-choice ${intent === "restore" ? "active" : ""}`}
            onClick={() => setIntent("restore")}
            aria-pressed={intent === "restore"}
          >
            <ArchiveRestore size={22} />
            <span><strong>恢复完整工作区</strong><small>校验完整 ZIP，并恢复数据库和全部客户文件</small></span>
          </button>
        </div>

        {intent === "restore" ? (
          <div className="onboarding-restore-note">
            <ArchiveRestore size={20} />
            <span>接下来会先检查归档清单与数据库完整性，再让你选择一个空文件夹。恢复失败会自动回滚，原文件库不会被删除。</span>
          </div>
        ) : <>
          <button className="path-picker" onClick={chooseLibrary} disabled={busy}>
            <HardDrive size={20} />
            <span>{path || "选择本机磁盘、移动硬盘或网盘同步目录"}</span>
          </button>
          <div className="onboarding-points"><span>原文件会保留</span><span>同名文件不覆盖</span><span>完全离线可用</span></div>
        </>}
        <Button disabled={(intent !== "restore" && !path) || busy} onClick={intent === "restore" ? restoreFullArchive : start}>
          {busy ? "正在准备…" : intent === "restore" ? "选择完整归档并恢复" : intent === "import" ? "建立并导入客户" : "开始使用工作台"}
        </Button>

        <div className="onboarding-recovery">
          <div>
            <ArchiveRestore size={19} />
            <span><strong>已有数据库快照？</strong><small>可恢复由本应用生成的 `.db` 数据库备份；恢复前会自动保存当前副本。</small></span>
          </div>
          <Button variant="secondary" onClick={restoreDatabase} disabled={busy}>恢复数据库快照</Button>
        </div>
        <p className="form-hint">数据库快照适合日常快速恢复；完整归档包含数据库与客户文件，适合迁移整套工作区。</p>
        {status && <div className="inline-message" role="status" aria-live="polite">{status}</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
      </section>
    </main>
  );
}
