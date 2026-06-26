export type StatusTone = "blue" | "green" | "orange" | "purple" | "red" | "gray";

const statusTones: Record<string, StatusTone> = {
  待设计: "orange",
  设计中: "purple",
  待确认: "blue",
  设计完成: "green",
  无需设计: "gray",
  待处理: "orange",
  待发货: "purple",
  已发货: "blue",
  已签收: "green",
  已取消: "gray",
  未收: "red",
  部分收款: "orange",
  已结清: "green",
};

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(Math.trunc(cents));
  return `${sign}¥${Math.floor(absolute / 100).toLocaleString("zh-CN")}.${String(absolute % 100).padStart(2, "0")}`;
}

export function getStatusTone(status: string): StatusTone {
  return statusTones[status] ?? "gray";
}

export function paymentProgress(totalCents: number, receivedCents: number): number {
  if (totalCents <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((receivedCents / totalCents) * 100)));
}

export function shortDate(value?: string | null): string {
  if (!value) return "未设置";
  return value.slice(0, 10);
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

