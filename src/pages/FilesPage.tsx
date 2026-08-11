import { ExternalLink, FileArchive, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FileThumbnail } from "../components/FileThumbnail";
import { api } from "../lib/api";
import { absoluteFilePath } from "../lib/files";
import { fileSize, shortDate } from "../lib/format";
import type { FileRecord } from "../lib/types";
import { EmptyState, PageHeader } from "../components/ui";

export function FilesPage({ files, libraryRoot, onChanged }: { files: FileRecord[]; libraryRoot?: string | null; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(48);
  const [busyFileId, setBusyFileId] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => files.filter((file) => JSON.stringify(file).toLowerCase().includes(query.toLowerCase())), [files, query]);
  const visibleFiles = filtered.slice(0, visibleCount);

  useEffect(() => setVisibleCount(48), [query]);

  const deleteFile = async (file: FileRecord) => {
    if (!window.confirm(`确定删除文件「${file.name}」吗？\n\n文件会先移入文件库的 _回收站。`)) return;
    setBusyFileId(file.id);
    setMessage("");
    try {
      await api.deleteFile(file.id);
      setMessage(`已将「${file.name}」移入回收站。`);
      onChanged();
    } catch (error) {
      setMessage(`删除失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusyFileId("");
    }
  };

  const openFileLocation = async (file: FileRecord) => {
    setMessage("");
    try {
      await api.openInExplorer(absoluteFilePath(file, libraryRoot));
    } catch (error) {
      setMessage(`无法打开文件位置：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="page-content">
      <PageHeader eyebrow="受管文件库" title="文件中心" description="查看所有订单文件。删除操作会先移入文件库的 _回收站。" />
      <div className="toolbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="搜索文件"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文件名、分类或路径…"
          />
        </label>
        <span className="result-count">{filtered.length} 个文件</span>
      </div>
      {message && <div className="inline-message" role="status" aria-live="polite">{message}</div>}
      {filtered.length === 0 ? (
        <EmptyState icon={<FileArchive size={28} />} title="还没有受管文件" description="从订单详情上传或拖拽文件后，会出现在这里。" />
      ) : (
        <>
          <div className="file-grid">
            {visibleFiles.map((file) => (
              <article className="file-card" key={file.id} aria-busy={busyFileId === file.id}>
                <FileThumbnail file={file} libraryRoot={libraryRoot} />
                <div className="file-card-body">
                  <span className="file-category">{file.category}</span>
                  <h3>{file.name}</h3>
                  <p title={file.relativePath}>{file.relativePath}</p>
                  <div><span>{fileSize(file.sizeBytes)}</span><span>{shortDate(file.createdAt)}</span></div>
                </div>
                <div className="file-card-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => void openFileLocation(file)}
                    aria-label={`在资源管理器中打开 ${file.name}`}
                    title="在资源管理器中打开"
                  >
                    <ExternalLink size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => void deleteFile(file)}
                    disabled={Boolean(busyFileId)}
                    aria-label={`删除 ${file.name}`}
                    title="移入回收站"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="load-more-row">
              <button type="button" className="button button-secondary" onClick={() => setVisibleCount((count) => count + 48)}>
                再显示 {Math.min(48, filtered.length - visibleCount)} 个
              </button>
              <span>已显示 {visibleFiles.length} / {filtered.length}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
