import type { CustomerColumnMapping, ImportCustomerRow, SpreadsheetPreview } from "./types";

type SheetRow = Record<string, unknown>;

const text = (value: unknown) => (value == null ? "" : String(value).trim());

export function mapCustomerRows(rows: SheetRow[]): ImportCustomerRow[] {
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    name: text(row["客户名称"] ?? row["客户"] ?? row["姓名"]),
    phone: text(row["电话"] ?? row["手机号"]),
    wechat: text(row["微信号"] ?? row["微信"]),
    platform: text(row["平台"] ?? row["来源平台"]),
    platformHandle: text(row["平台网名"] ?? row["网名"] ?? row["昵称"]),
    notes: text(row["备注"]),
    vipLevel: Math.min(5, Math.max(0, Number(row["VIP星级"] ?? row["星级"] ?? 0) || 0)),
    tags: text(row["标签"])
      .split(/[,，;；]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  }));
}

const aliases: Record<keyof CustomerColumnMapping, string[]> = {
  name: ["客户名称", "客户", "姓名", "买家", "买家名称"],
  phone: ["电话", "手机号", "联系电话", "联系号码"],
  wechat: ["微信号", "微信"],
  platform: ["平台", "来源平台", "渠道"],
  platformHandle: ["平台网名", "网名", "昵称", "平台昵称"],
  notes: ["备注", "客户备注"],
  vipLevel: ["VIP星级", "星级", "VIP"],
  tags: ["标签", "备注标签"],
};

export function defaultColumnMapping(headers: string[]): CustomerColumnMapping {
  return Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [field, headers.find((header) => names.includes(header))]),
  ) as CustomerColumnMapping;
}

export function mapPreviewRows(preview: SpreadsheetPreview, mapping: CustomerColumnMapping): ImportCustomerRow[] {
  const index = (field: keyof CustomerColumnMapping) => {
    const header = mapping[field];
    return header ? preview.headers.indexOf(header) : -1;
  };
  const value = (row: string[], field: keyof CustomerColumnMapping) => {
    const column = index(field);
    return column >= 0 ? text(row[column]) : "";
  };
  return preview.rows.map((row, rowIndex) => ({
    rowNumber: rowIndex + 2,
    name: value(row, "name"),
    phone: value(row, "phone"),
    wechat: value(row, "wechat"),
    platform: value(row, "platform"),
    platformHandle: value(row, "platformHandle"),
    notes: value(row, "notes"),
    vipLevel: Math.min(5, Math.max(0, Number(value(row, "vipLevel")) || 0)),
    tags: value(row, "tags").split(/[,，;；]/).map((tag) => tag.trim()).filter(Boolean),
  }));
}
