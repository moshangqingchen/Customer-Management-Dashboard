import { useMemo, useState } from "react";
import { Box, Plus, ReceiptText, Trash2, Truck } from "lucide-react";

import { api } from "../lib/api";
import { formatCents } from "../lib/format";
import {
  canonicalPrintProjectName,
  childPrintProjectNames,
  defaultPrintProjectForCategory,
  defaultPrintProjectName,
  fallbackPrintPreset,
  matchingPrintPresetValue,
  printCategoryName,
  printProjectSuggestions,
  printPresetForProject,
  printSpecValue,
  printTopLevelCategories,
  uniquePrintValues,
} from "../lib/printPresets";
import type { AddressInput, Customer, NewOrder, Order, OrderItemInput, SourceQuote } from "../lib/types";
import { Button } from "./ui";

const emptySourceSnapshot = {
  sourceQuoteId: null,
  sourceFactoryId: null,
  sourceFactoryName: "",
  sourceQuoteSummary: "",
  sourceProductionCostCents: 0,
  sourceShippingCostCents: 0,
};

const emptyItem = (): OrderItemInput => ({ itemType: "设计", name: "", quantity: 1, unitPriceCents: 0, printSpec: null, ...emptySourceSnapshot });
const customTemplateStorageKey = "startup-customer-workbench.order-item-templates";

type PrintSpecPart = "size" | "material" | "sides" | "color" | "finish";
type OrderItemTemplate = {
  label: string;
  description: string;
  item: OrderItemInput;
};

const orderItemTemplates: OrderItemTemplate[] = [
  {
    label: "淘宝主图设计",
    description: "1 张 / ¥80",
    item: {
      itemType: "设计",
      name: "淘宝主图",
      quantity: 1,
      unitPriceCents: 8_000,
      printSpec: "淘宝主图 800×800px | 平台图 | 彩色 | 精修 / 排版",
      ...emptySourceSnapshot,
    },
  },
  {
    label: "名片印刷",
    description: "1000 张 / ¥100",
    item: {
      itemType: "印刷品",
      name: "普通名片",
      quantity: 1000,
      unitPriceCents: 10,
      printSpec: "90×54毫米 | 铜版纸 300g | 双面 | 彩色 | 覆膜 / 圆角",
      ...emptySourceSnapshot,
    },
  },
  {
    label: "扇子印刷",
    description: "500 把 / ¥900",
    item: {
      itemType: "印刷品",
      name: "扇子",
      quantity: 500,
      unitPriceCents: 180,
      printSpec: "19×19cm | PP塑料 0.5mm | 双面 | 彩色 | 异形模切 / 装柄",
      ...emptySourceSnapshot,
    },
  },
  {
    label: "无碳联单",
    description: "50 本 / ¥325",
    item: {
      itemType: "印刷品",
      name: "无碳联单",
      quantity: 50,
      unitPriceCents: 650,
      printSpec: "A5 148×210mm | 无碳复写纸 三联 | 单面 | 黑白 | 胶头 / 打码",
      ...emptySourceSnapshot,
    },
  },
  {
    label: "易拉宝",
    description: "1 套 / ¥98",
    item: {
      itemType: "印刷品",
      name: "易拉宝",
      quantity: 1,
      unitPriceCents: 9_800,
      printSpec: "80×200cm | PVC画面 + 铝合金架 | 单面 | 彩色 | 含架 / 纸箱包装",
      ...emptySourceSnapshot,
    },
  },
];

const designProjectPresets = [
  "海报",
  "易拉宝",
  "淘宝主图",
  "淘宝详情页",
  "淘宝长图",
  "美团菜品图",
  "美团头图",
  "小红书封面",
  "小红书图文",
  "朋友圈海报",
  "公众号封面",
  "名片",
  "菜单",
  "宣传单",
  "门头招牌",
  "展板",
  "优惠券",
  "包装贴纸",
  "Logo",
  "品牌视觉套装",
];

const printProjectPresets = printProjectSuggestions;

const sizePresetGroups = {
  poster: ["A4 210×297mm", "A3 297×420mm", "A2 420×594mm", "A1 594×841mm", "海报 50×70cm", "海报 60×90cm"],
  businessCard: ["名片 90×54mm", "名片 90×50mm"],
  rollup: ["易拉宝 80×200cm", "易拉宝 85×200cm"],
  flyer: ["宣传单 A5 148×210mm", "宣传单 A4 210×297mm", "A5 148×210mm", "A4 210×297mm"],
  folded: ["三折页 A4 210×297mm", "二折页 A4 210×297mm", "折页 A3 297×420mm"],
  board: ["展板 60×80cm", "展板 80×120cm", "展板 120×240cm", "门头招牌 自定义宽高"],
  menu: ["菜单 A4 210×297mm", "菜单 A3 297×420mm", "菜单 210×210mm", "菜单 140×210mm"],
  sticker: ["贴纸 50×50mm", "贴纸 60×40mm", "标签 70×30mm", "不干胶 自定义宽高"],
  booklet: ["画册 A4 210×297mm", "画册 A5 148×210mm", "方形画册 210×210mm"],
  banner: ["横幅 70×300cm", "横幅 80×400cm", "横幅 自定义宽高"],
  coupon: ["优惠券 90×50mm", "门票 210×70mm", "台卡 100×150mm", "PVC卡 85.5×54mm"],
  taobaoMain: ["淘宝主图 800×800px", "淘宝主图 1000×1000px", "淘宝白底图 800×800px"],
  taobaoDetail: ["淘宝详情页 750px 宽", "淘宝详情页 790px 宽", "淘宝详情长图 750×1200px"],
  taobaoLong: ["淘宝长图 750×1000px", "淘宝长图 750×1200px"],
  xiaohongshu: ["小红书封面 1080×1440px", "小红书方图 1080×1080px", "小红书横图 1440×1080px"],
  meituanDish: ["美团菜品图 600×450px", "美团商品图 800×600px"],
  meituanDisplay: ["美团头图 800×600px", "美团店铺海报 720×240px", "美团展示图 600×450px"],
  douyin: ["抖音封面 1080×1920px", "抖音方图 1080×1080px"],
  wechatMoment: ["朋友圈海报 1080×1920px", "朋友圈方图 1080×1080px"],
  wechatOfficial: ["公众号首图 900×383px", "公众号次图 500×500px", "公众号封面 900×383px"],
};

const designStarterSizePresets = [
  ...sizePresetGroups.taobaoMain,
  ...sizePresetGroups.xiaohongshu.slice(0, 2),
  ...sizePresetGroups.poster.slice(0, 3),
  ...sizePresetGroups.meituanDish.slice(0, 1),
];

const printStarterSizePresets = [
  "A4 210×297mm",
  "A3 297×420mm",
  ...sizePresetGroups.businessCard,
  ...sizePresetGroups.rollup,
  "海报 50×70cm",
];

function unique(values: string[]) {
  return uniquePrintValues(values);
}

function printQuantityOrDefault(projectName: string, quantity: number) {
  const quantities = printPresetForProject(projectName).quantities;
  return quantities.includes(quantity) ? quantity : quantities[0] ?? 1;
}

function isPrintItem(itemType: string) {
  return itemType === "印刷品" || ["打印", "印刷", "写真", "展具"].includes(itemType);
}

function itemTypeToUiType(itemType: string) {
  return isPrintItem(itemType) ? "印刷品" : "设计";
}

function projectPresets(itemType: string) {
  if (isPrintItem(itemType)) return printProjectPresets;
  return designProjectPresets;
}

function hasAny(value: string, keywords: string[]) {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function physicalSizePresets(name: string) {
  if (hasAny(name, ["名片"])) return sizePresetGroups.businessCard;
  if (hasAny(name, ["易拉宝"])) return sizePresetGroups.rollup;
  if (hasAny(name, ["宣传单", "单页", "传单"])) return sizePresetGroups.flyer;
  if (hasAny(name, ["折页"])) return sizePresetGroups.folded;
  if (hasAny(name, ["展板", "门头", "招牌"])) return sizePresetGroups.board;
  if (hasAny(name, ["菜单"])) return sizePresetGroups.menu;
  if (hasAny(name, ["贴纸", "标签", "不干胶", "包装"])) return sizePresetGroups.sticker;
  if (hasAny(name, ["画册"])) return sizePresetGroups.booklet;
  if (hasAny(name, ["横幅"])) return sizePresetGroups.banner;
  if (hasAny(name, ["优惠券", "门票", "台卡", "PVC"])) return sizePresetGroups.coupon;
  if (hasAny(name, ["海报", "poster"])) return sizePresetGroups.poster;
  return [];
}

function designSizePresets(name: string) {
  if (hasAny(name, ["淘宝主图", "主图", "白底图"])) return sizePresetGroups.taobaoMain;
  if (hasAny(name, ["淘宝详情", "详情页"])) return sizePresetGroups.taobaoDetail;
  if (hasAny(name, ["淘宝长图", "长图"])) return sizePresetGroups.taobaoLong;
  if (hasAny(name, ["淘宝"])) return unique([...sizePresetGroups.taobaoMain, ...sizePresetGroups.taobaoDetail, ...sizePresetGroups.taobaoLong]);
  if (hasAny(name, ["美团菜品", "菜品图", "外卖菜品"])) return sizePresetGroups.meituanDish;
  if (hasAny(name, ["美团", "外卖展示"])) return sizePresetGroups.meituanDisplay;
  if (hasAny(name, ["小红书", "笔记封面"])) return sizePresetGroups.xiaohongshu;
  if (hasAny(name, ["朋友圈"])) return sizePresetGroups.wechatMoment;
  if (hasAny(name, ["公众号"])) return sizePresetGroups.wechatOfficial;
  if (hasAny(name, ["抖音"])) return sizePresetGroups.douyin;
  return physicalSizePresets(name);
}

function printSizePresets(name: string) {
  return printPresetForProject(name).sizes;
}

function sizePresets(itemType: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return isPrintItem(itemType) ? unique(printStarterSizePresets) : unique(designStarterSizePresets);
  const matched = isPrintItem(itemType) ? printSizePresets(trimmed) : designSizePresets(trimmed);
  if (matched.length) return unique(matched);
  return unique(isPrintItem(itemType) ? printStarterSizePresets : designStarterSizePresets);
}

function parsePrintSpec(value?: string | null): Record<PrintSpecPart, string> {
  const [size = "", material = "", sides = "", color = "", ...finish] = (value ?? "")
    .split("|")
    .map((part) => part.trim());
  return { size, material, sides, color, finish: finish.join(" | ") };
}

function buildPrintSpec(parts: Record<PrintSpecPart, string>) {
  const value = [parts.size, parts.material, parts.sides, parts.color, parts.finish]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" | ");
  return value || null;
}

function specValue(value?: string | number | null) {
  return printSpecValue(value);
}

function finishSpecValue(value?: string | number | null) {
  const normalized = specValue(value);
  return normalized === specValue("不选工艺") ? "" : normalized;
}

function buildPrintMaterial(material: string, paperWeight: string) {
  return [material, paperWeight].filter(Boolean).join(" ");
}

function defaultPrintSpec(projectName: string) {
  const preset = printPresetForProject(projectName);
  const canonicalProjectName = canonicalPrintProjectName(projectName);
  return buildPrintSpec({
    size: preset.sizes[0] ?? "",
    material: buildPrintMaterial(preset.materials[0] ?? "", preset.paperWeights[0] ?? ""),
    sides: ["联单", "易拉宝"].includes(canonicalProjectName) ? "单面" : "双面",
    color: canonicalProjectName === "联单" ? "黑白" : "彩色",
    finish: "",
  });
}

function matchingPresetValue(value: string, options: string[]) {
  return matchingPrintPresetValue(value, options);
}

function printMaterialValue(projectName: string, materialSpec: string) {
  const preset = printPresetForProject(projectName);
  return matchingPresetValue(materialSpec, preset.materials) || preset.materials[0] || "";
}

function printPaperWeightValue(projectName: string, materialSpec: string) {
  const preset = printPresetForProject(projectName);
  return matchingPresetValue(materialSpec, preset.paperWeights) || preset.paperWeights[0] || "";
}

function sourceQuoteSnapshot(quote: SourceQuote) {
  return {
    sourceQuoteId: quote.id,
    sourceFactoryId: quote.factoryId,
    sourceFactoryName: quote.factoryName,
    sourceQuoteSummary: quoteSummary(quote),
    sourceProductionCostCents: quote.productionCostCents,
    sourceShippingCostCents: quote.shippingCostCents,
  };
}

function sourceQuoteToItemPatch(quote: SourceQuote): Partial<OrderItemInput> {
  return {
    itemType: "印刷品",
    name: canonicalPrintProjectName(quote.itemName),
    quantity: quote.quantity,
    printSpec: buildPrintSpec({
      size: quote.size,
      material: quoteMaterial(quote),
      sides: quote.sides,
      color: quote.color,
      finish: quote.finish,
    }),
    ...sourceQuoteSnapshot(quote),
  };
}

function sourceQuoteCategoryMatches(quote: SourceQuote, item: OrderItemInput) {
  return canonicalPrintProjectName(quote.itemName) === canonicalPrintProjectName(item.name);
}

function sourceQuoteFullSpecMatches(quote: SourceQuote, item: OrderItemInput) {
  const spec = parsePrintSpec(item.printSpec);
  const material = specValue(spec.material);
  return (
    sourceQuoteCategoryMatches(quote, item) &&
    quote.quantity === item.quantity &&
    specValue(quote.size) === specValue(spec.size) &&
    (!quote.material || material.includes(specValue(quote.material))) &&
    (!quote.paperWeight || material.includes(specValue(quote.paperWeight))) &&
    specValue(quote.sides) === specValue(spec.sides) &&
    specValue(quote.color) === specValue(spec.color) &&
    finishSpecValue(quote.finish) === finishSpecValue(spec.finish)
  );
}

function findAutoSourceQuote(sourceQuotes: SourceQuote[], item: OrderItemInput) {
  if (!isPrintItem(item.itemType) || !item.name.trim() || item.quantity <= 0) return undefined;
  const sameProjectAndQuantity = sourceQuotes.filter((quote) =>
    sourceQuoteCategoryMatches(quote, item) && quote.quantity === item.quantity
  );
  return sameProjectAndQuantity.find((quote) => sourceQuoteFullSpecMatches(quote, item));
}

function withAutoSourceQuote(item: OrderItemInput, sourceQuotes: SourceQuote[]) {
  const quote = findAutoSourceQuote(sourceQuotes, item);
  return quote ? { ...item, ...sourceQuoteSnapshot(quote) } : { ...item, ...emptySourceSnapshot };
}

function sourceQuoteOptionsForItem(sourceQuotes: SourceQuote[], item: OrderItemInput) {
  if (!isPrintItem(item.itemType) || !item.name.trim()) return sourceQuotes;
  const related = sourceQuotes.filter((quote) => sourceQuoteCategoryMatches(quote, item));
  return related.length ? related : sourceQuotes;
}

function quoteMaterial(quote: SourceQuote) {
  return [quote.material, quote.paperWeight].filter(Boolean).join(" ");
}

function quoteSummary(quote: SourceQuote) {
  return [quote.itemName, String(quote.quantity), quote.size, quoteMaterial(quote), quote.sides, quote.color, quote.finish]
    .filter(Boolean)
    .join(" / ");
}

function quoteOptionLabel(quote: SourceQuote) {
  return `${quote.factoryName} · ${quote.itemName} · ${quote.quantity} · ${formatCents(quote.productionCostCents)} + 运费 ${formatCents(quote.shippingCostCents)}`;
}

function copyOrderItem(item: OrderItemInput): OrderItemInput {
  return {
    itemType: item.itemType,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    printSpec: item.printSpec ?? null,
    sourceQuoteId: item.sourceQuoteId ?? null,
    sourceFactoryId: item.sourceFactoryId ?? null,
    sourceFactoryName: item.sourceFactoryName ?? "",
    sourceQuoteSummary: item.sourceQuoteSummary ?? "",
    sourceProductionCostCents: item.sourceProductionCostCents ?? 0,
    sourceShippingCostCents: item.sourceShippingCostCents ?? 0,
  };
}

function templateDescription(item: OrderItemInput) {
  const unit = isPrintItem(item.itemType) ? printPresetForProject(item.name).quantityUnit : "项";
  return `${item.quantity} ${unit} / ${formatCents(orderItemTotalCents(item))}`;
}

function readCustomTemplates(): OrderItemTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(customTemplateStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((template): template is OrderItemTemplate =>
        Boolean(template?.label && template?.item?.name && template?.item?.itemType)
      )
      .map((template) => ({
        label: String(template.label),
        description: String(template.description || templateDescription(template.item)),
        item: copyOrderItem(template.item),
      }));
  } catch {
    return [];
  }
}

function writeCustomTemplates(templates: OrderItemTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(customTemplateStorageKey, JSON.stringify(templates));
}

function orderItemSourceCost(item: OrderItemInput) {
  return item.sourceProductionCostCents + item.sourceShippingCostCents;
}

function orderItemTotalCents(item: OrderItemInput) {
  return item.quantity * item.unitPriceCents;
}

function unitPriceCentsFromTotal(totalCents: number, quantity: number) {
  if (quantity <= 0) return 0;
  return Math.round(totalCents / quantity);
}

function totalCentsFromPriceInput(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function suggestedSaleTotalCents(item: OrderItemInput) {
  const sourceCost = orderItemSourceCost(item);
  if (sourceCost <= 0) return 0;
  const margin = Math.max(2_000, Math.ceil(sourceCost * 0.45));
  return Math.ceil((sourceCost + margin) / 100) * 100;
}

function suggestedSaleUnitCents(item: OrderItemInput) {
  if (item.quantity <= 0) return 0;
  return Math.ceil(suggestedSaleTotalCents(item) / item.quantity);
}

function totalPriceValue(item: OrderItemInput) {
  return (orderItemTotalCents(item) / 100).toString();
}

function addressLabel(address: AddressInput) {
  return `${address.label || "地址"} | ${address.recipient || "未填收件人"} | ${address.phone || "未填电话"} | ${address.address || "未填详细地址"}`;
}

function findAddressChoice(customer: Customer | undefined, address?: AddressInput | null) {
  if (!customer || !address) return "";
  const index = customer.addresses.findIndex((item) =>
    item.label === address.label &&
    item.recipient === address.recipient &&
    item.phone === address.phone &&
    item.address === address.address);
  return index >= 0 ? String(index) : "custom";
}

function orderToInput(order: Order): NewOrder {
  return {
    customerId: order.customerId,
    platform: order.platform,
    platformAccount: order.platformAccount,
    externalOrderNo: order.externalOrderNo,
    designStatus: order.designStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    designDueAt: order.designDueAt,
    deliveryDueAt: order.deliveryDueAt,
    notes: order.notes,
    tags: order.tags,
    items: order.items.map((item) => ({
      itemType: itemTypeToUiType(item.itemType),
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      printSpec: item.printSpec,
      sourceQuoteId: item.sourceQuoteId,
      sourceFactoryId: item.sourceFactoryId,
      sourceFactoryName: item.sourceFactoryName,
      sourceQuoteSummary: item.sourceQuoteSummary,
      sourceProductionCostCents: item.sourceProductionCostCents,
      sourceShippingCostCents: item.sourceShippingCostCents,
    })),
    shipmentCompany: order.shipmentCompany,
    shipmentTrackingNo: order.shipmentTrackingNo,
    shippingAddress: order.shippingAddress,
  };
}

export function OrderForm({ customers, sourceQuotes = [], order, onSaved, onCancel }: { customers: Customer[]; sourceQuotes?: SourceQuote[]; order?: Order; onSaved: (savedOrder: Order) => void; onCancel: () => void }) {
  const initialCustomer = customers.find((customer) => customer.id === order?.customerId) ?? customers[0];
  const initialAddress = order?.shippingAddress ?? initialCustomer?.addresses[0] ?? null;
  const initialOrderInput: NewOrder = order ? orderToInput(order) : {
    customerId: initialCustomer?.id ?? "",
    platform: initialCustomer?.platformIdentities[0]?.platform ?? "微信",
    platformAccount: initialCustomer?.platformIdentities[0]?.handle ?? "",
    externalOrderNo: "",
    designStatus: "待设计",
    fulfillmentStatus: "待处理",
    designDueAt: null,
    deliveryDueAt: null,
    notes: "",
    tags: [],
    items: [emptyItem()],
    shipmentCompany: "",
    shipmentTrackingNo: "",
    shippingAddress: initialAddress,
  };
  const [form, setForm] = useState<NewOrder>(initialOrderInput);
  const [tags, setTags] = useState(form.tags.join("，"));
  const [addressChoice, setAddressChoice] = useState(findAddressChoice(initialCustomer, initialAddress));
  const [customTemplates, setCustomTemplates] = useState<OrderItemTemplate[]>(readCustomTemplates);
  const [totalPriceDrafts, setTotalPriceDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const total = useMemo(() => form.items.reduce((sum, item) => sum + orderItemTotalCents(item), 0), [form.items]);
  const sourceCost = useMemo(() => form.items.reduce((sum, item) => sum + item.sourceProductionCostCents + item.sourceShippingCostCents, 0), [form.items]);
  const selectedCustomer = customers.find((customer) => customer.id === form.customerId);
  const templates = useMemo(() => [...orderItemTemplates, ...customTemplates], [customTemplates]);

  const setItem = (index: number, patch: Partial<OrderItemInput>, options: { autoMatchSource?: boolean } = {}) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const nextItem = { ...item, ...patch };
        return options.autoMatchSource ? withAutoSourceQuote(nextItem, sourceQuotes) : nextItem;
      }),
    }));

  const clearTotalPriceDraft = (index: number) =>
    setTotalPriceDrafts((current) => {
      if (!(index in current)) return current;
      const next = { ...current };
      delete next[index];
      return next;
    });

  const applySourceQuote = (index: number, quoteId: string, currentTotalCents = 0) => {
    const quote = sourceQuotes.find((item) => item.id === quoteId);
    if (!quote) {
      setItem(index, emptySourceSnapshot);
      return;
    }
    setItem(index, {
      ...sourceQuoteToItemPatch(quote),
      unitPriceCents: unitPriceCentsFromTotal(currentTotalCents, quote.quantity),
    });
  };

  const applyTemplate = (template: OrderItemTemplate) => {
    const nextItem = copyOrderItem(template.item);
    setForm((current) => {
      const blankIndex = current.items.findIndex((item) =>
        !item.name.trim() &&
        item.unitPriceCents === 0 &&
        item.quantity === 1 &&
        !item.printSpec &&
        !item.sourceQuoteId
      );
      if (blankIndex >= 0) {
        return { ...current, items: current.items.map((item, index) => index === blankIndex ? nextItem : item) };
      }
      return { ...current, items: [...current.items, nextItem] };
    });
  };

  const saveCurrentItemAsTemplate = () => {
    const sourceItem = form.items.find((item) => item.name.trim()) ?? form.items[0];
    if (!sourceItem?.name.trim()) {
      setError("先填写一个订单项目，再保存为模板");
      return;
    }
    const label = window.prompt("模板名称", sourceItem.name.trim())?.trim();
    if (!label) return;
    const template: OrderItemTemplate = {
      label,
      description: templateDescription(sourceItem),
      item: copyOrderItem(sourceItem),
    };
    const nextTemplates = [template, ...customTemplates.filter((item) => item.label !== label)].slice(0, 12);
    setCustomTemplates(nextTemplates);
    writeCustomTemplates(nextTemplates);
    setError("");
  };

  const selectCustomer = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    const nextAddress = customer?.addresses[0] ?? null;
    setAddressChoice(nextAddress ? "0" : "");
    setForm({
      ...form,
      customerId,
      platform: customer?.platformIdentities[0]?.platform ?? "微信",
      platformAccount: customer?.platformIdentities[0]?.handle ?? "",
      shippingAddress: nextAddress,
    });
  };

  const selectAddress = (value: string) => {
    setAddressChoice(value);
    if (value === "") {
      setForm({ ...form, shippingAddress: null });
      return;
    }
    if (value === "custom") return;
    const address = selectedCustomer?.addresses[Number(value)] ?? null;
    setForm({ ...form, shippingAddress: address });
  };

  const submit = async () => {
    if (!form.customerId) return setError("请先选择客户");
    if (form.items.some((item) => !item.name.trim() || item.quantity <= 0)) return setError("请完整填写订单项目");
    setSaving(true);
    setError("");
    try {
      const input = { ...form, tags: tags.split(/[,，;；]/).map((tag) => tag.trim()).filter(Boolean) };
      const savedOrder = order ? await api.updateOrder(order.id, input) : await api.createOrder(input);
      onSaved(savedOrder);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-stack">
      <section className="form-section">
        <div className="section-title"><ReceiptText size={18} /><div><h3>订单信息</h3><p>保存成功后会自动创建客户和订单文件夹</p></div></div>
        <div className="form-grid three">
          <label><span>客户 *</span><select value={form.customerId} onChange={(event) => selectCustomer(event.target.value)}><option value="">请选择客户</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label>
          <label><span>来源平台</span><select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}>{["微信", "闲鱼", "淘宝", "小红书", "抖音", "其他"].map((platform) => <option key={platform}>{platform}</option>)}</select></label>
          <label><span>平台网名</span><input value={form.platformAccount} onChange={(event) => setForm({ ...form, platformAccount: event.target.value })} /></label>
        </div>
        <div className="form-grid three">
          <label><span>平台订单号</span><input value={form.externalOrderNo} onChange={(event) => setForm({ ...form, externalOrderNo: event.target.value })} placeholder="没有可留空" /></label>
          <label><span>设计截止</span><input type="date" value={form.designDueAt ?? ""} onChange={(event) => setForm({ ...form, designDueAt: event.target.value || null })} /></label>
          <label><span>交付截止</span><input type="date" value={form.deliveryDueAt ?? ""} onChange={(event) => setForm({ ...form, deliveryDueAt: event.target.value || null })} /></label>
        </div>
        <div className="form-grid three">
          <label><span>设计进度</span><select value={form.designStatus} onChange={(event) => setForm({ ...form, designStatus: event.target.value })}>{["无需设计", "待设计", "设计中", "待确认", "设计完成"].map((status) => <option key={status}>{status}</option>)}</select></label>
          <label><span>履约进度</span><select value={form.fulfillmentStatus} onChange={(event) => setForm({ ...form, fulfillmentStatus: event.target.value })}>{["待处理", "待发货", "已发货", "已签收", "已取消"].map((status) => <option key={status}>{status}</option>)}</select></label>
          <label><span>标签</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="加急，打印" /></label>
        </div>
      </section>

      <section className="form-section">
        <div className="section-title-row">
          <div className="section-title"><Box size={18} /><div><h3>计价明细</h3><p>设计与印刷品分开录入，印刷品按类目带出规格标准</p></div></div>
          <Button variant="ghost" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}><Plus size={16} />添加项目</Button>
        </div>
        <div className="template-strip" aria-label="订单模板">
          <span>常用模板</span>
          {templates.map((template) => (
            <button type="button" key={template.label} onClick={() => applyTemplate(template)}>
              <b>{template.label}</b>
              <small>{template.description}</small>
            </button>
          ))}
          <button type="button" className="save-template-button" onClick={saveCurrentItemAsTemplate}>
            <b>保存为模板</b>
            <small>复用当前明细</small>
          </button>
        </div>
        <div className="item-list">
          {form.items.map((item, index) => {
            const spec = parsePrintSpec(item.printSpec);
            const setSpec = (part: PrintSpecPart, value: string) => setItem(index, { printSpec: buildPrintSpec({ ...spec, [part]: value }) }, { autoMatchSource: true });
            const projectListId = `project-presets-${index}`;
            const sizeListId = `size-presets-${index}`;
            const quantityListId = `order-quantity-presets-${index}`;
            const uiItemType = itemTypeToUiType(item.itemType);
            const isPrint = uiItemType === "印刷品";
            const printCategory = isPrint ? printCategoryName(item.name) : "";
            const printProject = isPrint ? canonicalPrintProjectName(item.name) : "";
            const printProjectOptions = isPrint ? childPrintProjectNames(printCategory) : [];
            const printPreset = isPrint ? printPresetForProject(printProject) : fallbackPrintPreset;
            const projectOptions = projectPresets(uiItemType);
            const sizeOptions = isPrint ? printPreset.sizes : sizePresets(uiItemType, item.name);
            const quantityOptions = isPrint ? printPreset.quantities : [1, 2, 3, 5, 10];
            const quantityUnit = isPrint ? printPreset.quantityUnit : "项";
            const materialValue = isPrint ? printMaterialValue(printProject, spec.material) : "";
            const paperWeightValue = isPrint ? printPaperWeightValue(printProject, spec.material) : "";
            const suggestedTotal = suggestedSaleTotalCents(item);
            const quoteOptions = sourceQuoteOptionsForItem(sourceQuotes, item);
            const customQuantityOption = isPrint && item.quantity > 0 && !quantityOptions.includes(item.quantity);
            const totalPriceDraft = totalPriceDrafts[index];
            const totalPriceInputValue = totalPriceDraft ?? totalPriceValue(item);
            const currentTotalPriceCents = () => totalPriceDraft === undefined ? orderItemTotalCents(item) : totalCentsFromPriceInput(totalPriceDraft);
            const switchItemType = (value: string) => {
              if (value === "印刷品") {
                const projectName = canonicalPrintProjectName(item.name || defaultPrintProjectName);
                const quantity = printQuantityOrDefault(projectName, item.quantity);
                setItem(index, {
                  itemType: "印刷品",
                  name: projectName,
                  quantity,
                  unitPriceCents: unitPriceCentsFromTotal(currentTotalPriceCents(), quantity),
                  printSpec: defaultPrintSpec(projectName),
                  ...emptySourceSnapshot,
                }, { autoMatchSource: true });
                return;
              }
              setItem(index, { itemType: "设计", name: isPrint ? "" : item.name, printSpec: null, ...emptySourceSnapshot });
            };
            const selectPrintCategory = (category: string) => {
              selectPrintProject(defaultPrintProjectForCategory(category));
            };
            const selectPrintProject = (projectName: string) => {
              const canonicalProject = canonicalPrintProjectName(projectName);
              const quantity = printQuantityOrDefault(canonicalProject, item.quantity);
              setItem(index, {
                itemType: "印刷品",
                name: canonicalProject,
                quantity,
                unitPriceCents: unitPriceCentsFromTotal(currentTotalPriceCents(), quantity),
                printSpec: defaultPrintSpec(canonicalProject),
                ...emptySourceSnapshot,
              }, { autoMatchSource: true });
            };
            const setPrintMaterialSpec = (material: string, paperWeight: string) => setSpec("material", buildPrintMaterial(material, paperWeight));
            const customSizeOption = spec.size && !sizeOptions.includes(spec.size);
            const customFinishOption = spec.finish && !printPreset.finishes.includes(spec.finish);
            const setQuantity = (quantity: number, autoMatchSource = false) => {
              setItem(index, {
                quantity,
                unitPriceCents: unitPriceCentsFromTotal(currentTotalPriceCents(), quantity),
              }, { autoMatchSource });
            };
            const setTotalPrice = (value: string) => {
              setTotalPriceDrafts((current) => ({ ...current, [index]: value }));
              const totalCents = totalCentsFromPriceInput(value);
              setItem(index, { unitPriceCents: unitPriceCentsFromTotal(totalCents, item.quantity) });
            };
            const setSourceShipping = (value: string) => {
              const amount = Number(value);
              setItem(index, { sourceShippingCostCents: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0 });
            };
            return (
              <div className="item-editor" key={index}>
                <div className="item-row">
                  <select aria-label="项目类型" value={uiItemType} onChange={(event) => switchItemType(event.target.value)}>
                    <option>设计</option>
                    <option>印刷品</option>
                  </select>
                  {isPrint ? (
                    <>
                      <select aria-label="印刷类目" value={printCategory} onChange={(event) => selectPrintCategory(event.target.value)}>
                        {printTopLevelCategories.map((option) => <option value={option} key={option}>{option}</option>)}
                      </select>
                      <select aria-label="印刷小类" value={printProject} onChange={(event) => selectPrintProject(event.target.value)}>
                        {printProjectOptions.map((option) => <option value={option} key={option}>{option}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <input className="item-name-field" aria-label="项目名称" list={projectListId} value={item.name} onChange={(event) => setItem(index, { name: event.target.value, printSpec: null, ...emptySourceSnapshot })} placeholder="订单名，如 Logo / 淘宝主图" />
                      <datalist id={projectListId}>{projectOptions.map((option) => <option value={option} key={option}>{option}</option>)}</datalist>
                    </>
                  )}
                  <strong>{formatCents(orderItemTotalCents(item))}</strong>
                  <button className="icon-button danger" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={16} /></button>
                </div>
                {isPrint ? (
                  <div className="print-spec-grid order-print-spec-grid">
                    <label><span>张数</span><div className="quantity-input spec-quantity-input">
                      <select value={String(item.quantity)} onChange={(event) => setQuantity(Number(event.target.value), true)} aria-label="数量">
                        {customQuantityOption && <option value={item.quantity}>{item.quantity}</option>}
                        {quantityOptions.map((option) => <option value={option} key={option}>{option}</option>)}
                      </select>
                      <span>{quantityUnit}</span>
                    </div></label>
                    <label><span>个人报价</span><div className="money-input"><span>¥</span><input type="number" min="0" step="0.01" value={totalPriceInputValue} onChange={(event) => setTotalPrice(event.target.value)} onBlur={() => clearTotalPriceDraft(index)} aria-label="个人报价" /></div></label>
                    <label><span>尺寸</span><select aria-label="尺寸" value={spec.size} onChange={(event) => setSpec("size", event.target.value)}>
                      <option value="">未选择</option>
                      {customSizeOption && <option value={spec.size}>{spec.size}</option>}
                      {sizeOptions.map((option) => <option value={option} key={option}>{option}</option>)}
                    </select></label>
                    <label><span>{printPreset.materialLabel ?? "纸张/材质"}</span><select value={materialValue} onChange={(event) => setPrintMaterialSpec(event.target.value, paperWeightValue)}>
                      {printPreset.materials.map((option) => <option value={option} key={option}>{option}</option>)}
                    </select></label>
                    <label><span>{printPreset.paperWeightLabel ?? "克重/厚度"}</span><select value={paperWeightValue} onChange={(event) => setPrintMaterialSpec(materialValue, event.target.value)}>
                      {printPreset.paperWeights.map((option) => <option value={option} key={option}>{option}</option>)}
                    </select></label>
                    <label><span>单双面</span><select value={spec.sides} onChange={(event) => setSpec("sides", event.target.value)}><option value="">未选择</option><option>单面</option><option>双面</option></select></label>
                    <label><span>颜色</span><select value={spec.color} onChange={(event) => setSpec("color", event.target.value)}><option value="">未选择</option><option>彩色</option><option>黑白</option><option>专色</option></select></label>
                    <label><span>工艺</span><select value={spec.finish} onChange={(event) => setSpec("finish", event.target.value)}>
                      <option value="">不选工艺</option>
                      {customFinishOption && <option value={spec.finish}>{spec.finish}</option>}
                      {printPreset.finishes.filter((option) => option !== "不选工艺").map((option) => <option value={option} key={option}>{option}</option>)}
                    </select></label>
                    <label className="source-quote-field"><span>源头厂家报价</span><select value={item.sourceQuoteId ?? ""} onChange={(event) => applySourceQuote(index, event.target.value, currentTotalPriceCents())}>
                      <option value="">不选择厂家报价</option>
                      {quoteOptions.map((quote) => <option value={quote.id} key={quote.id}>{quoteOptionLabel(quote)}</option>)}
                    </select></label>
                    {item.sourceFactoryName && (
                      <div className="source-cost-preview source-cost-preview-inline">
                        <b>{item.sourceFactoryName}</b>
                        <span>{item.sourceQuoteSummary || "已保存厂家报价快照"}</span>
                        <div className="source-cost-breakdown">
                          <strong>生产 {formatCents(item.sourceProductionCostCents)}</strong>
                          <label><span>运费</span><div className="money-input source-shipping-input"><span>¥</span><input type="number" min="0" step="0.01" value={(item.sourceShippingCostCents / 100).toString()} onChange={(event) => setSourceShipping(event.target.value)} aria-label="源头运费" /></div></label>
                          <strong>合计 {formatCents(orderItemSourceCost(item))}</strong>
                        </div>
                        {suggestedTotal > 0 && <button type="button" onClick={() => { clearTotalPriceDraft(index); setItem(index, { unitPriceCents: suggestedSaleUnitCents(item) }); }}>套用建议售价 {formatCents(orderItemTotalCents({ ...item, unitPriceCents: suggestedSaleUnitCents(item) }))}</button>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="print-spec-grid design-spec-grid">
                    <label><span>数量</span><div className="quantity-input spec-quantity-input">
                      <input type="number" min="1" list={quantityListId} value={item.quantity} onChange={(event) => setQuantity(Number(event.target.value))} aria-label="数量" />
                      <span>{quantityUnit}</span>
                    </div></label>
                    <datalist id={quantityListId}>{quantityOptions.map((option) => <option value={option} key={option}>{option}</option>)}</datalist>
                    <label><span>个人报价</span><div className="money-input"><span>¥</span><input type="number" min="0" step="0.01" value={totalPriceInputValue} onChange={(event) => setTotalPrice(event.target.value)} onBlur={() => clearTotalPriceDraft(index)} aria-label="个人报价" /></div></label>
                    <label><span>尺寸</span><input aria-label="尺寸" list={sizeListId} value={spec.size} onChange={(event) => setSpec("size", event.target.value)} placeholder="可选预设，也可自定义" /></label>
                    <datalist id={sizeListId}>{sizeOptions.map((option) => <option value={option} key={option}>{option}</option>)}</datalist>
                    <label><span>备注</span><input value={spec.finish} onChange={(event) => setSpec("finish", event.target.value)} placeholder="平台、比例、特别要求" /></label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="order-total"><span>厂家成本 {formatCents(sourceCost)}</span><span>预估毛利 {formatCents(total - sourceCost)}</span><strong>{formatCents(total)}</strong></div>
      </section>

      <section className="form-section">
        <div className="section-title"><Truck size={18} /><div><h3>物流与备注</h3><p>可稍后在订单详情中补充</p></div></div>
        <div className="form-grid three">
          <label><span>收货地址</span><select value={addressChoice} onChange={(event) => selectAddress(event.target.value)}>
            <option value="">不选择地址</option>
            {selectedCustomer?.addresses.map((address, index) => <option value={String(index)} key={`${address.label}-${index}`}>{addressLabel(address)}</option>)}
            {form.shippingAddress && addressChoice === "custom" && <option value="custom">{addressLabel(form.shippingAddress)}</option>}
          </select></label>
          <label><span>快递公司</span><input value={form.shipmentCompany} onChange={(event) => setForm({ ...form, shipmentCompany: event.target.value })} /></label>
          <label><span>快递单号</span><input value={form.shipmentTrackingNo} onChange={(event) => setForm({ ...form, shipmentTrackingNo: event.target.value })} /></label>
        </div>
        {form.shippingAddress && <div className="address-preview"><strong>{form.shippingAddress.recipient || "未填收件人"} {form.shippingAddress.phone}</strong><span>{form.shippingAddress.address}</span></div>}
        <label><span>订单备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="制作要求、沟通记录、特别注意事项…" /></label>
      </section>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions"><Button variant="secondary" onClick={onCancel}>取消</Button><Button onClick={submit} disabled={saving}>{saving ? "保存中…" : order ? "保存订单修改" : "创建订单并生成文件夹"}</Button></div>
    </div>
  );
}
