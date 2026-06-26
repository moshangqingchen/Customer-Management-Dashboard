import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilesPage } from "./FilesPage";
import type { FileRecord } from "../lib/types";

const imageFile: FileRecord = {
  id: "file-image",
  orderId: "order-1",
  customerId: "customer-1",
  category: "成品",
  name: "定稿预览.png",
  relativePath: "客户/订单/定稿预览.png",
  sizeBytes: 2048,
  createdAt: "2026-06-06T00:00:00Z",
};

describe("FilesPage", () => {
  it("shows image thumbnails in the file center", async () => {
    render(<FilesPage files={[imageFile]} libraryRoot="D:\\客户文件库" onChanged={vi.fn()} />);

    expect(await screen.findByAltText("定稿预览.png 缩略图")).toBeInTheDocument();
  });
});
