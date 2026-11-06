import type { FileEntry, ID } from './types';

export interface FileVersion {
  id: ID; originalPath: string; originalRelPath: string; snapshotPath: string;
  name: string; sizeBytes: number; note: string; createdAt: string;
  clientId: ID | null; projectId: ID | null; available: boolean;
}
export interface FileRecycleEntry {
  id: ID; originalPath: string; originalRelPath: string; storedPath: string;
  name: string; sizeBytes: number; deletedAt: string; legacy: boolean;
  clientId: ID | null; projectId: ID | null;
}
export interface FileHistoryApi {
  list(path?: string): Promise<FileVersion[]>;
  save(path: string, note?: string): Promise<FileVersion>;
  replace(path: string, sourcePath: string, note?: string): Promise<FileEntry>;
  pickReplace(path: string, note?: string): Promise<FileEntry | null>;
  restore(id: ID): Promise<FileEntry>;
  trashList(): Promise<FileRecycleEntry[]>;
  restoreTrash(id: ID): Promise<FileEntry>;
}
