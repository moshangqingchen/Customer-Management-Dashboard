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
    window.localStorage.clear();
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

  it("manages categorized customer service quick replies on a main page", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "客服快捷语" }));
    expect(await screen.findByRole("heading", { name: "客服快捷语" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("主类名称"), { target: { value: "客户犹豫不回" } });
    fireEvent.change(screen.getByLabelText("主类说明"), { target: { value: "客户已读后没有明确回复时使用" } });
    fireEvent.click(screen.getByRole("button", { name: "添加主类" }));

    fireEvent.change(screen.getByLabelText("小类名称"), { target: { value: "温和跟进" } });
    fireEvent.change(screen.getByLabelText("小类说明"), { target: { value: "先确认是否方便，不制造压力" } });
    fireEvent.click(screen.getByRole("button", { name: "添加小类" }));

    fireEvent.change(screen.getByLabelText("话术标题"), { target: { value: "给选择题" } });
    fireEvent.change(screen.getByLabelText("话术内容"), { target: { value: "亲，您看这个方向是继续优化，还是先按现在这版安排？" } });
    fireEvent.click(screen.getByRole("button", { name: "添加话术" }));
    fireEvent.click(screen.getByRole("button", { name: "复制话术：给选择题" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("亲，您看这个方向是继续优化，还是先按现在这版安排？"));
  });

  it("supports context menu add and delete actions in customer service quick replies", async () => {
    const prompt = vi.spyOn(window, "prompt");
    prompt
      .mockReturnValueOnce("右键小类")
      .mockReturnValueOnce("通过右键添加的小类")
      .mockReturnValueOnce("右键话术")
      .mockReturnValueOnce("这是通过右键添加的话术。");

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "客服快捷语" }));
    const categoryList = document.querySelector(".reply-category-list");
    expect(categoryList).not.toBeNull();
    fireEvent.contextMenu(within(categoryList as HTMLElement).getByRole("button", { name: /客户犹豫不回/ }));
    fireEvent.click(screen.getByRole("button", { name: "新增小类" }));

    const sceneList = document.querySelector(".reply-scene-list");
    expect(sceneList).not.toBeNull();
    expect(await within(sceneList as HTMLElement).findByRole("button", { name: /右键小类/ })).toBeInTheDocument();

    fireEvent.contextMenu(within(sceneList as HTMLElement).getByRole("button", { name: /右键小类/ }));
    fireEvent.click(screen.getByRole("button", { name: "新增话术" }));

    expect(await screen.findByText("右键话术")).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByText("右键话术").closest("article")!);
    fireEvent.click(screen.getByRole("button", { name: "删除话术" }));

    expect(screen.queryByText("右键话术")).not.toBeInTheDocument();
  });

  it("edits quick reply categories, scenes, and replies from context menus", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "客服快捷语" }));

    const categoryList = document.querySelector(".reply-category-list");
    expect(categoryList).not.toBeNull();
    const categoryCard = within(categoryList as HTMLElement).getByRole("button", { name: /客户犹豫不回/ });
    fireEvent.contextMenu(categoryCard);
    fireEvent.click(screen.getByRole("button", { name: "更改主类" }));
    fireEvent.change(screen.getByLabelText("编辑主类名称"), { target: { value: "客户犹豫跟进" } });
    fireEvent.change(screen.getByLabelText("编辑主类说明"), { target: { value: "客户看过方案后未回复时使用" } });
    fireEvent.click(screen.getByRole("button", { name: "保存更改" }));
    expect(within(categoryList as HTMLElement).getByRole("button", { name: /客户犹豫跟进/ })).toBeInTheDocument();

    const sceneList = document.querySelector(".reply-scene-list");
    expect(sceneList).not.toBeNull();
    const sceneCard = within(sceneList as HTMLElement).getByRole("button", { name: /温和跟进/ });
    fireEvent.contextMenu(sceneCard);
    fireEvent.click(screen.getByRole("button", { name: "更改小类" }));
    fireEvent.change(screen.getByLabelText("编辑小类名称"), { target: { value: "温和提醒" } });
    fireEvent.change(screen.getByLabelText("编辑小类说明"), { target: { value: "降低客户回复压力" } });
    fireEvent.click(screen.getByRole("button", { name: "保存更改" }));
    expect(within(sceneList as HTMLElement).getByRole("button", { name: /温和提醒/ })).toBeInTheDocument();

    const replyCard = screen.getByText("确认是否方便").closest("article");
    expect(replyCard).not.toBeNull();
    fireEvent.contextMenu(replyCard!);
    fireEvent.click(screen.getByRole("button", { name: "更改话术" }));
    fireEvent.change(screen.getByLabelText("编辑话术标题"), { target: { value: "确认设计方向" } });
    fireEvent.change(screen.getByLabelText("编辑话术内容"), { target: { value: "亲，您看当前设计方向是否合适？需要调整可以直接告诉我。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存更改" }));

    expect(screen.getByText("确认设计方向")).toBeInTheDocument();
    expect(screen.getByText("亲，您看当前设计方向是否合适？需要调整可以直接告诉我。")).toBeInTheDocument();
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
