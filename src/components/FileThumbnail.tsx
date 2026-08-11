import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon } from "lucide-react";

import { api } from "../lib/api";
import { absoluteFilePath, fileKindLabel, isImageFile } from "../lib/files";
import type { FileRecord } from "../lib/types";

export function FileThumbnail({
  file,
  libraryRoot,
  compact = false,
}: {
  file: FileRecord;
  libraryRoot?: string | null;
  compact?: boolean;
}) {
  const [preview, setPreview] = useState("");
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const image = isImageFile(file);
  const previewable = image && file.sizeBytes <= 16 * 1024 * 1024;

  useEffect(() => {
    if (visible || !previewable || typeof IntersectionObserver === "undefined") return;
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [previewable, visible]);

  useEffect(() => {
    let alive = true;
    setPreview("");
    if (!previewable || !visible) return () => { alive = false; };

    api.readImageDataUrl(absoluteFilePath(file, libraryRoot))
      .then((dataUrl) => {
        if (alive) setPreview(dataUrl);
      })
      .catch(() => {
        if (alive) setPreview("");
      });

    return () => { alive = false; };
  }, [file.id, file.relativePath, file.sizeBytes, file.createdAt, previewable, visible, libraryRoot]);

  if (image && preview) {
    return (
      <div ref={containerRef} className={`file-thumbnail ${compact ? "compact" : ""}`}>
        <img src={preview} alt={`${file.name} 缩略图`} loading="lazy" decoding="async" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`file-thumbnail placeholder ${compact ? "compact" : ""}`}
      title={image && !previewable ? "图片较大，已暂停自动预览，可在资源管理器中打开" : undefined}
    >
      {image ? <ImageIcon size={compact ? 18 : 24} /> : <FileText size={compact ? 18 : 24} />}
      <span>{image && !previewable ? "大图" : image ? "图片" : fileKindLabel(file)}</span>
    </div>
  );
}
