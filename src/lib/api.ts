import { invoke } from "@tauri-apps/api/core";

import type {
  AppSettings,
  Customer,
  DashboardSummary,
  FileRecord,
  ImportCustomerRow,
  ImportResult,
  NewCustomer,
  NewOrder,
  Order,
  OrderItemInput,
  PaymentInput,
  SearchHit,
  SourceFactory,
  SourceFactoryInput,
  SourceFactoryProject,
  SourceFactoryProjectInput,
  SourceQuote,
  SourceQuoteInput,
  SpreadsheetPreview,
} from "./types";
import { isImageFile } from "./files";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const now = new Date().toISOString();
const emptySourceSnapshot = {
  sourceQuoteId: null,
  sourceFactoryId: null,
  sourceFactoryName: "",
  sourceQuoteSummary: "",
  sourceProductionCostCents: 0,
  sourceShippingCostCents: 0,
};

function normalizeSourceSnapshot(item: OrderItemInput) {
  return {
    sourceQuoteId: item.sourceQuoteId ?? null,
    sourceFactoryId: item.sourceFactoryId ?? null,
    sourceFactoryName: item.sourceFactoryName ?? "",
    sourceQuoteSummary: item.sourceQuoteSummary ?? "",
    sourceProductionCostCents: item.sourceProductionCostCents ?? 0,
    sourceShippingCostCents: item.sourceShippingCostCents ?? 0,
  };
}

function demoImageDataUrl(path: string) {
  const name = path.split(/[\\/]/).pop() ?? "图片";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#dff5ee"/><stop offset="1" stop-color="#fff0d4"/></linearGradient></defs><rect width="320" height="220" rx="26" fill="url(#g)"/><circle cx="74" cy="68" r="24" fill="#23a98f" opacity=".78"/><path d="M40 176l78-78 52 52 32-32 78 58z" fill="#8270c9" opacity=".58"/><text x="160" y="203" text-anchor="middle" font-family="Microsoft YaHei, Segoe UI, sans-serif" font-size="18" fill="#425154">${name}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

let demoCustomers: Customer[] = [
  {
    id: "customer-lin",
    name: "林女士",
    phone: "138 0013 8000",
    wechat: "lin_design",
    vipLevel: 5,
    notes: "偏好暖色、每月固定复购宣传物料",
    tags: ["复购", "高优先级"],
    platformIdentities: [
      { platform: "闲鱼", handle: "林林的创意店", account: "xy-lin" },
      { platform: "微信", handle: "林女士", account: "lin_design" },
    ],
    addresses: [{ label: "公司", recipient: "林女士", phone: "13800138000", address: "上海市浦东新区创意路 18 号" }],
    qrCodePath: null,
    orderCount: 12,
    totalSpentCents: 358_600,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "customer-studio",
    name: "星河工作室",
    phone: "186 8888 2200",
    wechat: "star_studio",
    vipLevel: 4,
    notes: "经常需要加急交付",
    tags: ["工作室", "设计"],
    platformIdentities: [{ platform: "小红书", handle: "星河视觉", account: "star-visual" }],
    addresses: [],
    qrCodePath: null,
    orderCount: 8,
    totalSpentCents: 219_900,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "customer-zhou",
    name: "周先生",
    phone: "139 5500 7821",
    wechat: "zhou-print",
    vipLevel: 2,
    notes: "打印完成后微信通知",
    tags: ["打印"],
    platformIdentities: [{ platform: "淘宝", handle: "周周办公", account: "tb-zhou" }],
    addresses: [],
    qrCodePath: null,
    orderCount: 4,
    totalSpentCents: 78_500,
    createdAt: now,
    updatedAt: now,
  },
];

let demoSourceFactories: SourceFactory[] = [
  {
    id: "factory-huacai",
    name: "华彩印刷源头厂",
    contactName: "陈经理",
    phone: "020-8888 6012",
    wechat: "huacai-print",
    qq: "285001234",
    address: "广州市白云区印刷产业园 8 栋",
    tags: ["名片", "单页", "铜版纸"],
    shippingNotes: "广东省内小件 8 元起，外省按件报价。",
    notes: "名片、宣传单交期稳定，适合常规彩印。",
    quoteCount: 2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "factory-display",
    name: "鑫展写真制作厂",
    contactName: "李工",
    phone: "0571-6688 0920",
    wechat: "xz-display",
    qq: "16880920",
    address: "杭州市余杭区广告材料市场 3 区",
    tags: ["写真", "易拉宝", "展板"],
    shippingNotes: "写真类按尺寸和包装计费，易拉宝默认纸箱发货。",
    notes: "户外背胶、KT 板、易拉宝出货快。",
    quoteCount: 2,
    createdAt: now,
    updatedAt: now,
  },
];

let demoSourceQuotes: SourceQuote[] = [
  {
    id: "quote-card-1000",
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
    notes: "常规盒装，适合普通商务名片。",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "quote-flyer-a4-200",
    factoryId: "factory-huacai",
    factoryName: "华彩印刷源头厂",
    itemType: "印刷",
    itemName: "A4 双面彩印",
    quantity: 200,
    size: "A4 210×297mm",
    material: "铜版纸",
    paperWeight: "157g",
    sides: "双面",
    color: "彩色",
    finish: "覆膜 / 裁切",
    productionCostCents: 18500,
    shippingCostCents: 1200,
    leadTime: "1-2 天",
    notes: "适合宣传单、小批量活动物料。",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "quote-photo-60x90",
    factoryId: "factory-display",
    factoryName: "鑫展写真制作厂",
    itemType: "写真",
    itemName: "写真裱板",
    quantity: 1,
    size: "60×90cm",
    material: "户外背胶 + KT 板",
    paperWeight: "",
    sides: "单面",
    color: "彩色",
    finish: "覆膜 / 裱板 / 裁切",
    productionCostCents: 3200,
    shippingCostCents: 1000,
    leadTime: "当天-1 天",
    notes: "建议同城或短途发货，避免折损。",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "quote-rollup-80x200",
    factoryId: "factory-display",
    factoryName: "鑫展写真制作厂",
    itemType: "展具",
    itemName: "易拉宝",
    quantity: 1,
    size: "80×200cm",
    material: "PVC 画面 + 铝合金架",
    paperWeight: "",
    sides: "单面",
    color: "彩色",
    finish: "含架 / 纸箱包装",
    productionCostCents: 5500,
    shippingCostCents: 1500,
    leadTime: "1-2 天",
    notes: "画面和架子一起发货。",
    createdAt: now,
    updatedAt: now,
  },
];

let demoSourceFactoryProjects: SourceFactoryProject[] = [];

function demoFactoriesWithCounts() {
  return demoSourceFactories.map((factory) => ({
    ...factory,
    quoteCount: demoSourceQuotes.filter((quote) => quote.factoryId === factory.id).length,
  }));
}

let demoOrders: Order[] = [
  {
    id: "order-001",
    customerId: "customer-lin",
    customerName: "林女士",
    customerPhone: "138 0013 8000",
    customerWechat: "lin_design",
    customerVipLevel: 5,
    platform: "闲鱼",
    platformAccount: "林林的创意店",
    externalOrderNo: "XY20260606001",
    designStatus: "设计中",
    fulfillmentStatus: "待处理",
    designDueAt: "2026-06-07",
    deliveryDueAt: "2026-06-09",
    notes: "夏季活动宣传单",
    tags: ["加急"],
    items: [
      { ...emptySourceSnapshot, id: "item-1", orderId: "order-001", itemType: "设计", name: "宣传单设计", quantity: 1, unitPriceCents: 12_000, printSpec: null },
      {
        id: "item-2",
        orderId: "order-001",
        itemType: "打印",
        name: "A4 双面彩印",
        quantity: 200,
        unitPriceCents: 85,
        printSpec: "A4 210×297mm | 铜版纸 157g | 双面 | 彩色 | 覆膜 / 裁切",
        sourceQuoteId: "quote-flyer-a4-200",
        sourceFactoryId: "factory-huacai",
        sourceFactoryName: "华彩印刷源头厂",
        sourceQuoteSummary: "A4 双面彩印 / 200 / A4 210×297mm / 铜版纸 157g / 覆膜 / 裁切",
        sourceProductionCostCents: 18500,
        sourceShippingCostCents: 1200,
      },
    ],
    payments: [],
    totalCents: 29_000,
    receivedCents: 10_000,
    paymentStatus: "部分收款",
    shipmentCompany: "",
    shipmentTrackingNo: "",
    shippingAddress: { label: "公司", recipient: "林女士", phone: "13800138000", address: "上海市浦东新区创意路 18 号" },
    folderPath: "D:\\创业客户文件库\\林女士_[customer]\\订单\\2026-06-06_XY20260606001_[order001]",
    folderState: "ready",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "order-002",
    customerId: "customer-studio",
    customerName: "星河工作室",
    customerPhone: "186 8888 2200",
    customerWechat: "star_studio",
    customerVipLevel: 4,
    platform: "小红书",
    platformAccount: "星河视觉",
    externalOrderNo: "XHS20260605003",
    designStatus: "设计完成",
    fulfillmentStatus: "待发货",
    designDueAt: "2026-06-06",
    deliveryDueAt: "2026-06-07",
    notes: "品牌手册与名片",
    tags: ["品牌设计"],
    items: [{ ...emptySourceSnapshot, id: "item-3", orderId: "order-002", itemType: "设计", name: "品牌视觉套装", quantity: 1, unitPriceCents: 58_000, printSpec: null }],
    payments: [],
    totalCents: 58_000,
    receivedCents: 58_000,
    paymentStatus: "已结清",
    shipmentCompany: "顺丰",
    shipmentTrackingNo: "SF123456789",
    shippingAddress: null,
    folderPath: "D:\\创业客户文件库\\星河工作室_[customer]\\订单\\2026-06-05_XHS20260605003_[order002]",
    folderState: "ready",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "order-003",
    customerId: "customer-zhou",
    customerName: "周先生",
    customerPhone: "139 5500 7821",
    customerWechat: "zhou-print",
    customerVipLevel: 2,
    platform: "淘宝",
    platformAccount: "周周办公",
    externalOrderNo: "TB20260604018",
    designStatus: "无需设计",
    fulfillmentStatus: "已发货",
    designDueAt: null,
    deliveryDueAt: "2026-06-08",
    notes: "文件按原稿打印",
    tags: ["打印"],
    items: [{ ...emptySourceSnapshot, id: "item-4", orderId: "order-003", itemType: "打印", name: "A3 彩印", quantity: 100, unitPriceCents: 180, printSpec: "A3|哑粉纸|单面|彩色" }],
    payments: [],
    totalCents: 18_000,
    receivedCents: 18_000,
    paymentStatus: "已结清",
    shipmentCompany: "中通",
    shipmentTrackingNo: "ZT99887766",
    shippingAddress: null,
    folderPath: "D:\\创业客户文件库\\周先生_[customer]\\订单\\2026-06-04_TB20260604018_[order003]",
    folderState: "ready",
    createdAt: now,
    updatedAt: now,
  },
];

let demoFiles: FileRecord[] = [
  { id: "file-1", orderId: "order-001", customerId: "customer-lin", category: "设计稿", name: "夏季活动宣传单-v3.psd", relativePath: "林女士/订单/夏季活动宣传单-v3.psd", sizeBytes: 18_320_000, createdAt: now },
  { id: "file-2", orderId: "order-002", customerId: "customer-studio", category: "成品", name: "品牌手册-定稿.pdf", relativePath: "星河工作室/订单/品牌手册-定稿.pdf", sizeBytes: 6_580_000, createdAt: now },
];

function demoOrderFolderFiles(folderPath: string, orderId: string, customerId: string): FileRecord[] {
  if (!folderPath) return [];
  return [
    { id: `folder-${orderId}-1`, orderId, customerId, category: "图片文件", name: "反.jpg", relativePath: `${folderPath}\\反.jpg`, sizeBytes: 2_300_000, createdAt: now },
    { id: `folder-${orderId}-2`, orderId, customerId, category: "图片文件", name: "正.jpg", relativePath: `${folderPath}\\正.jpg`, sizeBytes: 1_900_000, createdAt: now },
    { id: `folder-${orderId}-3`, orderId, customerId, category: "CorelDRAW", name: "Backup_of_肩颈.cdr", relativePath: `${folderPath}\\Backup_of_肩颈.cdr`, sizeBytes: 90_700_000, createdAt: now },
    { id: `folder-${orderId}-4`, orderId, customerId, category: "CorelDRAW", name: "肩颈.cdr", relativePath: `${folderPath}\\肩颈.cdr`, sizeBytes: 90_700_000, createdAt: now },
    { id: `folder-${orderId}-5`, orderId, customerId, category: "文本文档", name: "尺寸说明.txt", relativePath: `${folderPath}\\尺寸说明.txt`, sizeBytes: 512, createdAt: now },
  ];
}

const demoSettings: AppSettings = { libraryRoot: "D:\\创业客户文件库（演示）", backupDir: "D:\\创业客户备份（演示）" };

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}

function demoDashboard(): DashboardSummary {
  return {
    pendingDesign: demoOrders.filter((order) => ["待设计", "设计中", "待确认"].includes(order.designStatus)).length,
    dueSoon: 2,
    overdue: 1,
    pendingShipment: demoOrders.filter((order) => order.fulfillmentStatus === "待发货").length,
    unpaidCents: demoOrders.reduce((sum, order) => sum + Math.max(0, order.totalCents - order.receivedCents), 0),
    monthRevenueCents: demoOrders.reduce((sum, order) => sum + order.receivedCents, 0),
    todoOrders: demoOrders.filter((order) =>
      order.receivedCents < order.totalCents ||
      order.fulfillmentStatus === "待发货" ||
      ["待设计", "设计中", "待确认"].includes(order.designStatus)
    ),
    recentOrders: demoOrders,
    recentFiles: demoFiles,
  };
}

export const api = {
  isDemo: !isTauri,
  getSettings: () => (isTauri ? call<AppSettings>("get_settings") : Promise.resolve(demoSettings)),
  chooseDirectory: () => (isTauri ? call<string | null>("choose_directory") : Promise.resolve("D:\\创业客户文件库（演示）")),
  chooseFile: () => (isTauri ? call<string | null>("choose_file") : Promise.resolve("D:\\演示文件\\设计稿.psd")),
  chooseSaveFile: (defaultName: string, extension: string) =>
    isTauri ? call<string | null>("choose_save_file", { defaultName, extension }) : Promise.resolve(`D:\\${defaultName}`),
  readImageDataUrl: (path: string) => (
    isTauri
      ? call<string>("read_image_data_url", { path })
      : Promise.resolve(isImageFile({ name: path, relativePath: path }) ? demoImageDataUrl(path) : "")
  ),
  previewSpreadsheet: (path: string) =>
    isTauri
      ? call<SpreadsheetPreview>("preview_customer_spreadsheet", { path })
      : Promise.resolve({
          headers: ["客户名称", "电话", "微信号", "平台", "平台网名", "VIP星级", "标签"],
          rows: [["演示导入客户", "13800138000", "demo-wx", "闲鱼", "演示网名", "3", "复购,导入"]],
        }),
  setLibraryRoot: (path: string) => (isTauri ? call<AppSettings>("set_library_root", { path }) : Promise.resolve({ ...demoSettings, libraryRoot: path })),
  setBackupDir: (path: string) => (isTauri ? call<AppSettings>("set_backup_dir", { path }) : Promise.resolve({ ...demoSettings, backupDir: path })),
  listSourceFactories: () => (isTauri ? call<SourceFactory[]>("list_source_factories") : Promise.resolve(demoFactoriesWithCounts())),
  createSourceFactory: async (input: SourceFactoryInput) => {
    if (isTauri) return call<SourceFactory>("create_source_factory", { input });
    if (!input.name.trim()) throw new Error("厂家名称不能为空");
    const factory: SourceFactory = { ...input, id: crypto.randomUUID(), quoteCount: 0, createdAt: now, updatedAt: now };
    demoSourceFactories = [factory, ...demoSourceFactories];
    return factory;
  },
  updateSourceFactory: async (id: string, input: SourceFactoryInput) => {
    if (isTauri) return call<SourceFactory>("update_source_factory", { id, input });
    if (!input.name.trim()) throw new Error("厂家名称不能为空");
    const current = demoSourceFactories.find((factory) => factory.id === id);
    if (!current) throw new Error("厂家不存在");
    const updated: SourceFactory = { ...current, ...input, updatedAt: new Date().toISOString() };
    demoSourceFactories = demoSourceFactories.map((factory) => (factory.id === id ? updated : factory));
    demoSourceQuotes = demoSourceQuotes.map((quote) => quote.factoryId === id ? { ...quote, factoryName: updated.name } : quote);
    return { ...updated, quoteCount: demoSourceQuotes.filter((quote) => quote.factoryId === id).length };
  },
  deleteSourceFactory: async (id: string) => {
    if (isTauri) return call<void>("delete_source_factory", { id });
    demoSourceFactories = demoSourceFactories.filter((factory) => factory.id !== id);
    demoSourceQuotes = demoSourceQuotes.filter((quote) => quote.factoryId !== id);
    demoSourceFactoryProjects = demoSourceFactoryProjects.filter((project) => project.factoryId !== id);
  },
  listSourceFactoryProjects: (factoryId?: string | null) =>
    isTauri
      ? call<SourceFactoryProject[]>("list_source_factory_projects", { factoryId: factoryId ?? null })
      : Promise.resolve(demoSourceFactoryProjects.filter((project) => !factoryId || project.factoryId === factoryId)),
  createSourceFactoryProject: async (input: SourceFactoryProjectInput) => {
    if (isTauri) return call<SourceFactoryProject>("create_source_factory_project", { input });
    if (!demoSourceFactories.some((factory) => factory.id === input.factoryId)) throw new Error("厂家不存在");
    if (!input.categoryName.trim()) throw new Error("大类名称不能为空");
    const existing = demoSourceFactoryProjects.find((project) =>
      project.factoryId === input.factoryId &&
      project.categoryName === input.categoryName.trim() &&
      project.projectName === input.projectName.trim()
    );
    if (existing) return existing;
    const project: SourceFactoryProject = {
      ...input,
      categoryName: input.categoryName.trim(),
      projectName: input.projectName.trim(),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    demoSourceFactoryProjects = [...demoSourceFactoryProjects, project];
    return project;
  },
  deleteSourceFactoryProject: async (id: string) => {
    if (isTauri) return call<void>("delete_source_factory_project", { id });
    const project = demoSourceFactoryProjects.find((item) => item.id === id);
    if (!project) throw new Error("厂家项目不存在");
    const hasQuotes = project.projectName
      ? demoSourceQuotes.some((quote) => quote.factoryId === project.factoryId && quote.itemName === project.projectName)
      : demoSourceQuotes.some((quote) =>
          quote.factoryId === project.factoryId &&
          demoSourceFactoryProjects.some((item) =>
            item.factoryId === project.factoryId &&
            item.categoryName === project.categoryName &&
            item.projectName === quote.itemName
          )
        );
    if (hasQuotes) throw new Error(project.projectName ? "该小类已有报价，不能直接删除" : "该大类下已有报价，不能直接删除");
    demoSourceFactoryProjects = project.projectName
      ? demoSourceFactoryProjects.filter((item) => item.id !== id)
      : demoSourceFactoryProjects.filter((item) => item.factoryId !== project.factoryId || item.categoryName !== project.categoryName);
  },
  listSourceQuotes: (factoryId?: string | null) =>
    isTauri
      ? call<SourceQuote[]>("list_source_quotes", { factoryId: factoryId ?? null })
      : Promise.resolve(demoSourceQuotes.filter((quote) => !factoryId || quote.factoryId === factoryId)),
  createSourceQuote: async (input: SourceQuoteInput) => {
    if (isTauri) return call<SourceQuote>("create_source_quote", { input });
    const factory = demoSourceFactories.find((item) => item.id === input.factoryId);
    if (!factory) throw new Error("厂家不存在");
    if (!input.itemName.trim()) throw new Error("报价项目名称不能为空");
    if (input.quantity <= 0) throw new Error("报价数量必须大于 0");
    if (input.productionCostCents < 0 || input.shippingCostCents < 0) throw new Error("厂家价格和运费不能为负数");
    const quote: SourceQuote = { ...input, id: crypto.randomUUID(), factoryName: factory.name, createdAt: now, updatedAt: now };
    demoSourceQuotes = [quote, ...demoSourceQuotes];
    return quote;
  },
  updateSourceQuote: async (id: string, input: SourceQuoteInput) => {
    if (isTauri) return call<SourceQuote>("update_source_quote", { id, input });
    const factory = demoSourceFactories.find((item) => item.id === input.factoryId);
    if (!factory) throw new Error("厂家不存在");
    if (!input.itemName.trim()) throw new Error("报价项目名称不能为空");
    if (input.quantity <= 0) throw new Error("报价数量必须大于 0");
    if (input.productionCostCents < 0 || input.shippingCostCents < 0) throw new Error("厂家价格和运费不能为负数");
    const current = demoSourceQuotes.find((quote) => quote.id === id);
    if (!current) throw new Error("报价不存在");
    const updated: SourceQuote = { ...current, ...input, factoryName: factory.name, updatedAt: new Date().toISOString() };
    demoSourceQuotes = demoSourceQuotes.map((quote) => (quote.id === id ? updated : quote));
    return updated;
  },
  deleteSourceQuote: async (id: string) => {
    if (isTauri) return call<void>("delete_source_quote", { id });
    demoSourceQuotes = demoSourceQuotes.filter((quote) => quote.id !== id);
  },
  listCustomers: (vipOnly = false) =>
    isTauri ? call<Customer[]>("list_customers", { vipOnly }) : Promise.resolve(demoCustomers.filter((customer) => !vipOnly || customer.vipLevel > 0)),
  createCustomer: async (input: NewCustomer) => {
    if (isTauri) return call<Customer>("create_customer", { input });
    const customer: Customer = { ...input, id: crypto.randomUUID(), orderCount: 0, totalSpentCents: 0, createdAt: now, updatedAt: now };
    demoCustomers = [customer, ...demoCustomers];
    return customer;
  },
  updateCustomer: async (id: string, input: NewCustomer) => {
    if (isTauri) return call<Customer>("update_customer", { id, input });
    const current = demoCustomers.find((customer) => customer.id === id)!;
    const updated = { ...current, ...input, updatedAt: new Date().toISOString() };
    demoCustomers = demoCustomers.map((customer) => (customer.id === id ? updated : customer));
    demoOrders = demoOrders.map((order) => order.customerId === id ? {
      ...order,
      customerName: updated.name,
      customerPhone: updated.phone,
      customerWechat: updated.wechat,
      customerVipLevel: updated.vipLevel,
    } : order);
    return updated;
  },
  deleteCustomer: async (id: string) => {
    if (isTauri) return call<void>("delete_customer", { id });
    demoCustomers = demoCustomers.filter((customer) => customer.id !== id);
    demoOrders = demoOrders.filter((order) => order.customerId !== id);
    demoFiles = demoFiles.filter((file) => file.customerId !== id);
  },
  listOrders: () => (isTauri ? call<Order[]>("list_orders") : Promise.resolve(demoOrders)),
  syncManagedLibrary: async () => {
    if (isTauri) return call<void>("sync_managed_library");
  },
  createOrder: async (input: NewOrder) => {
    if (isTauri) return call<Order>("create_order", { input });
    const customer = demoCustomers.find((item) => item.id === input.customerId)!;
    const totalCents = input.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const id = crypto.randomUUID();
    const order: Order = {
      ...input,
      id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerWechat: customer.wechat,
      customerVipLevel: customer.vipLevel,
      items: input.items.map((item) => ({ ...item, ...normalizeSourceSnapshot(item), id: crypto.randomUUID(), orderId: id })),
      payments: [],
      totalCents,
      receivedCents: 0,
      paymentStatus: "未收",
      folderState: "ready",
      folderPath: `D:\\创业客户文件库（演示）\\${customer.name}\\${input.externalOrderNo}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    demoOrders = [order, ...demoOrders];
    return order;
  },
  updateOrder: async (id: string, input: NewOrder) => {
    if (isTauri) return call<Order>("update_order", { id, input });
    const customer = demoCustomers.find((item) => item.id === input.customerId)!;
    const current = demoOrders.find((order) => order.id === id)!;
    const totalCents = input.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const updated: Order = {
      ...current,
      ...input,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerWechat: customer.wechat,
      customerVipLevel: customer.vipLevel,
      items: input.items.map((item, index) => ({ ...item, ...normalizeSourceSnapshot(item), id: current.items[index]?.id ?? crypto.randomUUID(), orderId: id })),
      totalCents,
      updatedAt: new Date().toISOString(),
    };
    demoOrders = demoOrders.map((order) => (order.id === id ? updated : order));
    return updated;
  },
  updateOrderStatus: async (id: string, designStatus: string, fulfillmentStatus: string) => {
    if (isTauri) return call<Order>("update_order_status", { id, designStatus, fulfillmentStatus });
    demoOrders = demoOrders.map((order) => (order.id === id ? { ...order, designStatus, fulfillmentStatus } : order));
    return demoOrders.find((order) => order.id === id)!;
  },
  deleteOrder: async (id: string) => {
    if (isTauri) return call<void>("delete_order", { id });
    demoOrders = demoOrders.filter((order) => order.id !== id);
    demoFiles = demoFiles.filter((file) => file.orderId !== id);
  },
  addPayment: async (orderId: string, input: PaymentInput) => {
    if (isTauri) return call<Order>("add_payment", { orderId, input });
    demoOrders = demoOrders.map((order) => {
      if (order.id !== orderId) return order;
      const receivedCents = order.receivedCents + input.amountCents;
      return { ...order, receivedCents, paymentStatus: receivedCents >= order.totalCents ? "已结清" : "部分收款" };
    });
    return demoOrders.find((order) => order.id === orderId)!;
  },
  retryOrderFolder: (orderId: string) => (isTauri ? call<Order>("retry_order_folder", { orderId }) : Promise.resolve(demoOrders.find((order) => order.id === orderId)!)),
  listFiles: () => (isTauri ? call<FileRecord[]>("list_files") : Promise.resolve(demoFiles)),
  listOrderFolderFiles: (folderPath: string, orderId: string, customerId: string) => (
    isTauri
      ? call<FileRecord[]>("list_order_folder_files", { folderPath, orderId, customerId })
      : Promise.resolve(demoOrderFolderFiles(folderPath, orderId, customerId))
  ),
  addOrderFile: async (orderId: string, sourcePath: string, category: string) => {
    if (isTauri) return call<FileRecord>("add_order_file", { orderId, sourcePath, category });
    const order = demoOrders.find((item) => item.id === orderId)!;
    const file: FileRecord = { id: crypto.randomUUID(), orderId, customerId: order.customerId, category, name: sourcePath.split(/[\\/]/).pop() ?? "文件", relativePath: sourcePath, sizeBytes: 1_200_000, createdAt: now };
    demoFiles = [file, ...demoFiles];
    return file;
  },
  deleteFile: async (fileId: string) => {
    if (isTauri) return call<void>("delete_file", { fileId });
    demoFiles = demoFiles.filter((file) => file.id !== fileId);
  },
  search: async (query: string) => {
    if (isTauri) return call<SearchHit[]>("search", { query });
    const normalized = query.toLowerCase();
    return [
      ...demoCustomers
        .filter((customer) => JSON.stringify(customer).toLowerCase().includes(normalized))
        .map((customer) => ({ entityType: "customer", entityId: customer.id, title: customer.name, subtitle: `${customer.phone} ${customer.wechat}` })),
      ...demoOrders
        .filter((order) => JSON.stringify(order).toLowerCase().includes(normalized))
        .map((order) => ({ entityType: "order", entityId: order.id, title: order.externalOrderNo, subtitle: `${order.customerName} ${order.platform}` })),
      ...demoFactoriesWithCounts()
        .filter((factory) => JSON.stringify(factory).toLowerCase().includes(normalized))
        .map((factory) => ({ entityType: "factory", entityId: factory.id, title: factory.name, subtitle: `${factory.contactName} ${factory.phone || factory.wechat || factory.qq} ${factory.quoteCount} 条报价` })),
      ...demoSourceQuotes
        .filter((quote) => JSON.stringify(quote).toLowerCase().includes(normalized))
        .map((quote) => ({ entityType: "factory", entityId: quote.factoryId, title: quote.factoryName, subtitle: `${quote.itemName} ${quote.quantity} ${quote.material} ${quote.finish}` })),
    ];
  },
  dashboard: () => (isTauri ? call<DashboardSummary>("dashboard") : Promise.resolve(demoDashboard())),
  importCustomers: (rows: ImportCustomerRow[]) =>
    isTauri
      ? call<ImportResult>("import_customers", { rows })
      : Promise.resolve({ imported: rows.filter((row) => row.name).length, skipped: rows.filter((row) => !row.name).length, errors: [], duplicateWarnings: [] }),
  exportFull: (destination: string) => (isTauri ? call<string>("export_full", { destination }) : Promise.resolve(destination)),
  restoreBackup: (source: string) => (isTauri ? call<string>("restore_backup", { source }) : Promise.resolve(source)),
  exportCloudReadModel: (destination: string) => (isTauri ? call<string>("export_cloud_read_model", { destination }) : Promise.resolve(destination)),
  openInExplorer: (path: string) => (isTauri ? call<void>("open_in_explorer", { path }) : Promise.resolve()),
  restartApp: () => (isTauri ? call<void>("restart_app") : Promise.resolve()),
};
