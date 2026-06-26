import { describe, expect, it } from "vitest";

import { mapCustomerRows, mapPreviewRows } from "./import";

describe("customer spreadsheet mapping", () => {
  it("maps common Chinese column names into import rows", () => {
    const rows = mapCustomerRows([
      {
        客户名称: "林女士",
        电话: "13800138000",
        微信号: "lin-wx",
        平台: "闲鱼",
        平台网名: "林林的店",
        VIP星级: 3,
        标签: "复购,加急",
      },
    ]);

    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      name: "林女士",
      phone: "13800138000",
      vipLevel: 3,
      tags: ["复购", "加急"],
    });
  });

  it("maps arbitrary spreadsheet columns using the selected field mapping", () => {
    const rows = mapPreviewRows(
      { headers: ["买家", "联系号码", "渠道"], rows: [["林女士", "13800138000", "闲鱼"]] },
      { name: "买家", phone: "联系号码", platform: "渠道" },
    );

    expect(rows[0]).toMatchObject({ name: "林女士", phone: "13800138000", platform: "闲鱼" });
  });
});
