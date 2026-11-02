export type ID = string;
export type ProjectStatus = "lead" | "active" | "review" | "delivered" | "done" | "cancelled";
export type PaymentKind = "income" | "refund";
export type TagColor = "red" | "orange" | "amber" | "lime" | "green" | "teal" | "cyan" | "blue" | "violet" | "pink" | "gray";
export type FileKind = "image" | "design" | "pdf" | "doc" | "archive" | "video" | "other";
export type ActivityKind = "note" | "status" | "payment" | "file" | "created";

export interface Tag { id: ID; name: string; color: TagColor; sort: number; clientCount: number; projectCount: number; }

export interface ClientAccount { platform: string; handle: string; }

export interface Client {
  id: ID; name: string; company: string; phone: string; wechat: string; email: string; address: string;
  accounts: ClientAccount[]; rating: number; pinned: boolean; notes: string; folder: string | null;
  tagIds: ID[]; createdAt: string; updatedAt: string;
  // 派生
  projectCount: number; openProjectCount: number;      // open = 非 done/cancelled
  billedCents: number;                                 // Σ price（排除 cancelled）
  receivedCents: number;                               // Σ 收款净额
  outstandingCents: number;                            // Σ 各项目待收
  firstProjectAt: string | null; lastActivityAt: string;
}
export type ClientInput = {
  name: string; company?: string; phone?: string; wechat?: string; email?: string; address?: string;
  accounts?: ClientAccount[]; rating?: number; pinned?: boolean; notes?: string; tagIds?: ID[];
};
export type ClientPatch = Partial<Omit<ClientInput, "tagIds">> & { renameFolder?: boolean };

export interface Project {
  id: ID; clientId: ID; clientName: string; title: string; status: ProjectStatus; pinned: boolean;
  brief: string; sourcePlatform: string; sourceOrderNo: string;
  startDate: string | null; dueDate: string | null; deliveredAt: string | null; completedAt: string | null;
  priceCents: number; costCents: number; tagIds: ID[]; folder: string | null;
  createdAt: string; updatedAt: string;
  // 派生
  receivedCents: number; paymentCount: number; fileCount: number;
  coverPath: string | null; // 项目文件夹中最近修改的图片（png/jpg/jpeg/webp/gif，≤25MB）；与 fileCount 同一次扫描、同一缓存
}
export type ProjectInput = {
  clientId: ID; title: string; status?: ProjectStatus; pinned?: boolean; brief?: string;
  sourcePlatform?: string; sourceOrderNo?: string; startDate?: string | null; dueDate?: string | null;
  priceCents?: number; costCents?: number; tagIds?: ID[];
};
export type ProjectPatch = Partial<Omit<ProjectInput, "tagIds" | "status">> & { renameFolder?: boolean };

export interface Payment {
  id: ID; projectId: ID; kind: PaymentKind; amountCents: number; paidAt: string; method: string; note: string; createdAt: string;
}
export interface PaymentWithContext extends Payment { projectTitle: string; clientId: ID; clientName: string; }
export type PaymentInput = { projectId: ID; kind?: PaymentKind; amountCents: number; paidAt: string; method?: string; note?: string; };
export type PaymentPatch = Partial<Omit<PaymentInput, "projectId">>;

export interface Activity {
  id: ID; clientId: ID; projectId: ID | null; projectTitle: string | null; clientName: string;
  kind: ActivityKind; body: string; meta: Record<string, unknown>; createdAt: string;
}

export interface SnippetGroup { id: ID; name: string; sort: number; }
export interface Snippet { id: ID; groupId: ID; title: string; body: string; sort: number; useCount: number; updatedAt: string; }

export interface FileEntry {
  path: string; relPath: string; name: string; ext: string; kind: FileKind;
  sizeBytes: number; modifiedAt: string; folderGroup: string;
  clientId: ID | null; projectId: ID | null;
}
export interface FileListResult { files: FileEntry[]; folder: string | null; folderMissing: boolean; }
export interface FilesAddResult { added: FileEntry[]; failed: { name: string; message: string }[]; }
export type FileTarget = { projectId: ID } | { clientId: ID };

export interface LibraryStatus {
  root: string | null; state: "ready" | "notConfigured" | "missing" | "readOnly"; freeBytes: number | null; message: string;
}
export interface Settings {
  theme: "light" | "dark" | "system"; subfolderTemplate: string[]; paymentMethods: string[];
  sourcePlatforms: string[]; lastPaymentMethod: string;
}
export interface BackupInfo { fileName: string; path: string; sizeBytes: number; createdAt: string; kind: "auto" | "manual" | "beforeRestore"; }
export interface TrashItem { type: "client" | "project"; id: ID; title: string; subtitle: string; deletedAt: string; }
export interface AppInfo { version: string; dataDir: string; dbPath: string; }
export interface MutationResult<T> { value: T; warning: string | null; }
export interface AppErrorPayload { code: string; message: string; }
