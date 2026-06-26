import { useMemo, useState } from "react";
import { ArchiveRestore, CloudDownload, FileSpreadsheet, PackageOpen, UploadCloud } from "lucide-react";

import { Button, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { defaultColumnMapping, mapPreviewRows } from "../lib/import";
import type {
  CustomerColumnMapping,
  CustomerImportField,
  ImportResult,
  SpreadsheetPreview,
} from "../lib/types";

const fields: { id: CustomerImportField; label: string; required?: boolean }[] = [
  { id: "name", label: "客户名称", required: true },
  { id: "phone", label: "电话" },
  { id: "wechat", label: "微信号" },
  { id: "platform", label: "来源平台" },
  { id: "platformHandle", label: "平台网名" },
  { id: "vipLevel", label: "VIP 星级" },
  { id: "tags", label: "标签" },
  { id: "notes", label: "备注" },
];

export function ImportExportPage({ onChanged }: { onChanged: () => void }) {
  const [preview, setPreview] = useState<SpreadsheetPreview | null>(null);
  const [mapping, setMapping] = useState<CustomerColumnMapping>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const rows = useMemo(() => preview ? mapPreviewRows(preview, mapping) : [], [preview, mapping]);

  const chooseSpreadsheet = async () => {
    const path = await api.chooseFile();
    if (!path) return;
    const nextPreview = await api.previewSpreadsheet(path);
    setPreview(nextPreview);
    setMapping(defaultColumnMapping(nextPreview.headers));
    setResult(null);
  };

  return (
    <div className="page-content">
      <PageHeader eyebrow="数据工具" title="导入与导出" description="批量导入历史客户，或完整打包数据与文件用于迁移和归档。" />
      <div className="tool-grid">
        <section className="tool-card"><div className="tool-icon coral"><FileSpreadsheet size={24} /></div><h2>Excel 客户导入</h2><p>支持 `.xlsx`、`.xls` 和 `.ods`。选择文件后映射列名，再预览有效行。</p><Button onClick={chooseSpreadsheet}><UploadCloud size={16} />选择 Excel 文件</Button></section>
        <section className="tool-card"><div className="tool-icon teal"><PackageOpen size={24} /></div><h2>完整数据导出</h2><p>生成包含数据库、设置和全部客户文件的 ZIP 包，适合迁移电脑或长期归档。</p><Button variant="secondary" onClick={async () => { const path = await api.chooseSaveFile(`创业客户工作台-完整导出-${new Date().toISOString().slice(0, 10)}.zip`, "zip"); if (path) setMessage(`已导出到：${await api.exportFull(path)}`); }}><PackageOpen size={16} />导出完整数据包</Button></section>
        <section className="tool-card"><div className="tool-icon purple"><CloudDownload size={24} /></div><h2>云端只读模型</h2><p>导出版本化 JSON，未来可用于手机或网页只读查询，不会上传任何数据。</p><Button variant="secondary" onClick={async () => { const path = await api.chooseSaveFile("cloud-read-model.json", "json"); if (path) setMessage(`已导出到：${await api.exportCloudReadModel(path)}`); }}><CloudDownload size={16} />导出只读模型</Button></section>
        <section className="tool-card"><div className="tool-icon yellow"><ArchiveRestore size={24} /></div><h2>恢复数据库备份</h2><p>恢复前会自动保存当前数据库副本。仅选择由本 App 生成的数据库备份。</p><Button variant="secondary" onClick={async () => { const path = await api.chooseFile(); if (path) { await api.restoreBackup(path); setMessage("备份恢复完成，当前数据库已自动另存安全副本。"); onChanged(); } }}><ArchiveRestore size={16} />选择备份并恢复</Button></section>
      </div>

      {preview && <section className="panel import-preview">
        <div className="panel-heading"><div><span className="eyebrow">字段映射</span><h2>将 Excel 列对应到客户字段</h2></div><span className="result-count">读取到 {preview.rows.length} 行</span></div>
        <div className="mapping-grid">
          {fields.map((field) => <label key={field.id}><span>{field.label}{field.required ? " *" : ""}</span><select value={mapping[field.id] ?? ""} onChange={(event) => setMapping({ ...mapping, [field.id]: event.target.value || undefined })}><option value="">不导入此字段</option>{preview.headers.map((header) => <option key={header}>{header}</option>)}</select></label>)}
        </div>
        <div className="panel-heading preview-title"><div><span className="eyebrow">导入预览</span><h2>确认有效行后再写入数据库</h2></div><Button disabled={!mapping.name} onClick={async () => { const output = await api.importCustomers(rows); setResult(output); onChanged(); }}>确认导入有效行</Button></div>
        <div className="preview-table"><div className="preview-head"><span>行号</span><span>客户名称</span><span>电话</span><span>平台 / 网名</span><span>VIP</span><span>状态</span></div>{rows.slice(0, 30).map((row) => <div className="preview-row" key={row.rowNumber}><span>{row.rowNumber}</span><b>{row.name || "缺少名称"}</b><span>{row.phone || "-"}</span><span>{row.platform} {row.platformHandle}</span><span>{row.vipLevel} 星</span><span className={row.name ? "valid" : "invalid"}>{row.name ? "可导入" : "错误行"}</span></div>)}</div>
      </section>}
      {result && <div className="result-banner"><strong>导入完成：{result.imported} 行成功，{result.skipped} 行跳过</strong>{[...result.errors, ...result.duplicateWarnings].map((item) => <span key={item}>{item}</span>)}</div>}
      {message && <div className="inline-message">{message}</div>}
    </div>
  );
}
