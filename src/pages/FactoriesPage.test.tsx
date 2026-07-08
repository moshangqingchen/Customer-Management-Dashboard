import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FactoriesPage } from "./FactoriesPage";
import { api } from "../lib/api";
import type { SourceFactory, SourceFactoryProject, SourceQuote } from "../lib/types";

vi.mock("../lib/api", () => ({
  api: {
    createSourceFactory: vi.fn(),
    updateSourceFactory: vi.fn(),
    deleteSourceFactory: vi.fn(),
    createSourceFactoryProject: vi.fn(),
    deleteSourceFactoryProject: vi.fn(),
    openExternalUrl: vi.fn(),
    createSourceQuote: vi.fn(),
    updateSourceQuote: vi.fn(),
    deleteSourceQuote: vi.fn(),
  },
}));

const factory: SourceFactory = {
  id: "factory-huacai",
  name: "华彩印刷源头厂",
  contactName: "陈经理",
  phone: "020-88886012",
  wechat: "huacai-print",
  qq: "285001234",
  orderUrl: "https://huacai.example.com/order",
  address: "广州市白云区印刷产业园",
  tags: ["名片", "铜版纸"],
  shippingNotes: "小件 8 元起",
  notes: "常规印刷稳定",
  quoteCount: 2,
  createdAt: "2026-06-06T00:00:00Z",
  updatedAt: "2026-06-06T00:00:00Z",
};

const displayFactory: SourceFactory = {
  id: "factory-display",
  name: "鑫展写真制作厂",
  contactName: "李工",
  phone: "0571-66880920",
  wechat: "xz-display",
  qq: "16880920",
  orderUrl: "",
  address: "杭州市广告材料市场",
  tags: ["写真", "展板"],
  shippingNotes: "按尺寸计费",
  notes: "写真出货快",
  quoteCount: 1,
  createdAt: "2026-06-06T00:00:00Z",
  updatedAt: "2026-06-06T00:00:00Z",
};

const quote: SourceQuote = {
  id: "quote-card-1000",
  factoryId: factory.id,
  factoryName: factory.name,
  itemType: "印刷",
  itemName: "名片",
  quantity: 1000,
  size: "90×54mm",
  material: "铜版纸",
  paperWeight: "300g",
  sides: "双面",
  color: "彩色",
  finish: "亮膜 / 圆角",
  productionCostCents: 4500,
  shippingCostCents: 800,
  leadTime: "2-3 天",
  notes: "",
  createdAt: "2026-06-06T00:00:00Z",
  updatedAt: "2026-06-06T00:00:00Z",
};

const quoteSmallBatch: SourceQuote = {
  ...quote,
  id: "quote-card-500",
  quantity: 500,
  productionCostCents: 2800,
  shippingCostCents: 700,
  updatedAt: "2026-06-07T00:00:00Z",
};

const flyerQuote: SourceQuote = {
  ...quote,
  id: "quote-flyer",
  itemName: "合版宣传单",
  quantity: 2000,
  size: "16开210×285mm",
  material: "铜版纸",
  paperWeight: "行标157g",
  finish: "对折两页",
  productionCostCents: 16800,
  shippingCostCents: 1200,
  updatedAt: "2026-06-05T00:00:00Z",
};

const defaultFactoryProjects: SourceFactoryProject[] = [
  { id: "project-card-category", factoryId: factory.id, categoryName: "名片", projectName: "", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
  { id: "project-card-normal", factoryId: factory.id, categoryName: "名片", projectName: "普通名片", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
  { id: "project-card-special", factoryId: factory.id, categoryName: "名片", projectName: "特种纸名片", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
  { id: "project-flyer-category", factoryId: factory.id, categoryName: "宣传单", projectName: "", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
  { id: "project-flyer-combined", factoryId: factory.id, categoryName: "宣传单", projectName: "合版宣传单", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
  { id: "project-flyer-dedicated", factoryId: factory.id, categoryName: "宣传单", projectName: "专版宣传单", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
];

function renderFactories(quotes: SourceQuote[] = [quote, quoteSmallBatch, flyerQuote], factoryProjects = defaultFactoryProjects) {
  return render(<FactoriesPage factories={[factory, displayFactory]} factoryProjects={factoryProjects} quotes={quotes} onSelect={vi.fn()} onChanged={vi.fn()} />);
}

function datalistOptions(input: HTMLElement) {
  const listId = input.getAttribute("list");
  expect(listId).toBeTruthy();
  return Array.from(document.querySelectorAll<HTMLOptionElement>(`#${listId} option`)).map((option) => option.value);
}

function selectOptions(label: string) {
  const control = screen.getByLabelText(label);
  const searchableOptions = control.getAttribute("data-options");
  if (searchableOptions !== null) return searchableOptions.split("\n").filter(Boolean);
  return Array.from((control as HTMLSelectElement).options).map((option) => option.textContent).filter(Boolean);
}

function chooseSelectOption(label: string, text: string) {
  const control = screen.getByLabelText(label);
  if (control.getAttribute("role") === "combobox") {
    fireEvent.focus(control);
    fireEvent.change(control, { target: { value: text } });
    fireEvent.mouseDown(screen.getByRole("option", { name: text }));
    return;
  }
  const select = control as HTMLSelectElement;
  const option = Array.from(select.options).find((item) => item.textContent === text);
  expect(option).toBeTruthy();
  fireEvent.change(select, { target: { value: option?.value } });
}

function projectButton(name: string, className: string) {
  const button = screen.queryAllByRole("button", { name }).find((item) => item.classList.contains(className));
  expect(button).toBeTruthy();
  return button as HTMLElement;
}

async function findProjectButton(name: string, className: string) {
  await waitFor(() => {
    expect(screen.queryAllByRole("button", { name }).some((item) => item.classList.contains(className))).toBe(true);
  });
  return projectButton(name, className);
}

function categoryButton(name: string) {
  return projectButton(name, "project-category-card");
}

function subProjectButton(name: string) {
  return projectButton(name, "project-sub-card");
}

function expandCategory(name: string) {
  const category = categoryButton(name);
  if (category.getAttribute("aria-expanded") !== "true") fireEvent.click(category);
}

async function findCategoryButton(name: string) {
  return findProjectButton(name, "project-category-card");
}

async function findSubProjectButton(name: string) {
  return findProjectButton(name, "project-sub-card");
}

async function addCategory(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "添加大类" }));
  fireEvent.change(screen.getByLabelText("新增大类名称"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "确认添加大类" }));
  await findCategoryButton(name);
}

async function addProject(categoryName: string, projectName = categoryName) {
  const category = await findCategoryButton(categoryName);
  if (category.getAttribute("aria-expanded") !== "true") fireEvent.click(category);
  fireEvent.contextMenu(category, { clientX: 120, clientY: 160 });
  fireEvent.click(await screen.findByRole("menuitem", { name: "新增小类" }));
  fireEvent.change(screen.getByLabelText("新增小类名称"), { target: { value: projectName } });
  fireEvent.click(screen.getByRole("button", { name: "确认添加小类" }));
  await findSubProjectButton(projectName === "送货单" ? "联单" : projectName);
}

async function addDraftProject(name: string, categoryName = name) {
  await addCategory(categoryName);
  await addProject(categoryName, name);
}

describe("FactoriesPage", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(api.createSourceFactory).mockReset();
    vi.mocked(api.updateSourceFactory).mockReset();
    vi.mocked(api.createSourceQuote).mockReset();
    vi.mocked(api.updateSourceQuote).mockReset();
    vi.mocked(api.deleteSourceQuote).mockReset();
    vi.mocked(api.deleteSourceFactory).mockReset();
    vi.mocked(api.createSourceFactoryProject).mockReset();
    vi.mocked(api.deleteSourceFactoryProject).mockReset();
    vi.mocked(api.openExternalUrl).mockReset();
    vi.mocked(api.openExternalUrl).mockResolvedValue(undefined);
    vi.mocked(api.createSourceFactoryProject).mockImplementation(async (input) => ({
      id: `project-${input.categoryName}-${input.projectName || "category"}`,
      factoryId: input.factoryId,
      categoryName: input.categoryName,
      projectName: input.projectName,
      createdAt: "2026-06-08T00:00:00Z",
      updatedAt: "2026-06-08T00:00:00Z",
    }));
    vi.mocked(api.deleteSourceFactoryProject).mockResolvedValue(undefined);
  });

  it("saves the factory QQ number and order URL with the factory profile", async () => {
    const onChanged = vi.fn();
    vi.mocked(api.createSourceFactory).mockResolvedValue({ ...factory, id: "factory-new", qq: "123456789" });
    render(<FactoriesPage factories={[]} quotes={[]} onSelect={vi.fn()} onChanged={onChanged} />);

    fireEvent.click(screen.getAllByRole("button", { name: "添加厂家" })[0]);
    fireEvent.change(screen.getByLabelText("厂家名称 *"), { target: { value: "博博印务" } });
    fireEvent.change(screen.getByLabelText("联系人"), { target: { value: "陈经理" } });
    fireEvent.change(screen.getByLabelText("电话"), { target: { value: "13800138000" } });
    fireEvent.change(screen.getByLabelText("微信"), { target: { value: "bobo-print" } });
    fireEvent.change(screen.getByLabelText("QQ号"), { target: { value: "123456789" } });
    fireEvent.change(screen.getByLabelText("下单网址"), { target: { value: "bobo.example.com/order" } });
    const submitButtons = screen.getAllByRole("button", { name: "添加厂家" });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(api.createSourceFactory).toHaveBeenCalledWith(expect.objectContaining({
      name: "博博印务",
      contactName: "陈经理",
      phone: "13800138000",
      wechat: "bobo-print",
      qq: "123456789",
      orderUrl: "bobo.example.com/order",
    })));
    expect(onChanged).toHaveBeenCalled();
  });

  it("opens the saved factory order URL from the factory workspace", async () => {
    renderFactories();

    fireEvent.click(screen.getByRole("button", { name: "进入华彩印刷源头厂" }));
    fireEvent.click(screen.getByRole("button", { name: "打开下单网址" }));

    await waitFor(() => expect(api.openExternalUrl).toHaveBeenCalledWith("https://huacai.example.com/order"));
  });

  it("shows the order URL shortcut on factory cards", async () => {
    renderFactories();

    fireEvent.click(screen.getByRole("button", { name: "下单网址" }));

    await waitFor(() => expect(api.openExternalUrl).toHaveBeenCalledWith("https://huacai.example.com/order"));
    expect(screen.getByRole("heading", { name: "源头厂家" })).toBeInTheDocument();
  });

  it("starts at the factory layer and enters the selected factory workspace", () => {
    renderFactories();

    expect(screen.getByRole("heading", { name: "源头厂家" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入华彩印刷源头厂" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "厂家项目" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "进入华彩印刷源头厂" }));

    expect(screen.getByRole("button", { name: "全部厂家" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "厂家项目" })).toBeInTheDocument();
    expect(screen.getByText("陈经理 · 020-88886012")).toBeInTheDocument();
  });

  it("shows a project catalog on the left and opens the specification price editor on the right", () => {
    renderFactories();

    fireEvent.click(screen.getByRole("button", { name: "进入华彩印刷源头厂" }));
    const projectCard = categoryButton("名片");
    expect(within(projectCard).getByText("名片")).toBeInTheDocument();
    expect(subProjectButton("普通名片")).toBeInTheDocument();
    expandCategory("宣传单");
    expect(subProjectButton("合版宣传单")).toBeInTheDocument();
    expect(subProjectButton("专版宣传单")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "不干胶" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "写真" })).not.toBeInTheDocument();

    fireEvent.click(subProjectButton("合版宣传单"));

    expect(screen.getByLabelText("规格价格详情")).toBeInTheDocument();
    expect(screen.queryByLabelText("项目类型")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("项目名称 *")).not.toBeInTheDocument();
    expect(screen.getByLabelText("尺寸")).toHaveValue("16开210×285mm");
    expect(selectOptions("纸张")).toEqual(expect.arrayContaining(["铜版纸", "双胶纸", "自定义"]));
    expect(selectOptions("克重")).toEqual(expect.arrayContaining(["行标157g", "A级157g", "行标200g", "250g", "105g", "自定义"]));
    expect(selectOptions("折页")).toEqual(expect.arrayContaining(["无", "对折两页", "三折页滚折", "关门折"]));
    expect(selectOptions("通用模切")).toEqual(expect.arrayContaining(["无", "压痕", "压点线", "压痕+压点线"]));
    expect(screen.getByLabelText("其他工艺")).toHaveValue("");
    expect(selectOptions("通用模切")).not.toEqual(expect.arrayContaining(["圆角", "覆膜 / 圆角"]));
    expect(screen.getByRole("button", { name: /2000 张/ })).toHaveTextContent("¥168.00");

    chooseSelectOption("纸张", "双胶纸");
    expect(selectOptions("克重")).toEqual(expect.arrayContaining(["100g", "自定义"]));
    expect(selectOptions("克重")).not.toEqual(expect.arrayContaining(["行标157g", "250g"]));
  });

  it("does not prefill project presets for a new factory workspace", async () => {
    render(<FactoriesPage factories={[factory]} factoryProjects={[]} quotes={[]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    expect(screen.getByText("还没有项目")).toBeInTheDocument();
    expect(screen.getByText("先添加项目")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "名片" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "合版宣传单" })).not.toBeInTheDocument();

    await addCategory("名片");

    expect(categoryButton("名片")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "普通名片" })).not.toBeInTheDocument();
    fireEvent.contextMenu(categoryButton("名片"), { clientX: 120, clientY: 160 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "新增小类" }));
    expect(datalistOptions(screen.getByLabelText("新增小类名称"))).toEqual(["普通名片", "PVC卡", "特种纸名片"]);
    expect(datalistOptions(screen.getByLabelText("新增小类名称"))).not.toEqual(expect.arrayContaining(["室内写真", "合版宣传单", "扇子"]));
    fireEvent.click(screen.getByRole("button", { name: "取消添加小类" }));
    await addProject("名片", "普通名片");
    expect(subProjectButton("普通名片")).toBeInTheDocument();
  });

  it("loads an existing quantity price and saves edits back to that quote", async () => {
    const onChanged = vi.fn();
    vi.mocked(api.updateSourceQuote).mockResolvedValue({ ...quote, productionCostCents: 9900, shippingCostCents: 1500 });
    render(<FactoriesPage factories={[factory]} quotes={[quote, quoteSmallBatch]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: /1000 张/ }));
    expect(screen.getByLabelText("厂家整批价")).toHaveValue(45);
    fireEvent.change(screen.getByLabelText("厂家整批价"), { target: { value: "99" } });
    fireEvent.change(screen.getByLabelText("该报价运费"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "保存这个数量价格" }));

    await waitFor(() => expect(api.updateSourceQuote).toHaveBeenCalledWith("quote-card-1000", expect.objectContaining({
      factoryId: factory.id,
      itemName: "普通名片",
      quantity: 1000,
      productionCostCents: 9900,
      shippingCostCents: 1500,
    })));
    expect(onChanged).toHaveBeenCalled();
  });

  it("creates a new price when the selected quantity has no saved price for the current spec", async () => {
    const onChanged = vi.fn();
    const savedQuote: SourceQuote = { ...quote, id: "quote-card-2000", quantity: 2000, productionCostCents: 6400 };
    vi.mocked(api.createSourceQuote).mockResolvedValue(savedQuote);
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: /2000 张/ }));
    expect(screen.getByLabelText("厂家整批价")).toHaveValue(0);
    fireEvent.change(screen.getByLabelText("厂家整批价"), { target: { value: "64" } });
    fireEvent.click(screen.getByRole("button", { name: "保存新价格" }));

    await waitFor(() => expect(api.createSourceQuote).toHaveBeenCalledWith(expect.objectContaining({
      factoryId: factory.id,
      itemName: "普通名片",
      quantity: 2000,
      productionCostCents: 6400,
    })));
    expect(onChanged).toHaveBeenCalled();
  });

  it("creates a price for a catalog project that does not have saved quotes yet", async () => {
    const onChanged = vi.fn();
    const savedQuote: SourceQuote = { ...quote, id: "quote-sticker", itemName: "不干胶", quantity: 500, productionCostCents: 8800 };
    vi.mocked(api.createSourceQuote).mockResolvedValue(savedQuote);
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={onChanged} />);

    await addDraftProject("不干胶");
    expect(await screen.findByRole("heading", { name: "不干胶" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /500 张/ }));
    fireEvent.change(screen.getByLabelText("厂家整批价"), { target: { value: "88" } });
    fireEvent.click(screen.getByRole("button", { name: "保存新价格" }));

    await waitFor(() => expect(api.createSourceQuote).toHaveBeenCalledWith(expect.objectContaining({
      factoryId: factory.id,
      itemName: "不干胶",
      quantity: 500,
      productionCostCents: 8800,
    })));
    expect(onChanged).toHaveBeenCalled();
  });

  it("groups legacy A4 color-print quotes under flyers instead of a standalone project", async () => {
    const colorPrintQuote: SourceQuote = {
      ...quote,
      id: "quote-a4-color",
      itemName: "A4 双面彩印",
      quantity: 200,
      size: "A4 210×297mm",
      material: "铜版纸",
      paperWeight: "157g",
      finish: "裁切",
    };
    render(<FactoriesPage factories={[factory]} quotes={[colorPrintQuote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "A4 双面彩印" })).not.toBeInTheDocument();
    fireEvent.click(await findSubProjectButton("合版宣传单"));

    expect(screen.getByRole("heading", { name: "合版宣传单" })).toBeInTheDocument();
    expect(screen.getByLabelText("数量")).toHaveValue(200);
    expect(screen.getByLabelText("厂家整批价")).toHaveValue(45);
  });

  it("uses special-paper card and dedicated flyer presets from the source catalog", () => {
    renderFactories();

    fireEvent.click(screen.getByRole("button", { name: "进入华彩印刷源头厂" }));
    fireEvent.click(subProjectButton("特种纸名片"));

    expect(screen.getByRole("heading", { name: "特种纸名片" })).toBeInTheDocument();
    expect(selectOptions("纸张")).toEqual(expect.arrayContaining(["300克荷兰白卡", "300克冰白珠光", "300克安格卡", "300g映画纸", "自定义"]));
    expect(selectOptions("纸张")).not.toEqual(expect.arrayContaining(["300克铜版纸", "铜版纸"]));

    expandCategory("宣传单");
    fireEvent.click(subProjectButton("专版宣传单"));

    expect(screen.getByRole("heading", { name: "专版宣传单" })).toBeInTheDocument();
    expect(selectOptions("纸张")).toEqual(expect.arrayContaining(["铜版纸", "高档铜版纸", "哑粉纸", "白卡纸", "新闻纸", "自定义"]));
    expect(selectOptions("克重")).toEqual(expect.arrayContaining(["80g", "157g", "250g", "350g", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(expect.arrayContaining(["16开(285×210)A4", "32开(210×140)A5", "2开(860×580)A1", "正度2开(530×760)", "自定义"]));
    expect(screen.getByRole("button", { name: "彩色" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "彩色+专色" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "UV" })).toBeInTheDocument();
    expect(selectOptions("通用覆膜")).toEqual(expect.arrayContaining(["无", "单面哑膜", "双面光膜"]));
    expect(selectOptions("折页")).toEqual(expect.arrayContaining(["无", "四折页风琴", "关门折"]));
    expect(selectOptions("通用模切")).toEqual(expect.arrayContaining(["无", "压痕", "简单模切", "复杂模切"]));
    expect(selectOptions("烫金")).toEqual(["无", "烫金"]);
    expect(selectOptions("烫银")).toEqual(["无", "烫银"]);
    expect(selectOptions("UV")).toEqual(["无", "局部UV"]);
    expect(selectOptions("凹凸")).toEqual(["无", "击凹", "击凸"]);
    expect(selectOptions("过油")).toEqual(["无", "单面光油", "双面光油"]);
    expect(selectOptions("压纹")).toEqual(["无", "压纹"]);
    expect(selectOptions("打号码")).toEqual(expect.arrayContaining(["无", "打单联号(下单备注打码要求)", "打双联号(下单备注打码要求)"]));
  });

  it("filters searchable print option controls while typing", () => {
    renderFactories();

    fireEvent.click(screen.getByRole("button", { name: "进入华彩印刷源头厂" }));
    expandCategory("宣传单");
    fireEvent.click(subProjectButton("专版宣传单"));

    const paper = screen.getByLabelText("纸张");
    fireEvent.focus(paper);
    fireEvent.change(paper, { target: { value: "米" } });

    expect(screen.getByRole("option", { name: "米白双胶纸" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "米黄双胶纸" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "米白超感纸" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "铜版纸" })).not.toBeInTheDocument();
  });

  it("offers quantity, finish, and project-specific material/size presets", () => {
    renderFactories([quote]);

    fireEvent.click(screen.getByRole("button", { name: "进入华彩印刷源头厂" }));

    expect(datalistOptions(screen.getByLabelText("数量"))).toEqual(expect.arrayContaining(["500", "1000", "5000"]));
    expect(selectOptions("材质")).toEqual(expect.arrayContaining(["铜版纸", "哑粉纸", "白卡纸", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(["90×54mm", "90×50mm", "180×54mm", "110×90mm", "140×100mm", "160×54mm", "自定义"]);
    expect(screen.queryByText("A4 210×297mm")).not.toBeInTheDocument();
    expect(selectOptions("覆膜")).toEqual(["无", "亮膜", "哑膜"]);
    expect(screen.getByLabelText("覆膜")).toHaveValue("亮膜");
    expect(screen.getByLabelText("圆角")).toHaveValue("圆角");
    expect(selectOptions("圆角")).toEqual(["无", "圆角"]);
    expect(selectOptions("烫金")).toEqual(["无", "烫金"]);
    expect(selectOptions("UV")).toEqual(["无", "UV"]);
    expect(screen.queryByLabelText("工艺")).not.toBeInTheDocument();
    expect(screen.getByLabelText("其他工艺")).toHaveValue("");
    expect(screen.getByLabelText("其他工艺")).toHaveAttribute("placeholder", "无");

    chooseSelectOption("材质", "自定义");
    fireEvent.change(screen.getByLabelText("自定义材质"), { target: { value: "自定义环保纸" } });
    expect(screen.getByDisplayValue("自定义环保纸")).toBeInTheDocument();
    chooseSelectOption("圆角", "圆角");
    expect(screen.getByLabelText("圆角")).toHaveValue("圆角");
    fireEvent.change(screen.getByLabelText("其他工艺"), { target: { value: "异形圆角" } });
    expect(screen.getByDisplayValue("异形圆角")).toBeInTheDocument();
  });

  it("defaults grouped finish fields to none for a new source project", async () => {
    render(<FactoriesPage factories={[factory]} factoryProjects={[]} quotes={[]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    await addCategory("名片");
    await addProject("名片", "普通名片");

    expect(screen.getByLabelText("覆膜")).toHaveValue("无");
    expect(screen.getByLabelText("圆角")).toHaveValue("无");
    expect(screen.getByLabelText("烫金")).toHaveValue("无");
    expect(screen.getByLabelText("UV")).toHaveValue("无");
    expect(screen.getByLabelText("其他工艺")).toHaveValue("");
    expect(screen.getByLabelText("其他工艺")).toHaveAttribute("placeholder", "无");
  });

  it("switches dropdown options by left project and saves a custom size price", async () => {
    const onChanged = vi.fn();
    const savedQuote: SourceQuote = { ...quote, id: "quote-custom-size", size: "100×60mm", quantity: 500, productionCostCents: 5200 };
    vi.mocked(api.createSourceQuote).mockResolvedValue(savedQuote);
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={onChanged} />);

    await addDraftProject("不干胶");
    expect(await screen.findByRole("heading", { name: "不干胶" })).toBeInTheDocument();
    expect(selectOptions("材质")).toEqual(expect.arrayContaining(["铜版不干胶", "透明不干胶", "PVC不干胶", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(["50×30mm", "60×40mm", "70×50mm", "A4 210×297mm", "自定义"]);
    expect(selectOptions("覆膜")).toEqual(["无", "亮膜", "哑膜"]);
    expect(selectOptions("模切")).toEqual(["无", "模切", "异形模切"]);
    expect(screen.queryByLabelText("工艺")).not.toBeInTheDocument();

    fireEvent.click(subProjectButton("普通名片"));
    expect(selectOptions("尺寸")).toEqual(["90×54mm", "90×50mm", "180×54mm", "110×90mm", "140×100mm", "160×54mm", "自定义"]);
    chooseSelectOption("尺寸", "自定义");
    expect(screen.getByLabelText("自定义尺寸")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("自定义尺寸长"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("自定义尺寸宽"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: /500 张/ }));
    fireEvent.change(screen.getByLabelText("厂家整批价"), { target: { value: "52" } });
    fireEvent.click(screen.getByRole("button", { name: "保存新价格" }));

    await waitFor(() => expect(api.createSourceQuote).toHaveBeenCalledWith(expect.objectContaining({
      factoryId: factory.id,
      itemName: "普通名片",
      size: "100×60mm",
      quantity: 500,
      productionCostCents: 5200,
    })));
    expect(onChanged).toHaveBeenCalled();
  });

  it("opens photo-print subgroups with indoor, outdoor, and mounting presets", async () => {
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    await addCategory("写真");
    await addProject("写真", "室内写真");
    await addProject("写真", "室外写真");
    await addProject("写真", "写真裱板");
    expect(subProjectButton("室内写真")).toBeInTheDocument();
    expect(subProjectButton("室外写真")).toBeInTheDocument();
    expect(subProjectButton("写真裱板")).toBeInTheDocument();

    fireEvent.click(subProjectButton("室外写真"));

    expect(screen.getByRole("heading", { name: "室外写真" })).toBeInTheDocument();
    expect(selectOptions("材质/产品种类")).toEqual(expect.arrayContaining([
      "户外pp背胶",
      "白胶车贴",
      "黑胶车贴",
      "灰胶可移车贴",
      "黑胶可移车贴",
      "白胶可移车贴",
      "透明车贴",
      "磁性车贴面磁",
      "户外晶彩格反光贴",
      "户外平面反光贴",
      "户外PVC硬片",
      "户外单透",
      "户外PP合成纸",
      "户外灯片",
      "自定义",
    ]));
    expect(selectOptions("覆膜工艺")).toEqual(["不覆膜", "亮膜", "哑膜", "磨砂地板膜", "斜纹地板膜", "自定义"]);
    expect(selectOptions("尺寸")).toEqual(expect.arrayContaining(["自定义宽高", "60×90cm", "120×240cm", "自定义"]));
    expect(selectOptions("裁切")).toEqual(["不裁切", "裁单张", "异型裁切（不拼大张裁小块）"]);
    expect(selectOptions("打扣")).toEqual(["无", "打扣"]);
    expect(screen.getByRole("button", { name: /1 块/ })).toBeInTheDocument();

    chooseSelectOption("尺寸", "自定义");
    fireEvent.change(screen.getByLabelText("自定义尺寸长"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("自定义尺寸宽"), { target: { value: "80" } });
    expect(screen.getByLabelText("尺寸")).toHaveValue("自定义");
    expect(screen.getByText(/120×80cm/)).toBeInTheDocument();

    fireEvent.click(subProjectButton("室内写真"));
    expect(selectOptions("材质/产品种类")).toEqual(expect.arrayContaining(["室内PP背胶", "室内相纸", "室内灯片", "油画布", "KT板写真", "自定义"]));

    fireEvent.click(subProjectButton("写真裱板"));
    expect(selectOptions("材质/产品种类")).toEqual(expect.arrayContaining(["KT板写真", "冷裱板写真", "PVC板写真", "雪弗板写真", "自定义"]));
  });

  it("removes a wrongly added draft project before any quote is saved", async () => {
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    await addCategory("错的类目");

    expect(categoryButton("错的类目")).toBeInTheDocument();
    fireEvent.contextMenu(categoryButton("错的类目"), { clientX: 120, clientY: 160 });
    fireEvent.click(await screen.findByRole("menuitem", { name: "删除大类" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "错的类目" })).not.toBeInTheDocument());
  });

  it("adds a fan project and immediately uses fan-specific print presets", async () => {
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    await addDraftProject("扇子");

    expect(await findSubProjectButton("扇子")).toHaveClass("active");
    expect(await screen.findByRole("heading", { name: "扇子" })).toBeInTheDocument();
    expect(selectOptions("材质")).toEqual(expect.arrayContaining(["PP塑料", "PVC", "竹柄纸扇", "无纺布", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(["17×17cm", "19×19cm", "21×21cm", "七寸", "八寸", "自定义"]);
    expect(selectOptions("模切")).toEqual(["无", "模切", "异形模切"]);
    expect(selectOptions("装柄")).toEqual(["无", "装柄"]);
    expect(selectOptions("覆膜")).toEqual(["无", "亮膜", "哑膜"]);
    expect(selectOptions("烫金")).toEqual(["无", "烫金"]);
    expect(screen.queryByLabelText("工艺")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /500 把/ })).toBeInTheDocument();
    expect(datalistOptions(screen.getByLabelText("数量"))).toEqual(["500", "1000", "2000", "3000", "5000", "10000"]);
  });

  it("maps alias project names like delivery forms to carbonless form presets", async () => {
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    await addDraftProject("送货单");

    expect(await findSubProjectButton("联单")).toHaveClass("active");
    expect(await screen.findByRole("heading", { name: "联单" })).toBeInTheDocument();
    expect(selectOptions("印刷")).toEqual(expect.arrayContaining(["不换版（单面单黑）", "换版（客服报价）", "自定义"]));
    expect(selectOptions("纸张")).toEqual(expect.arrayContaining(["2联（50组/本）", "3联（30组/本）", "5联（20组/本）", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(expect.arrayContaining(["210×290mm", "210×145mm", "190×85mm", "自定义"]));
    expect(screen.getByRole("button", { name: "白粉" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "白粉蓝黄绿" })).toBeInTheDocument();
    expect(selectOptions("打码")).toEqual(["无", "打单联号(下单备注打几号/颜色)"]);
    expect(selectOptions("裹皮")).toEqual(["无", "加裹皮"]);
    expect(selectOptions("垫板")).toEqual(["无", "加垫片"]);
    expect(screen.getByRole("button", { name: /100 本/ })).toBeInTheDocument();
  });

  it("adds booklet subprojects with dedicated and budget booklet standards", async () => {
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    await addCategory("画册");
    await addProject("画册", "专版画册");
    await addProject("画册", "特惠画册");
    fireEvent.click(subProjectButton("专版画册"));

    expect(await findSubProjectButton("专版画册")).toHaveClass("active");
    expect(selectOptions("封面纸张")).toEqual(expect.arrayContaining(["铜版纸", "高档铜版纸", "米白双胶纸", "珠光纸", "自定义"]));
    expect(selectOptions("封面克重")).toEqual(expect.arrayContaining(["250g", "300g", "200g", "157g", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(expect.arrayContaining(["大度16开(285×210)A4", "正度16开(260×185)", "大度32开(210×140)A5", "正度8开(370×260)", "自定义"]));
    expect(screen.getByRole("button", { name: "竖版" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "横版" })).toBeInTheDocument();
    expect(selectOptions("内页P数")).toEqual(expect.arrayContaining(["4P", "16P", "32P", "96P"]));
    expect(selectOptions("内页纸张")).toEqual(expect.arrayContaining(["铜版纸", "高档哑粉纸", "轻涂纸"]));
    expect(selectOptions("内页克重")).toEqual(expect.arrayContaining(["80g", "157g", "350g"]));
    expect(selectOptions("装订方式")).toEqual(expect.arrayContaining(["骑马钉", "无线胶装", "锁线胶装", "硬壳精装", "铁圈装"]));
    expect(screen.getByRole("button", { name: /500 本/ })).toBeInTheDocument();

    fireEvent.click(subProjectButton("特惠画册"));

    expect(selectOptions("封面材质")).toEqual(expect.arrayContaining(["双铜250克", "双铜300克", "双铜157克", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(expect.arrayContaining(["210×285mm（16开）", "140×210mm（32开）", "自定义"]));
    expect(selectOptions("内页材质")).toEqual(["双铜157克", "双铜200克"]);
    expect(selectOptions("内页P数")).toEqual(expect.arrayContaining(["4P", "16P", "32P"]));
    expect(selectOptions("装订方式")).toEqual(["骑马装订", "无线胶装"]);
    expect(selectOptions("封面覆膜")).toEqual(["无", "封面覆膜"]);
  });
});
