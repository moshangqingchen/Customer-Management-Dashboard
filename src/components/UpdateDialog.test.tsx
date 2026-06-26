import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UpdateDialog, type AvailableUpdate } from "./UpdateDialog";

const update: AvailableUpdate = {
  version: "1.1.0",
  date: "2026-06-21",
  body: "新增更新提醒\n修复订单文件刷新",
};

describe("UpdateDialog", () => {
  it("offers only cancel or update-and-restart for an available update", () => {
    const onDismiss = vi.fn();
    const onInstall = vi.fn();

    render(
      <UpdateDialog
        update={update}
        status="available"
        progress={0}
        error=""
        onDismiss={onDismiss}
        onInstall={onInstall}
      />,
    );

    expect(screen.getByText("新增更新提醒")).toBeInTheDocument();
    expect(screen.getByText("修复订单文件刷新")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消此次更新" }));
    fireEvent.click(screen.getByRole("button", { name: "更新并重启" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /稍后/ })).not.toBeInTheDocument();
  });

  it("locks dismissal while the update is installing", () => {
    render(
      <UpdateDialog
        update={update}
        status="installing"
        progress={42}
        error=""
        onDismiss={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消此次更新" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "正在更新" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "关闭" })).toBeDisabled();
  });
});
