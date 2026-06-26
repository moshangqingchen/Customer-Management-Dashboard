export interface PlatformIdentityInput {
  platform: string;
  handle: string;
  account: string;
}

export interface AddressInput {
  label: string;
  recipient: string;
  phone: string;
  address: string;
}

export interface NewCustomer {
  name: string;
  phone: string;
  wechat: string;
  vipLevel: number;
  notes: string;
  tags: string[];
  platformIdentities: PlatformIdentityInput[];
  addresses: AddressInput[];
  qrCodePath?: string | null;
}

export interface Customer extends NewCustomer {
  id: string;
  orderCount: number;
  totalSpentCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemInput {
  itemType: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  printSpec?: string | null;
  sourceQuoteId?: string | null;
  sourceFactoryId?: string | null;
  sourceFactoryName: string;
  sourceQuoteSummary: string;
  sourceProductionCostCents: number;
  sourceShippingCostCents: number;
}

export interface OrderItem extends OrderItemInput {
  id: string;
  orderId: string;
}

export interface SourceFactoryInput {
  name: string;
  contactName: string;
  phone: string;
  wechat: string;
  address: string;
  tags: string[];
  shippingNotes: string;
  notes: string;
}

export interface SourceFactory extends SourceFactoryInput {
  id: string;
  quoteCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceQuoteInput {
  factoryId: string;
  itemType: string;
  itemName: string;
  quantity: number;
  size: string;
  material: string;
  paperWeight: string;
  sides: string;
  color: string;
  finish: string;
  productionCostCents: number;
  shippingCostCents: number;
  leadTime: string;
  notes: string;
}

export interface SourceQuote extends SourceQuoteInput {
  id: string;
  factoryName: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewOrder {
  customerId: string;
  platform: string;
  platformAccount: string;
  externalOrderNo: string;
  designStatus: string;
  fulfillmentStatus: string;
  designDueAt?: string | null;
  deliveryDueAt?: string | null;
  notes: string;
  tags: string[];
  items: OrderItemInput[];
  shipmentCompany: string;
  shipmentTrackingNo: string;
  shippingAddress?: AddressInput | null;
}

export interface PaymentInput {
  amountCents: number;
  paidAt: string;
  method: string;
  notes: string;
}

export interface Payment extends PaymentInput {
  id: string;
  orderId: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerWechat: string;
  customerVipLevel: number;
  platform: string;
  platformAccount: string;
  externalOrderNo: string;
  designStatus: string;
  fulfillmentStatus: string;
  designDueAt?: string | null;
  deliveryDueAt?: string | null;
  notes: string;
  tags: string[];
  items: OrderItem[];
  payments: Payment[];
  totalCents: number;
  receivedCents: number;
  paymentStatus: string;
  shipmentCompany: string;
  shipmentTrackingNo: string;
  shippingAddress?: AddressInput | null;
  folderPath?: string | null;
  folderState: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileRecord {
  id: string;
  orderId?: string | null;
  customerId: string;
  category: string;
  name: string;
  relativePath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface SearchHit {
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string;
}

export interface DashboardSummary {
  pendingDesign: number;
  dueSoon: number;
  overdue: number;
  pendingShipment: number;
  unpaidCents: number;
  monthRevenueCents: number;
  todoOrders?: Order[];
  recentOrders: Order[];
  recentFiles: FileRecord[];
}

export interface AppSettings {
  libraryRoot?: string | null;
  backupDir?: string | null;
}

export interface ImportCustomerRow {
  rowNumber: number;
  name: string;
  phone: string;
  wechat: string;
  platform: string;
  platformHandle: string;
  notes: string;
  vipLevel: number;
  tags: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  duplicateWarnings: string[];
}

export interface SpreadsheetPreview {
  headers: string[];
  rows: string[][];
}

export type CustomerImportField =
  | "name"
  | "phone"
  | "wechat"
  | "platform"
  | "platformHandle"
  | "notes"
  | "vipLevel"
  | "tags";

export type CustomerColumnMapping = Partial<Record<CustomerImportField, string>>;

export type PageId =
  | "dashboard"
  | "customers"
  | "orders"
  | "factories"
  | "vip"
  | "files"
  | "import"
  | "settings";
