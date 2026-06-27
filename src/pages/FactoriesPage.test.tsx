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
  finish: "覆膜 / 圆角",
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
  itemName: "宣传单",
  quantity: 2000,
  size: "A4 210×297mm",
  material: "铜版纸",
  paperWeight: "157g",
  finish: "折页",
  productionCostCents: 16800,
  shippingCostCents: 1200,
  updatedAt: "2026-06-05T00:00:00Z",
};

const defaultFactoryProjects: SourceFactoryProject[] = [
  { id: "project-card-category", factoryId: factory.id, categoryName: "名片", projectName: "", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
  { id: "project-card-normal", factoryId: factory.id, categoryName: "名片", projectName: "普通名片", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
  { id: "project-flyer-category", factoryId: factory.id, categoryName: "宣传单", projectName: "", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
  { id: "project-flyer", factoryId: factory.id, categoryName: "宣传单", projectName: "宣传单", createdAt: "2026-06-06T00:00:00Z", updatedAt: "2026-06-06T00:00:00Z" },
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
  return Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((option) => option.textContent).filter(Boolean);
}

function chooseSelectOption(label: string, text: string) {
  const select = screen.getByLabelText(label) as HTMLSelectElement;
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
  fireEvent.click(await screen.findByRole("button", { name: `添加${categoryName}小类` }));
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
    vi.mocked(api.createSourceFactory).mockReset();
    vi.mocked(api.updateSourceFactory).mockReset();
    vi.mocked(api.createSourceQuote).mockReset();
    vi.mocked(api.updateSourceQuote).mockReset();
    vi.mocked(api.deleteSourceQuote).mockReset();
    vi.mocked(api.deleteSourceFactory).mockReset();
    vi.mocked(api.createSourceFactoryProject).mockReset();
    vi.mocked(api.deleteSourceFactoryProject).mockReset();
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

  it("saves the factory QQ number with the factory profile", async () => {
    const onChanged = vi.fn();
    vi.mocked(api.createSourceFactory).mockResolvedValue({ ...factory, id: "factory-new", qq: "123456789" });
    render(<FactoriesPage factories={[]} quotes={[]} onSelect={vi.fn()} onChanged={onChanged} />);

    fireEvent.click(screen.getAllByRole("button", { name: "添加厂家" })[0]);
    fireEvent.change(screen.getByLabelText("厂家名称 *"), { target: { value: "博博印务" } });
    fireEvent.change(screen.getByLabelText("联系人"), { target: { value: "陈经理" } });
    fireEvent.change(screen.getByLabelText("电话"), { target: { value: "13800138000" } });
    fireEvent.change(screen.getByLabelText("微信"), { target: { value: "bobo-print" } });
    fireEvent.change(screen.getByLabelText("QQ号"), { target: { value: "123456789" } });
    const submitButtons = screen.getAllByRole("button", { name: "添加厂家" });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(api.createSourceFactory).toHaveBeenCalledWith(expect.objectContaining({
      name: "博博印务",
      contactName: "陈经理",
      phone: "13800138000",
      wechat: "bobo-print",
      qq: "123456789",
    })));
    expect(onChanged).toHaveBeenCalled();
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
    expect(subProjectButton("宣传单")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "不干胶" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "写真" })).not.toBeInTheDocument();

    fireEvent.click(subProjectButton("宣传单"));

    expect(screen.getByLabelText("规格价格详情")).toBeInTheDocument();
    expect(screen.queryByLabelText("项目类型")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("项目名称 *")).not.toBeInTheDocument();
    expect(screen.getByLabelText("尺寸")).toHaveValue("A4 210×297mm");
    expect(selectOptions("工艺")).toEqual(expect.arrayContaining(["不选工艺", "折页", "压痕", "裁切", "自定义"]));
    expect(selectOptions("工艺")).not.toEqual(expect.arrayContaining(["圆角", "覆膜 / 圆角"]));
    expect(screen.getByRole("button", { name: /2000 张/ })).toHaveTextContent("¥168.00");
  });

  it("does not prefill project presets for a new factory workspace", async () => {
    render(<FactoriesPage factories={[factory]} factoryProjects={[]} quotes={[]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    expect(screen.getByText("还没有项目")).toBeInTheDocument();
    expect(screen.getByText("先添加项目")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "名片" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "宣传单" })).not.toBeInTheDocument();

    await addCategory("名片");

    expect(categoryButton("名片")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "普通名片" })).not.toBeInTheDocument();
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
    fireEvent.click(await findSubProjectButton("宣传单"));

    expect(screen.getByRole("heading", { name: "宣传单" })).toBeInTheDocument();
    expect(screen.getByLabelText("数量")).toHaveValue(200);
    expect(screen.getByLabelText("厂家整批价")).toHaveValue(45);
  });

  it("offers quantity, finish, and project-specific material/size presets", () => {
    renderFactories([quote]);

    fireEvent.click(screen.getByRole("button", { name: "进入华彩印刷源头厂" }));

    expect(datalistOptions(screen.getByLabelText("数量"))).toEqual(expect.arrayContaining(["500", "1000", "5000"]));
    expect(selectOptions("材质")).toEqual(expect.arrayContaining(["铜版纸", "哑粉纸", "白卡纸", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(["90×54毫米", "90×50毫米", "180×54毫米", "110×90毫米", "140×100毫米", "160×54毫米", "自定义"]);
    expect(screen.queryByText("A4 210×297mm")).not.toBeInTheDocument();
    expect(selectOptions("工艺")).toEqual(expect.arrayContaining(["不选工艺", "覆膜", "圆角", "覆膜 / 圆角", "烫金", "UV", "自定义"]));
    expect(selectOptions("工艺")).not.toEqual(expect.arrayContaining(["折页", "骑马钉", "胶装"]));

    chooseSelectOption("材质", "自定义");
    fireEvent.change(screen.getByLabelText("自定义材质"), { target: { value: "自定义环保纸" } });
    expect(screen.getByDisplayValue("自定义环保纸")).toBeInTheDocument();
    chooseSelectOption("工艺", "圆角");
    expect(screen.getByLabelText("工艺")).toHaveValue("圆角");
    chooseSelectOption("工艺", "自定义");
    fireEvent.change(screen.getByLabelText("自定义工艺"), { target: { value: "异形圆角" } });
    expect(screen.getByDisplayValue("异形圆角")).toBeInTheDocument();
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
    expect(selectOptions("工艺")).toEqual(expect.arrayContaining(["模切", "异形模切", "覆膜 / 模切", "自定义"]));
    expect(selectOptions("工艺")).not.toEqual(expect.arrayContaining(["圆角", "覆膜 / 圆角"]));

    fireEvent.click(subProjectButton("普通名片"));
    expect(selectOptions("尺寸")).toEqual(["90×54毫米", "90×50毫米", "180×54毫米", "110×90毫米", "140×100毫米", "160×54毫米", "自定义"]);
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
    expect(selectOptions("工艺")).toEqual(expect.arrayContaining(["不裁切", "裁单张", "异型裁切（不拼大张裁小块）", "打扣", "自定义"]));
    expect(screen.getByRole("button", { name: /1 块/ })).toBeInTheDocument();

    chooseSelectOption("尺寸", "自定义");
    fireEvent.change(screen.getByLabelText("自定义尺寸长"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("自定义尺寸宽"), { target: { value: "80" } });
    expect(screen.getByLabelText("尺寸")).toHaveValue("__custom_size__");

    fireEvent.click(subProjectButton("室内写真"));
    expect(selectOptions("材质/产品种类")).toEqual(expect.arrayContaining(["室内PP背胶", "室内相纸", "室内灯片", "油画布", "KT板写真", "自定义"]));

    fireEvent.click(subProjectButton("写真裱板"));
    expect(selectOptions("材质/产品种类")).toEqual(expect.arrayContaining(["KT板写真", "冷裱板写真", "PVC板写真", "雪弗板写真", "自定义"]));
  });

  it("removes a wrongly added draft project before any quote is saved", async () => {
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    await addCategory("错的类目");

    expect(categoryButton("错的类目")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除错的类目" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "错的类目" })).not.toBeInTheDocument());
  });

  it("adds a fan project and immediately uses fan-specific print presets", async () => {
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    await addDraftProject("扇子");

    expect(await findSubProjectButton("扇子")).toHaveClass("active");
    expect(await screen.findByRole("heading", { name: "扇子" })).toBeInTheDocument();
    expect(selectOptions("材质")).toEqual(expect.arrayContaining(["PP塑料", "PVC", "竹柄纸扇", "无纺布", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(["17×17cm", "19×19cm", "21×21cm", "七寸", "八寸", "自定义"]);
    expect(selectOptions("工艺")).toEqual(expect.arrayContaining(["不选工艺", "装柄", "异形模切", "烫金", "自定义"]));
    expect(screen.getByRole("button", { name: /500 把/ })).toBeInTheDocument();
    expect(datalistOptions(screen.getByLabelText("数量"))).toEqual(["500", "1000", "2000", "3000", "5000", "10000"]);
  });

  it("maps alias project names like delivery forms to carbonless form presets", async () => {
    render(<FactoriesPage factories={[factory]} quotes={[quote]} selectedFactoryId={factory.id} onSelect={vi.fn()} onChanged={vi.fn()} />);

    await addDraftProject("送货单");

    expect(await findSubProjectButton("联单")).toHaveClass("active");
    expect(await screen.findByRole("heading", { name: "联单" })).toBeInTheDocument();
    expect(selectOptions("材质")).toEqual(expect.arrayContaining(["无碳复写纸", "双胶纸", "收据纸", "自定义"]));
    expect(selectOptions("克重/厚度")).toEqual(expect.arrayContaining(["二联", "三联", "四联", "100组/本", "自定义"]));
    expect(selectOptions("尺寸")).toEqual(expect.arrayContaining(["大32开 130×190mm", "A5 148×210mm", "A4 210×297mm", "自定义"]));
    expect(selectOptions("工艺")).toEqual(expect.arrayContaining(["不选工艺", "胶头", "包本", "打码", "撕线", "自定义"]));
    expect(screen.getByRole("button", { name: /500 本/ })).toBeInTheDocument();
  });
});
