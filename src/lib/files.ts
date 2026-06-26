import type { FileRecord } from "./types";

const imageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg"]);

export function fileExtension(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function isImageFile(file: Pick<FileRecord, "name" | "relativePath">) {
  return imageExtensions.has(fileExtension(file.name || file.relativePath));
}

export function absoluteFilePath(file: FileRecord, libraryRoot?: string | null) {
  return /^[a-zA-Z]:[\\/]|^\\\\/.test(file.relativePath)
    ? file.relativePath
    : `${libraryRoot ?? ""}\\${file.relativePath}`;
}

export function fileKindLabel(file: Pick<FileRecord, "name" | "relativePath">) {
  const extension = fileExtension(file.name || file.relativePath);
  return extension ? extension.toUpperCase() : "文件";
}
