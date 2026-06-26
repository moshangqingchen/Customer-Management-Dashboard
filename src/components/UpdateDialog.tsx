import { ArrowDownToLine, Sparkles } from "lucide-react";

import { Button, Modal } from "./ui";

export interface AvailableUpdate {
  version: string;
  date?: string | null;
  body?: string | null;
}

export type UpdateInstallStatus = "available" | "installing" | "error";

function releaseNotes(body?: string | null) {
  const notes = (body ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
  return notes.length > 0 ? notes : ["本次版本包含稳定性改进和日常使用优化。"];
}

export function UpdateDialog({
  update,
  status,
  progress = 0,
  error,
  onDismiss,
  onInstall,
}: {
  update: AvailableUpdate;
  status: UpdateInstallStatus;
  progress?: number;
  error?: string;
  onDismiss: () => void;
  onInstall: () => void;
}) {
  const installing = status === "installing";
  const normalizedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <Modal
      title={`发现新版本 ${update.version}`}
      subtitle="更新完成后软件会自动重启，不会删除客户、订单或文件库数据。"
      onClose={onDismiss}
      closeDisabled={installing}
    >
      <div className="update-dialog">
        <div className="update-dialog-hero">
          <div className="update-dialog-icon"><Sparkles size={23} /></div>
          <div>
            <strong>版本 {update.version}</strong>
            <span>{update.date ? `发布于 ${update.date}` : "新版本已准备好"}</span>
          </div>
        </div>

        <section className="update-notes" aria-label="更新内容">
          <h3>更新内容</h3>
          <ul>{releaseNotes(update.body).map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ul>
        </section>

        {installing && <div className="update-progress" aria-live="polite">
          <div><span>正在下载并安装更新…</span><b>{normalizedProgress}%</b></div>
          <i><span style={{ width: `${normalizedProgress}%` }} /></i>
        </div>}
        {status === "error" && <p className="form-error">更新失败：{error ?? "请稍后重试。"}</p>}

        <div className="form-actions update-actions">
          {!installing && <Button variant="secondary" onClick={onDismiss}>取消此次更新</Button>}
          <Button onClick={onInstall} disabled={installing}>
            <ArrowDownToLine size={16} />{installing ? "正在更新" : status === "error" ? "重新更新并重启" : "更新并重启"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
