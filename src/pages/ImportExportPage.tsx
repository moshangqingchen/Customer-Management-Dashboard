import { useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  CloudDownload,
  DatabaseBackup,
  FileSpreadsheet,
  PackageOpen,
  UploadCloud,
} from "lucide-react";

import { Button, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { defaultColumnMapping, mapPreviewRows } from "../lib/import";
import type {
  Customer,
  CustomerColumnMapping,
  CustomerImportOperation,
  CustomerImportField,
  ImportCustomerRow,
  ImportResult,
  NewCustomer,
  SpreadsheetPreview,
} from "../lib/types";

const fields: { id: CustomerImportField; label: string; required?: boolean }[] = [
  { id: "name", label: "客户名称", required: true },
  { id: "phone", label: "电话" },
  { id: "wechat", label: "微信号" },
  { id: "platform", label: "来源平台" },
  { id: "platformHandle", label: "平台网名 / 账号" },
  { id: "vipLevel", label: "VIP 星级" },
  { id: "tags", label: "标签" },
  { id: "notes", label: "备注" },
];

type RowAction = "skip" | "update" | "create";
type BusyAction = "spreadsheet" | "import" | "backup" | "restore" | "archive" | "fullRestore" | "cloud" | null;

interface PreparedRow {
  row: ImportCustomerRow;
  rawVip: string;
  errors: string[];
  duplicateCustomer?: Customer;
  duplicateReason?: string;
  duplicateSourceRow?: number;
}

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");
const normalizeAccount = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, "");

function localDateStamp() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBytes(value: number) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatArchiveDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

function findExistingCustomer(row: ImportCustomerRow, customers: Customer[]) {
  const phone = normalizePhone(row.phone);
  const wechat = normalizeAccount(row.wechat);
  const platformAccount = normalizeAccount(row.platformHandle);
  for (const customer of customers) {
    if (phone && normalizePhone(customer.phone) === phone) return { customer, reason: "电话相同" };
    if (wechat && normalizeAccount(customer.wechat) === wechat) return { customer, reason: "微信号相同" };
    if (platformAccount && customer.platformIdentities.some((identity) =>
      normalizeAccount(identity.account) === platformAccount || normalizeAccount(identity.handle) === platformAccount)) {
      return { customer, reason: "平台账号或网名相同" };
    }
  }
  return null;
}

function mergeImportedCustomer(existing: Customer, prepared: PreparedRow): NewCustomer {
  const { row, rawVip } = prepared;
  const nextIdentity = row.platform || row.platformHandle
    ? { platform: row.platform || "其他", handle: row.platformHandle, account: row.platformHandle }
    : null;
  const identities = [...existing.platformIdentities];
  if (nextIdentity && !identities.some((identity) =>
    identity.platform === nextIdentity.platform &&
    normalizeAccount(identity.account || identity.handle) === normalizeAccount(nextIdentity.account))) {
    identities.push(nextIdentity);
  }
  return {
    name: row.name || existing.name,
    phone: row.phone || existing.phone,
    wechat: row.wechat || existing.wechat,
    vipLevel: rawVip.trim() ? row.vipLevel : existing.vipLevel,
    notes: row.notes || existing.notes,
    tags: [...new Set([...existing.tags, ...row.tags])],
    platformIdentities: identities,
    addresses: existing.addresses,
    qrCodePath: existing.qrCodePath,
  };
}

function importedRowToCustomer(prepared: PreparedRow): NewCustomer {
  const { row } = prepared;
  return {
    name: row.name.trim(),
    phone: row.phone.trim(),
    wechat: row.wechat.trim(),
    vipLevel: row.vipLevel,
    notes: row.notes,
    tags: row.tags,
    platformIdentities: row.platform || row.platformHandle
      ? [{ platform: row.platform || "其他", handle: row.platformHandle, account: row.platformHandle }]
      : [],
    addresses: [],
    qrCodePath: null,
  };
}

export function ImportExportPage({ customers = [], onChanged }: { customers?: Customer[]; onChanged: () => void }) {
  const [sourcePath, setSourcePath] = useState("");
  const [preview, setPreview] = useState<SpreadsheetPreview | null>(null);
  const [mapping, setMapping] = useState<CustomerColumnMapping>({});
  const [decisions, setDecisions] = useState<Record<number, RowAction>>({});
  const [previewPage, setPreviewPage] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [completedSource, setCompletedSource] = useState("");
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());
  const importLock = useRef(false);

  const rows = useMemo(() => preview ? mapPreviewRows(preview, mapping) : [], [preview, mapping]);
  const duplicateMappedHeaders = useMemo(() => {
    const selected = Object.values(mapping).filter((value): value is string => Boolean(value));
    return [...new Set(selected.filter((header, index) => selected.indexOf(header) !== index))];
  }, [mapping]);

  const preparedRows = useMemo<PreparedRow[]>(() => {
    if (!preview) return [];
    const vipColumn = mapping.vipLevel ? preview.headers.indexOf(mapping.vipLevel) : -1;
    const seenPhone = new Map<string, number>();
    const seenWechat = new Map<string, number>();
    const seenPlatform = new Map<string, number>();
    return rows.map((row, index) => {
      const rawVip = vipColumn >= 0 ? (preview.rows[index]?.[vipColumn] ?? "").trim() : "";
      const errors: string[] = [];
      if (!row.name.trim()) errors.push("缺少客户名称");
      if (rawVip) {
        const parsed = Number(rawVip);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 5) errors.push("VIP 星级必须是 0–5 的整数");
      }
      const existing = findExistingCustomer(row, customers);
      let duplicateSourceRow: number | undefined;
      const phone = normalizePhone(row.phone);
      const wechat = normalizeAccount(row.wechat);
      const platform = normalizeAccount(row.platformHandle);
      if (phone && seenPhone.has(phone)) duplicateSourceRow = seenPhone.get(phone);
      else if (wechat && seenWechat.has(wechat)) duplicateSourceRow = seenWechat.get(wechat);
      else if (platform && seenPlatform.has(platform)) duplicateSourceRow = seenPlatform.get(platform);
      if (phone && !seenPhone.has(phone)) seenPhone.set(phone, row.rowNumber);
      if (wechat && !seenWechat.has(wechat)) seenWechat.set(wechat, row.rowNumber);
      if (platform && !seenPlatform.has(platform)) seenPlatform.set(platform, row.rowNumber);
      return {
        row,
        rawVip,
        errors,
        duplicateCustomer: existing?.customer,
        duplicateReason: existing?.reason,
        duplicateSourceRow,
      };
    });
  }, [customers, mapping.vipLevel, preview, rows]);

  const actionFor = (prepared: PreparedRow): RowAction => decisions[prepared.row.rowNumber]
    ?? (prepared.duplicateCustomer || prepared.duplicateSourceRow ? "skip" : "create");
  const validRows = preparedRows.filter((prepared) => prepared.errors.length === 0);
  const invalidCount = preparedRows.length - validRows.length;
  const duplicateCount = preparedRows.filter((prepared) => prepared.duplicateCustomer || prepared.duplicateSourceRow).length;
  const willCreate = validRows.filter((prepared) => actionFor(prepared) === "create").length;
  const willUpdate = validRows.filter((prepared) => actionFor(prepared) === "update" && prepared.duplicateCustomer).length;
  const pageSize = 30;
  const pageCount = Math.max(1, Math.ceil(preparedRows.length / pageSize));
  const visibleRows = preparedRows.slice(previewPage * pageSize, (previewPage + 1) * pageSize);

  const chooseSpreadsheet = async () => {
    if (busyAction) return;
    setBusyAction("spreadsheet");
    setError("");
    setMessage("");
    try {
      const path = await api.chooseFile("spreadsheet");
      if (!path) return;
      const nextPreview = await api.previewSpreadsheet(path);
      setSourcePath(path);
      setPreview({ ...nextPreview, fileName: nextPreview.fileName || path.split(/[\\/]/).pop() || path });
      setMapping(defaultColumnMapping(nextPreview.headers));
      setDecisions({});
      setPreviewPage(0);
      setResult(null);
      setCompletedSource("");
      setBatchId(crypto.randomUUID());
    } catch (reason) {
      setError(`读取客户表格失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const chooseSheet = async (sheet: string) => {
    if (busyAction || !sourcePath || sheet === preview?.selectedSheet) return;
    setBusyAction("spreadsheet");
    setError("");
    setMessage("");
    try {
      const nextPreview = await api.previewSpreadsheet(sourcePath, sheet);
      setPreview(nextPreview);
      setMapping(defaultColumnMapping(nextPreview.headers));
      setDecisions({});
      setPreviewPage(0);
      setResult(null);
      setCompletedSource("");
      setBatchId(crypto.randomUUID());
    } catch (reason) {
      setError(`切换工作表失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const confirmImport = async () => {
    if (importLock.current || busyAction || !preview) return;
    if (!mapping.name) {
      setError("请先把一列映射为“客户名称”");
      return;
    }
    if (duplicateMappedHeaders.length) {
      setError(`同一来源列不能重复映射：${duplicateMappedHeaders.join("、")}`);
      return;
    }
    if (willCreate + willUpdate === 0) {
      setError("当前没有待写入的有效行，请检查错误行或调整重复项处理方式");
      return;
    }
    importLock.current = true;
    setBusyAction("import");
    setError("");
    setMessage("");
    try {
      const operations: CustomerImportOperation[] = preparedRows.map((prepared) => {
        const action = prepared.errors.length ? "skip" : actionFor(prepared);
        if (action === "update" && prepared.duplicateCustomer) {
          return {
            rowNumber: prepared.row.rowNumber,
            action,
            customerId: prepared.duplicateCustomer.id,
            customer: mergeImportedCustomer(prepared.duplicateCustomer, prepared),
          };
        }
        if (action === "create") {
          return {
            rowNumber: prepared.row.rowNumber,
            action,
            customer: importedRowToCustomer(prepared),
          };
        }
        return { rowNumber: prepared.row.rowNumber, action: "skip" };
      });
      const imported = await api.applyCustomerImport(batchId, operations);
      const localErrors = preparedRows.flatMap((prepared) =>
        prepared.errors.map((item) => `第 ${prepared.row.rowNumber} 行：${item}`));
      const duplicateWarnings = [
        ...imported.duplicateWarnings,
        ...validRows
          .filter((prepared) => actionFor(prepared) === "create" && prepared.duplicateCustomer)
          .map((prepared) => `第 ${prepared.row.rowNumber} 行疑似与“${prepared.duplicateCustomer?.name}”重复，已按你的选择另建客户`),
      ];
      setResult({
        imported: imported.imported,
        updated: imported.updated,
        skipped: imported.skipped,
        errors: [...localErrors, ...imported.errors],
        duplicateWarnings,
      });
      setCompletedSource(sourcePath);
      onChanged();
    } catch (reason) {
      setError(`导入失败：${String(reason)}。本批次使用单一事务，不会只写入一部分；可直接重试。`);
    } finally {
      setBusyAction(null);
      importLock.current = false;
    }
  };

  const createDatabaseSnapshot = async () => {
    if (busyAction) return;
    setBusyAction("backup");
    setError("");
    setMessage("");
    try {
      setMessage(`数据库快照已创建：${await api.runBackup()}`);
    } catch (reason) {
      setError(`数据库备份失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const restoreDatabaseSnapshot = async () => {
    if (busyAction) return;
    setBusyAction("restore");
    setError("");
    setMessage("");
    try {
      const path = await api.chooseFile("databaseBackup");
      if (!path) return;
      if (!window.confirm("恢复会用备份中的客户、订单和设置替换当前数据库。系统会先创建安全副本，客户文件不会被删除。确定继续吗？")) return;
      if (window.prompt("为防止误操作，请输入“恢复”后继续：")?.trim() !== "恢复") {
        setMessage("已取消恢复，没有更改数据。");
        return;
      }
      const safetyCopy = await api.restoreBackup(path);
      setMessage(`数据库已恢复；恢复前的安全副本：${safetyCopy}`);
      onChanged();
    } catch (reason) {
      setError(`数据库恢复失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const exportArchive = async () => {
    if (busyAction) return;
    setBusyAction("archive");
    setError("");
    setMessage("");
    try {
      const path = await api.chooseSaveFile(`创业客户工作台-完整归档-${localDateStamp()}.zip`, "zip");
      if (path) setMessage(`完整归档已导出：${await api.exportFull(path)}`);
    } catch (reason) {
      setError(`完整归档导出失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const restoreArchive = async () => {
    if (busyAction) return;
    setBusyAction("fullRestore");
    setError("");
    setMessage("正在选择并检查完整归档…");
    try {
      const source = await api.chooseFile("fullArchive");
      if (!source) return;
      const inspection = await api.inspectFullArchive(source);
      setMessage("归档已通过完整性检查，请选择一个空文件夹作为新的客户文件库。");
      const target = await api.chooseDirectory();
      if (!target) return;
      const health = await api.validateLibraryRoot(target);
      if (health.status !== "ready" || !health.writable) throw new Error(health.message);
      const confirmed = window.confirm(
        `完整归档已通过校验。\n\n导出时间：${formatArchiveDate(inspection.exportedAt)}\n数据库结构版本：${inspection.schemaVersion}\n客户文件：${inspection.libraryFileCount} 个，共 ${formatBytes(inspection.libraryBytes)}\n原文件库：${inspection.sourceLibraryRoot || "未记录"}\n新文件库：${target}\n\n恢复会先备份当前完整工作区，再恢复数据库与客户文件；原文件库不会删除。确定继续吗？`,
      );
      if (!confirmed) {
        setMessage("已取消完整恢复，没有更改数据。");
        return;
      }
      if (window.prompt("这是完整工作区替换操作。请输入“完整恢复”后继续：")?.trim() !== "完整恢复") {
        setMessage("已取消完整恢复，没有更改数据。");
        return;
      }
      setMessage("正在恢复并逐个校验客户文件，请不要关闭应用…");
      const restored = await api.restoreFullArchive(source, target);
      setMessage(`完整工作区已恢复：${restored.restoredFiles} 个文件，共 ${formatBytes(restored.restoredBytes)}。恢复前安全归档：${restored.safetyBackupPath}`);
      await onChanged();
    } catch (reason) {
      setError(`完整归档恢复失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const exportCloudModel = async () => {
    if (busyAction) return;
    setBusyAction("cloud");
    setError("");
    setMessage("");
    try {
      const path = await api.chooseSaveFile("cloud-read-model.json", "json");
      if (path) setMessage(`只读模型已导出：${await api.exportCloudReadModel(path)}`);
    } catch (reason) {
      setError(`只读模型导出失败：${String(reason)}`);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="page-content">
      <PageHeader eyebrow="数据与备份" title="导入、备份与迁移" description="先审核客户表格再写入；数据库快照用于快速恢复，完整 ZIP 可迁移整套工作区。" />

      <section className="panel import-workflow">
        <div className="panel-heading">
          <div><span className="eyebrow">客户导入 · 第 1 步</span><h2>选择客户表格</h2></div>
          <Button onClick={chooseSpreadsheet} disabled={busyAction !== null}>
            <UploadCloud size={16} />{busyAction === "spreadsheet" ? "读取中…" : preview ? "重新选择表格" : "选择表格文件"}
          </Button>
        </div>
        <p>支持 `.xlsx`、`.xls`、`.xlsb`、`.ods` 和 `.csv`。文件只在本机读取，正式写入前可以选择工作表并检查映射、错误和疑似重复项。</p>
        {preview && (
          <div className="import-source-summary" role="status">
            <FileSpreadsheet size={20} />
            <span><strong>{preview.fileName || sourcePath}</strong><small>{preview.selectedSheet ? `工作表：${preview.selectedSheet} · ` : ""}共 {preview.totalRows ?? preview.rows.length} 行，{preview.headers.length} 列</small></span>
            {(preview.sheetNames?.length ?? 0) > 1 && (
              <label className="sheet-picker">
                <span>工作表</span>
                <select
                  value={preview.selectedSheet ?? ""}
                  disabled={busyAction !== null || completedSource === sourcePath}
                  onChange={(event) => void chooseSheet(event.target.value)}
                >
                  {preview.sheetNames?.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
      </section>

      {preview && (
        <section className="panel import-preview">
          <div className="panel-heading">
            <div><span className="eyebrow">客户导入 · 第 2 步</span><h2>映射字段并逐行审核</h2></div>
            <span className="result-count">有效 {validRows.length} · 错误 {invalidCount} · 疑似重复 {duplicateCount}</span>
          </div>
          <div className="mapping-grid">
            {fields.map((field) => (
              <label key={field.id}>
                <span>{field.label}{field.required ? " *" : ""}</span>
                <select
                  aria-label={`映射${field.label}`}
                  value={mapping[field.id] ?? ""}
                  disabled={completedSource === sourcePath || busyAction === "import"}
                  onChange={(event) => {
                    setMapping({ ...mapping, [field.id]: event.target.value || undefined });
                    setPreviewPage(0);
                    setBatchId(crypto.randomUUID());
                  }}
                >
                  <option value="">不导入此字段</option>
                  {preview.headers.map((header, index) => <option key={`${header}-${index}`} value={header}>{header || `未命名列 ${index + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          {duplicateMappedHeaders.length > 0 && (
            <div className="form-error" role="alert">同一来源列不能映射给多个字段：{duplicateMappedHeaders.join("、")}</div>
          )}
          <div className="panel-heading preview-title">
            <div>
              <span className="eyebrow">逐行审核 · 每页最多 30 行</span>
              <h2>重复项默认跳过，按需选择更新或另建</h2>
            </div>
            <span className="result-count">第 {previewPage + 1} / {pageCount} 页</span>
          </div>
          <div className="preview-table" role="region" aria-label="客户导入预览" tabIndex={0}>
            <table>
              <thead><tr><th>行号</th><th>客户名称</th><th>电话</th><th>平台 / 网名</th><th>VIP</th><th>检查结果</th><th>处理方式</th></tr></thead>
              <tbody>
                {visibleRows.map((prepared) => {
                  const duplicate = prepared.duplicateCustomer || prepared.duplicateSourceRow;
                  const action = actionFor(prepared);
                  return (
                    <tr key={prepared.row.rowNumber}>
                      <td>{prepared.row.rowNumber}</td>
                      <td><strong>{prepared.row.name || "缺少名称"}</strong></td>
                      <td>{prepared.row.phone || "-"}</td>
                      <td>{[prepared.row.platform, prepared.row.platformHandle].filter(Boolean).join(" / ") || "-"}</td>
                      <td>{prepared.rawVip || "0"} 星</td>
                      <td>
                        {prepared.errors.length > 0
                          ? <span className="invalid">{prepared.errors.join("；")}</span>
                          : prepared.duplicateCustomer
                            ? <span className="warning">疑似“{prepared.duplicateCustomer.name}”：{prepared.duplicateReason}</span>
                            : prepared.duplicateSourceRow
                              ? <span className="warning">与表格第 {prepared.duplicateSourceRow} 行疑似重复</span>
                              : <span className="valid">可导入</span>}
                      </td>
                      <td>
                        {prepared.errors.length > 0 ? "跳过错误行" : (
                          <select
                            aria-label={`第 ${prepared.row.rowNumber} 行处理方式`}
                            value={action}
                            disabled={completedSource === sourcePath || busyAction === "import"}
                            onChange={(event) => {
                              setDecisions({ ...decisions, [prepared.row.rowNumber]: event.target.value as RowAction });
                              setBatchId(crypto.randomUUID());
                            }}
                          >
                            {duplicate && <option value="skip">跳过（默认）</option>}
                            {prepared.duplicateCustomer && <option value="update">更新“{prepared.duplicateCustomer.name}”</option>}
                            <option value="create">{duplicate ? "仍然另建客户" : "创建客户"}</option>
                            {!duplicate && <option value="skip">跳过此行</option>}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="pagination-actions">
              <Button variant="secondary" onClick={() => setPreviewPage((page) => Math.max(0, page - 1))} disabled={previewPage === 0}>上一页</Button>
              <span>正在查看第 {previewPage * pageSize + 1}–{Math.min((previewPage + 1) * pageSize, preparedRows.length)} 行</span>
              <Button variant="secondary" onClick={() => setPreviewPage((page) => Math.min(pageCount - 1, page + 1))} disabled={previewPage >= pageCount - 1}>下一页</Button>
            </div>
          )}
          <div className="import-confirm-row">
            <div><span className="eyebrow">客户导入 · 第 3 步</span><strong>将新建 {willCreate} 位、更新 {willUpdate} 位客户，其余跳过</strong></div>
            <Button
              onClick={confirmImport}
              disabled={!mapping.name || duplicateMappedHeaders.length > 0 || willCreate + willUpdate === 0 || busyAction !== null || completedSource === sourcePath}
            >
              {completedSource === sourcePath ? "这份表格已导入" : busyAction === "import" ? "正在写入…" : "确认并执行导入"}
            </Button>
          </div>
        </section>
      )}

      {result && (
        <div className="result-banner" role="status" aria-live="polite">
          <strong>导入完成：新建 {result.imported} 位，更新 {result.updated ?? 0} 位，跳过 {result.skipped} 行</strong>
          {[...result.errors, ...result.duplicateWarnings].map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
        </div>
      )}

      <div className="tool-grid data-safety-grid">
        <section className="tool-card">
          <div className="tool-icon yellow"><DatabaseBackup size={24} /></div>
          <h2>数据库快照</h2>
          <p>保存客户、订单和设置，可在故障或误操作后恢复。快照不包含客户文件。</p>
          <div className="tool-card-actions">
            <Button onClick={createDatabaseSnapshot} disabled={busyAction !== null}>{busyAction === "backup" ? "备份中…" : "立即创建快照"}</Button>
            <Button variant="secondary" onClick={restoreDatabaseSnapshot} disabled={busyAction !== null}><ArchiveRestore size={16} />恢复快照</Button>
          </div>
        </section>
        <section className="tool-card">
          <div className="tool-icon teal"><PackageOpen size={24} /></div>
          <h2>完整离线归档</h2>
          <p>把数据库、设置和客户文件打成可校验的 ZIP；既可离线留存，也可恢复到新的空文件夹完成整机迁移。</p>
          <div className="tool-card-actions">
            <Button variant="secondary" onClick={exportArchive} disabled={busyAction !== null}><PackageOpen size={16} />{busyAction === "archive" ? "归档中…" : "导出完整归档"}</Button>
            <Button variant="secondary" onClick={restoreArchive} disabled={busyAction !== null}><ArchiveRestore size={16} />{busyAction === "fullRestore" ? "恢复中…" : "恢复完整归档"}</Button>
          </div>
        </section>
      </div>

      <details className="panel advanced-tools">
        <summary>高级工具</summary>
        <div className="advanced-tool-row">
          <div className="tool-icon purple"><CloudDownload size={24} /></div>
          <div><h2>云端只读模型</h2><p>导出版本化 JSON，供未来的手机或网页只读查询使用；应用不会自动上传。</p></div>
          <Button variant="secondary" onClick={exportCloudModel} disabled={busyAction !== null}><CloudDownload size={16} />{busyAction === "cloud" ? "导出中…" : "导出 JSON"}</Button>
        </div>
      </details>

      {message && <div className="inline-message" role="status" aria-live="polite">{message}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
    </div>
  );
}
