import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CustomerForm } from "./CustomerForm";

describe("CustomerForm", () => {
  it("accepts a dragged QR image path", () => {
    render(<CustomerForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    const dropZone = screen.getByLabelText("拖入客户二维码");
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [{ path: "D:\\二维码\\林女士.png", name: "林女士.png" }],
      },
    });

    expect(screen.getByText("林女士.png")).toBeInTheDocument();
  });
});
