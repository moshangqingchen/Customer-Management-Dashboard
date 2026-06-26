import type { Order } from "./types";

export function orderProjectNames(order: Pick<Order, "items">) {
  const names = order.items.map((item) => item.name.trim()).filter(Boolean);
  return names.length > 0 ? names.join("、") : "未填写项目名称";
}
