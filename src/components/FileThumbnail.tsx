import { useEffect, useState } from "react";
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
  const image = isImageFile(file);

  useEffect(() => {
    let alive = true;
    setPreview("");
    if (!image) return () => { alive = false; };

    api.readImageDataUrl(absoluteFilePath(file, libraryRoot))
      .then((dataUrl) => {
        if (alive) setPreview(dataUrl);
      })
      .catch(() => {
        if (alive) setPreview("");
      });

    return () => { alive = false; };
  }, [file.id, file.relativePath, file.sizeBytes, file.createdAt, image, libraryRoot]);

  if (image && preview) {
    return (
      <div className={`file-thumbnail ${compact ? "compact" : ""}`}>
        <img src={preview} alt={`${file.name} 缩略图`} />
      </div>
    );
  }

  return (
    <div className={`file-thumbnail placeholder ${compact ? "compact" : ""}`}>
      {image ? <ImageIcon size={compact ? 18 : 24} /> : <FileText size={compact ? 18 : 24} />}
      <span>{image ? "图片" : fileKindLabel(file)}</span>
    </div>
  );
}
