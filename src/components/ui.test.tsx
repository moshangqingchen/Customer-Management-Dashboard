import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Modal, SearchableSelect } from "./ui";

describe("Modal", () => {
  it("exposes dialog semantics, closes on Escape and restores focus", async () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "打开弹窗";
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <Modal title="编辑客户" subtitle="保存后立即生效" onClose={onClose}>
        <input aria-label="客户名称" />
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "编辑客户" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    await waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });
});

describe("SearchableSelect", () => {
  it("supports choosing an option with arrow keys", () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        ariaLabel="订单状态"
        value="待处理"
        options={["待处理", "待发货", "已发货"]}
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("combobox", { name: "订单状态" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("待发货");
  });
});
