import { ExternalLink, FileArchive, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { FileThumbnail } from "../components/FileThumbnail";
import { api } from "../lib/api";
import { absoluteFilePath } from "../lib/files";
import { fileSize, shortDate } from "../lib/format";
import type { FileRecord } from "../lib/types";
import { EmptyState, PageHeader } from "../components/ui";

export function FilesPage({ files, libraryRoot, onChanged }: { files: FileRecord[]; libraryRoot?: string | null; onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => files.filter((file) => JSON.stringify(file).toLowerCase().includes(query.toLowerCase())), [files, query]);
  return (
    <div className="page-content">
      <PageHeader eyebrow="受管文件库" title="文件中心" description="查看所有订单文件。删除操作会先移入文件库的 _回收站。" />
      <div className="toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件名、分类或路径…" /></label><span className="result-count">{filtered.length} 个文件</span></div>
      {filtered.length === 0 ? <EmptyState icon={<FileArchive size={28} />} title="还没有受管文件" description="从订单详情上传或拖拽文件后，会出现在这里。" /> :
      <div className="file-grid">{filtered.map((file) => <article className="file-card" key={file.id}><FileThumbnail file={file} libraryRoot={libraryRoot} /><div className="file-card-body"><span className="file-category">{file.category}</span><h3>{file.name}</h3><p>{file.relativePath}</p><div><span>{fileSize(file.sizeBytes)}</span><span>{shortDate(file.createdAt)}</span></div></div><div className="file-card-actions"><button className="icon-button" onClick={() => api.openInExplorer(absoluteFilePath(file, libraryRoot))}><ExternalLink size={16} /></button><button className="icon-button danger" onClick={async () => { await api.deleteFile(file.id); onChanged(); }}><Trash2 size={16} /></button></div></article>)}</div>}
    </div>
  );
}
