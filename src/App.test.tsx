import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/updater", () => ({
  checkForAppUpdate: vi.fn(() => Promise.resolve(null)),
  closePendingUpdate: vi.fn(() => Promise.resolve()),
  installAppUpdate: vi.fn(() => Promise.resolve()),
}));

import App from "./App";
import { api } from "./lib/api";
import { checkForAppUpdate, installAppUpdate } from "./lib/updater";

const mockedCheckForAppUpdate = vi.mocked(checkForAppUpdate);
const mockedInstallAppUpdate = vi.mocked(installAppUpdate);

describe("App", () => {
  beforeEach(() => {
    mockedCheckForAppUpdate.mockResolvedValue(null);
    mockedInstallAppUpdate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the dashboard with practical daily-work sections", async () => {
    render(<App />);

    expect(await screen.findByText("早上好，今天也要有条理")).toBeInTheDocument();
    expect(screen.getByText("最近订单")).toBeInTheDocument();
    expect(screen.getByText("待处理设计")).toBeInTheDocument();
  });

  it("syncs the managed library when the refresh button is clicked", async () => {
    const sync = vi.spyOn(api, "syncManagedLibrary").mockResolvedValue(undefined);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "刷新" }));

    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
  });

  it("focuses global search with Ctrl+K", async () => {
    render(<App />);

    const search = await screen.findByPlaceholderText("搜索客户、订单号、电话、快递单号…");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(search).toHaveFocus();
  });

  it("offers a direct customer creation shortcut from the dashboard", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "新建客户" }));

    expect(screen.getByRole("heading", { name: "新建客户" })).toBeInTheDocument();
  });

  it("opens source factory management from the sidebar", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /源头厂家/ }));

    expect(await screen.findByRole("heading", { name: "源头厂家" })).toBeInTheDocument();
    expect(screen.getAllByText("华彩印刷源头厂").length).toBeGreaterThan(0);
  });

  it("opens the complete order page with the project name and address intact", async () => {
    render(<App />);

    const recentOrders = await screen.findByText("最近订单");
    const recentOrdersSection = recentOrders.closest("section");
    expect(recentOrdersSection).not.toBeNull();
    fireEvent.click(within(recentOrdersSection!).getByRole("button", { name: /宣传单设计/ }));

    expect(await screen.findByRole("heading", { name: "订单管理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "宣传单设计、A4 双面彩印" })).toBeInTheDocument();
    expect(screen.getAllByText("上海市浦东新区创意路 18 号").length).toBeGreaterThan(0);
  });

  it("prompts for a pushed update after startup", async () => {
    mockedCheckForAppUpdate.mockResolvedValue({
      version: "1.1.0",
      currentVersion: "1.0.0",
      date: "2026-06-21",
      body: "新增订单更新提醒\n修复文件刷新问题",
      native: {} as never,
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "发现新版本 1.1.0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消此次更新" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新并重启" })).toBeInTheDocument();
  });

  it("installs an accepted update and restarts the app", async () => {
    mockedCheckForAppUpdate.mockResolvedValue({
      version: "1.1.0",
      currentVersion: "1.0.0",
      date: "2026-06-21",
      body: "更新并重启流程验证",
      native: {} as never,
    });
    const restart = vi.spyOn(api, "restartApp").mockResolvedValue(undefined);

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "更新并重启" }));

    await waitFor(() => expect(mockedInstallAppUpdate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(restart).toHaveBeenCalledTimes(1));
  });

});
