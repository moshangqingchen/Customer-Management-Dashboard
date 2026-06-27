import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderForm } from "./OrderForm";
import { api } from "../lib/api";
import type { Customer, Order, SourceQuote } from "../lib/types";

const customer: Customer = {
  id: "customer-lin",
  name: "林女士",
  phone: "13800138000",
  wechat: "lin-design",
  vipLevel: 4,
  notes: "",
  tags: [],
  platformIdentities: [{ platform: "微信", handle: "林女士微信", account: "lin-design" }],
  addresses: [
    { label: "公司", recipient: "林女士", phone: "13800138000", address: "上海市浦东新区创意路 18 号" },
    { label: "家里", recipient: "林女士", phone: "13800138000", address: "上海市黄浦区复购路 88 号" },
  ],
  qrCodePath: null,
  orderCount: 0,
  totalSpentCents: 0,
  createdAt: "2026-06-06T00:00:00Z",
  updatedAt: "2026-06-06T00:00:00Z",
};

const createdOrder: Order = {
  id: "order-created",
  customerId: customer.id,
  customerName: customer.name,
  customerPhone: customer.phone,
  customerWechat: customer.wechat,
  customerVipLevel: customer.vipLevel,
  platform: "微信",
  platformAccount: "林女士微信",
  externalOrderNo: "WX-NEW-001",
  designStatus: "待设计",
  fulfillmentStatus: "待处理",
  designDueAt: null,
  deliveryDueAt: null,
  notes: "",
  tags: [],
  items: [{ id: "item-created", orderId: "order-created", itemType: "设计", name: "Logo", quantity: 1, unitPriceCents: 0, printSpec: null, sourceQuoteId: null, sourceFactoryId: null, sourceFactoryName: "", sourceQuoteSummary: "", sourceProductionCostCents: 0, sourceShippingCostCents: 0 }],
  payments: [],
  totalCents: 0,
  receivedCents: 0,
  paymentStatus: "未收",
  shipmentCompany: "",
  shipmentTrackingNo: "",
  shippingAddress: customer.addresses[0],
  folderPath: "D:\\客户文件库\\林女士\\订单\\WX-NEW-001",
  folderState: "ready",
  createdAt: "2026-06-06T00:00:00Z",
  updatedAt: "2026-06-06T00:00:00Z",
};

const sourceQuote: SourceQuote = {
  id: "quote-card",
  factoryId: "factory-huacai",
  factoryName: "华彩印刷源头厂",
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

const flyerSourceQuote: SourceQuote = {
  id: "quote-flyer-500",
  factoryId: "factory-huacai",
  factoryName: "华彩印刷源头厂",
  itemType: "印刷",
  itemName: "合版宣传单",
  quantity: 500,
  size: "16开210×285mm",
  material: "铜版纸",
  paperWeight: "行标157g",
  sides: "双面",
  color: "彩色",
  finish: "",
  productionCostCents: 7000,
  shippingCostCents: 1000,
  leadTime: "2 天",
  notes: "",
  createdAt: "2026-06-06T00:00:00Z",
  updatedAt: "2026-06-06T00:00:00Z",
};

function datalistOptions(input: HTMLElement) {
  const listId = input.getAttribute("list");
  expect(listId).toBeTruthy();
  return Array.from(document.querySelectorAll<HTMLOptionElement>(`#${listId} option`)).map((option) => option.value);
}

function selectOptions(select: Element) {
  const searchableOptions = select.getAttribute("data-options");
  if (searchableOptions !== null) return searchableOptions.split("\n").filter(Boolean);
  return Array.from(select.querySelectorAll<HTMLOptionElement>("option")).map((option) => option.value || option.textContent);
}

describe("OrderForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("offers saved customer addresses when creating an order", () => {
    render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText("收货地址")).toHaveDisplayValue(
      "公司 | 林女士 | 13800138000 | 上海市浦东新区创意路 18 号",
    );
  });

  it("shows a size field for print order items", () => {
    const { container } = render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    expect(selectOptions(itemTypeSelect!)).toEqual(["设计", "印刷品"]);
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });

    expect(screen.getByLabelText("印刷类目")).toHaveDisplayValue("名片");
    expect(screen.getByLabelText("印刷小类")).toHaveDisplayValue("普通名片");
    expect(screen.getByLabelText("尺寸")).toBeInTheDocument();
  });

  it("offers common design project names and platform size presets", () => {
    render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const projectName = screen.getByLabelText("项目名称");
    fireEvent.change(projectName, { target: { value: "淘宝主图" } });

    expect(datalistOptions(projectName)).toEqual(expect.arrayContaining(["海报", "易拉宝", "淘宝主图", "名片"]));
    expect(screen.getByLabelText("尺寸")).toBeInTheDocument();
    expect(datalistOptions(screen.getByLabelText("尺寸"))).toEqual(expect.arrayContaining(["淘宝主图 800×800px", "淘宝白底图 800×800px"]));
  });

  it("offers print-related project names and paper size presets for print items", () => {
    const { container } = render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });
    const printCategory = screen.getByLabelText("印刷类目");
    fireEvent.change(printCategory, { target: { value: "海报" } });

    expect(selectOptions(printCategory)).toEqual(expect.arrayContaining(["海报", "名片", "易拉宝", "扇子", "联单", "写真"]));
    expect(selectOptions(screen.getByLabelText("尺寸"))).toEqual(expect.arrayContaining(["A3 297×420mm", "A4 210×297mm", "50×70cm"]));
  });

  it("filters design size presets by the selected project name", () => {
    render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const projectName = screen.getByLabelText("项目名称");
    const size = screen.getByLabelText("尺寸");

    fireEvent.change(projectName, { target: { value: "海报" } });
    let options = datalistOptions(size);
    expect(options).toEqual(expect.arrayContaining(["A3 297×420mm", "A4 210×297mm", "海报 50×70cm"]));
    expect(options).not.toEqual(expect.arrayContaining(["淘宝主图 800×800px", "名片 90×54mm", "美团菜品图 600×450px"]));

    fireEvent.change(projectName, { target: { value: "淘宝主图" } });
    options = datalistOptions(size);
    expect(options).toEqual(expect.arrayContaining(["淘宝主图 800×800px", "淘宝白底图 800×800px"]));
    expect(options).not.toEqual(expect.arrayContaining(["淘宝详情页 750px 宽", "A3 297×420mm", "美团菜品图 600×450px"]));
  });

  it("filters print size presets by the selected print project name", () => {
    const { container } = render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });

    const projectName = screen.getByLabelText("印刷类目");
    const size = screen.getByLabelText("尺寸");

    fireEvent.change(projectName, { target: { value: "名片" } });
    let options = selectOptions(size);
    expect(screen.getByLabelText("印刷小类")).toHaveDisplayValue("普通名片");
    expect(selectOptions(screen.getByLabelText("印刷小类"))).toEqual(["普通名片", "PVC卡", "特种纸名片"]);
    expect(options).toEqual(expect.arrayContaining(["90×54毫米", "90×50毫米", "180×54毫米", "110×90毫米", "140×100毫米", "160×54毫米"]));
    expect(options).not.toEqual(expect.arrayContaining(["A3 297×420mm", "淘宝主图 800×800px", "易拉宝 80×200cm"]));

    fireEvent.change(projectName, { target: { value: "海报" } });
    options = selectOptions(size);
    expect(options).toEqual(expect.arrayContaining(["A3 297×420mm", "A4 210×297mm", "60×90cm"]));
    expect(options).not.toEqual(expect.arrayContaining(["名片 90×54mm", "易拉宝 80×200cm", "淘宝主图 800×800px"]));
  });

  it("switches print standards when choosing fan and receipt categories", () => {
    const { container } = render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });

    const category = screen.getByLabelText("印刷类目");
    fireEvent.change(category, { target: { value: "扇子" } });

    expect(selectOptions(screen.getByLabelText("尺寸"))).toEqual(expect.arrayContaining(["17×17cm", "19×19cm"]));
    expect(selectOptions(screen.getByLabelText("纸张/材质"))).toEqual(expect.arrayContaining(["PP塑料", "竹柄纸扇"]));
    expect(selectOptions(screen.getByLabelText("厚度/规格"))).toEqual(expect.arrayContaining(["0.35mm", "0.5mm"]));
    expect(selectOptions(screen.getByLabelText("数量"))).toEqual(["500", "1000", "2000", "3000", "5000", "10000"]);

    fireEvent.change(category, { target: { value: "联单" } });

    expect(selectOptions(screen.getByLabelText("印刷"))).toEqual(expect.arrayContaining(["不换版（单面单黑）", "换版（客服报价）"]));
    expect(selectOptions(screen.getByLabelText("纸张"))).toEqual(expect.arrayContaining(["2联（50组/本）", "3联（30组/本）", "5联（20组/本）"]));
    expect(selectOptions(screen.getByLabelText("尺寸"))).toEqual(expect.arrayContaining(["210×290mm", "210×145mm", "190×85mm"]));
    expect(selectOptions(screen.getByLabelText("色序"))).toEqual(expect.arrayContaining(["白粉", "白黄", "白粉蓝黄绿"]));
    expect(selectOptions(screen.getByLabelText("打码"))).toEqual(["无", "打单联号(下单备注打几号/颜色)"]);
    expect(selectOptions(screen.getByLabelText("裹皮"))).toEqual(["无", "加裹皮"]);
    expect(selectOptions(screen.getByLabelText("垫板"))).toEqual(["无", "加垫片"]);
    expect(selectOptions(screen.getByLabelText("数量"))).toEqual(["100", "200", "300", "500", "1000"]);
  });

  it("switches photo-print standards between indoor, outdoor, and mounting subgroups", () => {
    const { container } = render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });

    fireEvent.change(screen.getByLabelText("印刷类目"), { target: { value: "写真" } });
    expect(screen.getByLabelText("印刷小类")).toHaveDisplayValue("室内写真");
    expect(selectOptions(screen.getByLabelText("印刷小类"))).toEqual(["室内写真", "室外写真", "写真裱板"]);
    expect(selectOptions(screen.getByLabelText("材质/产品种类"))).toEqual(expect.arrayContaining(["室内PP背胶", "室内相纸", "室内灯片", "油画布"]));
    expect(selectOptions(screen.getByLabelText("覆膜工艺"))).toEqual(expect.arrayContaining(["不覆膜", "亮膜", "哑膜", "磨砂地板膜", "斜纹地板膜"]));
    expect(selectOptions(screen.getByLabelText("数量"))).toEqual(["1", "2", "5", "10", "20", "50", "100"]);

    fireEvent.change(screen.getByLabelText("印刷小类"), { target: { value: "室外写真" } });

    expect(screen.getByLabelText("印刷小类")).toHaveDisplayValue("室外写真");
    expect(selectOptions(screen.getByLabelText("材质/产品种类"))).toEqual(expect.arrayContaining([
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
    ]));
    expect(selectOptions(screen.getByLabelText("尺寸"))).toEqual(expect.arrayContaining(["自定义宽高", "60×90cm", "120×240cm"]));

    fireEvent.change(screen.getByLabelText("印刷小类"), { target: { value: "写真裱板" } });
    expect(selectOptions(screen.getByLabelText("材质/产品种类"))).toEqual(expect.arrayContaining(["KT板写真", "冷裱板写真", "PVC板写真", "雪弗板写真"]));
  });

  it("switches booklet standards between dedicated and budget subgroups", () => {
    const { container } = render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });

    fireEvent.change(screen.getByLabelText("印刷类目"), { target: { value: "画册" } });
    expect(screen.getByLabelText("印刷小类")).toHaveDisplayValue("专版画册");
    expect(selectOptions(screen.getByLabelText("印刷小类"))).toEqual(["专版画册", "特惠画册"]);
    expect(selectOptions(screen.getByLabelText("尺寸"))).toEqual(expect.arrayContaining(["大度16开(285×210)A4", "正度16开(260×185)", "大度32开(210×140)A5"]));
    expect(selectOptions(screen.getByLabelText("封面纸张"))).toEqual(expect.arrayContaining(["铜版纸", "高档铜版纸", "珠光纸"]));
    expect(selectOptions(screen.getByLabelText("封面克重"))).toEqual(expect.arrayContaining(["250g", "300g", "157g"]));
    expect(selectOptions(screen.getByLabelText("内页P数"))).toEqual(expect.arrayContaining(["4P", "16P", "96P"]));
    expect(selectOptions(screen.getByLabelText("内页纸张"))).toEqual(expect.arrayContaining(["铜版纸", "高档哑粉纸", "轻涂纸"]));
    expect(selectOptions(screen.getByLabelText("装订方式"))).toEqual(expect.arrayContaining(["骑马钉", "无线胶装", "铁圈装"]));
    expect(selectOptions(screen.getByLabelText("数量"))).toEqual(["500", "1000", "2000", "3000", "5000"]);

    fireEvent.change(screen.getByLabelText("印刷小类"), { target: { value: "特惠画册" } });

    expect(selectOptions(screen.getByLabelText("尺寸"))).toEqual(expect.arrayContaining(["210×285mm（16开）", "140×210mm（32开）"]));
    expect(selectOptions(screen.getByLabelText("封面材质"))).toEqual(expect.arrayContaining(["双铜250克", "双铜300克", "双铜157克"]));
    expect(selectOptions(screen.getByLabelText("内页材质"))).toEqual(["双铜157克", "双铜200克"]);
    expect(selectOptions(screen.getByLabelText("装订方式"))).toEqual(["骑马装订", "无线胶装"]);
    expect(selectOptions(screen.getByLabelText("封面覆膜"))).toEqual(["无", "封面覆膜"]);
  });

  it("clears the previous size when the project name changes", () => {
    render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const projectName = screen.getByLabelText("项目名称");
    const size = screen.getByLabelText("尺寸");

    fireEvent.change(projectName, { target: { value: "海报" } });
    fireEvent.change(size, { target: { value: "A3 297×420mm" } });
    expect(size).toHaveDisplayValue("A3 297×420mm");

    fireEvent.change(projectName, { target: { value: "淘宝主图" } });

    expect(size).toHaveDisplayValue("");
  });

  it("applies a source factory quote without changing the customer sales unit price", () => {
    const { container } = render(<OrderForm customers={[customer]} sourceQuotes={[sourceQuote]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });
    fireEvent.change(screen.getByLabelText("源头厂家报价"), { target: { value: sourceQuote.id } });

    expect(screen.getByLabelText("项目类型")).toHaveDisplayValue("印刷品");
    expect(screen.getByLabelText("印刷类目")).toHaveDisplayValue("名片");
    expect(screen.getByLabelText("印刷小类")).toHaveDisplayValue("普通名片");
    expect(screen.getByLabelText("数量")).toHaveDisplayValue("1000");
    expect(screen.getByLabelText("个人报价")).toHaveDisplayValue("0");
    expect(screen.getByText("华彩印刷源头厂")).toBeInTheDocument();
    expect(screen.getByText("生产 ¥45.00")).toBeInTheDocument();
    expect(screen.getByLabelText("源头运费")).toHaveValue(8);
    expect(screen.getByText("合计 ¥53.00")).toBeInTheDocument();
  });

  it("allows adjusting source shipping for the current order item", () => {
    const { container } = render(<OrderForm customers={[customer]} sourceQuotes={[sourceQuote]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });
    fireEvent.change(screen.getByLabelText("源头厂家报价"), { target: { value: sourceQuote.id } });

    fireEvent.change(screen.getByLabelText("源头运费"), { target: { value: "15" } });

    expect(screen.getByLabelText("源头运费")).toHaveValue(15);
    expect(screen.getByText("合计 ¥60.00")).toBeInTheDocument();
    expect(screen.getByText("厂家成本 ¥60.00")).toBeInTheDocument();
  });

  it("auto-selects a matching source quote only when the print spec also matches", () => {
    const { container } = render(<OrderForm customers={[customer]} sourceQuotes={[flyerSourceQuote]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });
    fireEvent.change(screen.getByLabelText("印刷类目"), { target: { value: "宣传单" } });
    expect(screen.getByLabelText("印刷小类")).toHaveDisplayValue("合版宣传单");
    expect(selectOptions(screen.getByLabelText("纸张"))).toEqual(expect.arrayContaining(["铜版纸", "双胶纸"]));
    expect(selectOptions(screen.getByLabelText("克重"))).toEqual(expect.arrayContaining(["行标157g", "A级157g", "250g"]));
    fireEvent.focus(screen.getByLabelText("纸张"));
    fireEvent.change(screen.getByLabelText("纸张"), { target: { value: "双胶纸" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: "双胶纸" }));
    expect(selectOptions(screen.getByLabelText("克重"))).toEqual(["100g"]);
    fireEvent.focus(screen.getByLabelText("纸张"));
    fireEvent.change(screen.getByLabelText("纸张"), { target: { value: "铜版纸" } });
    fireEvent.mouseDown(screen.getByRole("option", { name: "铜版纸" }));
    fireEvent.change(screen.getByLabelText("数量"), { target: { value: "500" } });

    expect(screen.getByLabelText("源头厂家报价")).toHaveDisplayValue("华彩印刷源头厂 · 合版宣传单 · 500 · ¥70.00 + 运费 ¥10.00");
    expect(screen.getByText("合计 ¥80.00")).toBeInTheDocument();
  });

  it("auto-matches legacy combined flyer paper names after paper and weight are split", () => {
    const legacyFlyerQuote: SourceQuote = {
      ...flyerSourceQuote,
      id: "quote-flyer-legacy-paper",
      material: "行标157g铜版纸",
      paperWeight: "标准",
    };
    const { container } = render(<OrderForm customers={[customer]} sourceQuotes={[legacyFlyerQuote]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });
    fireEvent.change(screen.getByLabelText("印刷类目"), { target: { value: "宣传单" } });
    fireEvent.change(screen.getByLabelText("数量"), { target: { value: "500" } });

    expect(screen.getByLabelText("源头厂家报价")).toHaveDisplayValue("华彩印刷源头厂 · 合版宣传单 · 500 · ¥70.00 + 运费 ¥10.00");
  });

  it("auto-matches a legacy business-card quote under the new normal-card subgroup", () => {
    const legacyCardQuote: SourceQuote = {
      ...sourceQuote,
      id: "quote-legacy-card-500",
      itemName: "名片",
      quantity: 500,
      size: "90×54mm",
      paperWeight: "250g",
      finish: "",
    };
    const { container } = render(<OrderForm customers={[customer]} sourceQuotes={[legacyCardQuote]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });

    expect(screen.getByLabelText("印刷类目")).toHaveDisplayValue("名片");
    expect(screen.getByLabelText("印刷小类")).toHaveDisplayValue("普通名片");
    expect(screen.getByLabelText("源头厂家报价")).toHaveDisplayValue("华彩印刷源头厂 · 名片 · 500 · ¥45.00 + 运费 ¥8.00");
    expect(screen.getByText("合计 ¥53.00")).toBeInTheDocument();
  });

  it("does not auto-select a source quote when only category and quantity match", () => {
    const mismatchedFlyerQuote: SourceQuote = {
      ...flyerSourceQuote,
      id: "quote-flyer-500-a5",
      size: "A5 148×210mm",
      paperWeight: "200g",
    };
    const { container } = render(<OrderForm customers={[customer]} sourceQuotes={[mismatchedFlyerQuote]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });
    fireEvent.change(screen.getByLabelText("印刷类目"), { target: { value: "宣传单" } });
    fireEvent.change(screen.getByLabelText("数量"), { target: { value: "500" } });

    expect(screen.getByLabelText("源头厂家报价")).toHaveDisplayValue("不选择厂家报价");
    expect(screen.queryByText("成本 ¥80.00")).not.toBeInTheDocument();
  });

  it("treats the customer quote field as the item total instead of multiplying it by quantity", () => {
    const { container } = render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });
    fireEvent.change(screen.getByLabelText("数量"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("个人报价"), { target: { value: "200" } });

    expect(screen.getByLabelText("个人报价")).toHaveDisplayValue("200");
    expect(screen.getAllByText("¥200.00").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("¥200,000.00")).not.toBeInTheDocument();
  });

  it("allows the customer quote field to be cleared before typing a new total", () => {
    const { container } = render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });

    const customerQuote = screen.getByLabelText("个人报价");
    fireEvent.change(customerQuote, { target: { value: "" } });
    expect(customerQuote).toHaveDisplayValue("");

    fireEvent.change(customerQuote, { target: { value: "200" } });
    expect(customerQuote).toHaveDisplayValue("200");
    expect(screen.getAllByText("¥200.00").length).toBeGreaterThanOrEqual(2);
  });

  it("can apply a common order item template", () => {
    render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /扇子印刷/ }));

    expect(screen.getByLabelText("项目类型")).toHaveDisplayValue("印刷品");
    expect(screen.getByLabelText("印刷类目")).toHaveDisplayValue("扇子");
    expect(screen.getByLabelText("数量")).toHaveDisplayValue("500");
    expect(screen.getByLabelText("个人报价")).toHaveDisplayValue("900");
    expect(screen.getByLabelText("尺寸")).toHaveDisplayValue("19×19cm");
  });

  it("saves the current order item as a reusable local template", () => {
    vi.spyOn(window, "prompt").mockReturnValue("常用广告扇");
    const { unmount } = render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /扇子印刷/ }));
    fireEvent.click(screen.getByRole("button", { name: /保存为模板/ }));
    unmount();

    render(<OrderForm customers={[customer]} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /常用广告扇/ }));

    expect(screen.getByLabelText("印刷类目")).toHaveDisplayValue("扇子");
    expect(screen.getByLabelText("数量")).toHaveDisplayValue("500");
  });

  it("can apply a suggested sale price from a source factory quote", () => {
    const { container } = render(<OrderForm customers={[customer]} sourceQuotes={[sourceQuote]} onSaved={vi.fn()} onCancel={vi.fn()} />);

    const itemTypeSelect = container.querySelector(".item-row select");
    expect(itemTypeSelect).not.toBeNull();
    fireEvent.change(itemTypeSelect!, { target: { value: "印刷品" } });
    fireEvent.change(screen.getByLabelText("源头厂家报价"), { target: { value: sourceQuote.id } });
    fireEvent.click(screen.getByRole("button", { name: /套用建议售价/ }));

    expect(screen.getByLabelText("个人报价")).toHaveDisplayValue("80");
    expect(screen.getByText("预估毛利 ¥27.00")).toBeInTheDocument();
  });

  it("returns the created order after saving so it can be selected", async () => {
    vi.spyOn(api, "createOrder").mockResolvedValue(createdOrder);
    const onSaved = vi.fn();
    render(<OrderForm customers={[customer]} onSaved={onSaved} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("平台订单号"), { target: { value: "WX-NEW-001" } });
    fireEvent.change(screen.getByLabelText("项目名称"), { target: { value: "Logo" } });
    fireEvent.click(screen.getByRole("button", { name: "创建订单并生成文件夹" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(createdOrder));
  });
});
