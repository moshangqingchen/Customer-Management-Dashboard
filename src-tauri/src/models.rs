use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformIdentityInput {
    pub platform: String,
    pub handle: String,
    pub account: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressInput {
    pub label: String,
    pub recipient: String,
    pub phone: String,
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCustomer {
    pub name: String,
    pub phone: String,
    pub wechat: String,
    pub vip_level: i64,
    pub notes: String,
    pub tags: Vec<String>,
    pub platform_identities: Vec<PlatformIdentityInput>,
    pub addresses: Vec<AddressInput>,
    pub qr_code_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub phone: String,
    pub wechat: String,
    pub vip_level: i64,
    pub notes: String,
    pub tags: Vec<String>,
    pub platform_identities: Vec<PlatformIdentityInput>,
    pub addresses: Vec<AddressInput>,
    pub qr_code_path: Option<String>,
    pub order_count: i64,
    pub total_spent_cents: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderItemInput {
    pub item_type: String,
    pub name: String,
    pub quantity: i64,
    pub unit_price_cents: i64,
    pub print_spec: Option<String>,
    #[serde(default)]
    pub source_quote_id: Option<String>,
    #[serde(default)]
    pub source_factory_id: Option<String>,
    #[serde(default)]
    pub source_factory_name: String,
    #[serde(default)]
    pub source_quote_summary: String,
    #[serde(default)]
    pub source_production_cost_cents: i64,
    #[serde(default)]
    pub source_shipping_cost_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderItem {
    pub id: String,
    pub order_id: String,
    pub item_type: String,
    pub name: String,
    pub quantity: i64,
    pub unit_price_cents: i64,
    pub print_spec: Option<String>,
    pub source_quote_id: Option<String>,
    pub source_factory_id: Option<String>,
    pub source_factory_name: String,
    pub source_quote_summary: String,
    pub source_production_cost_cents: i64,
    pub source_shipping_cost_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFactoryInput {
    pub name: String,
    pub contact_name: String,
    pub phone: String,
    pub wechat: String,
    #[serde(default)]
    pub qq: String,
    pub address: String,
    pub tags: Vec<String>,
    pub shipping_notes: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFactory {
    pub id: String,
    pub name: String,
    pub contact_name: String,
    pub phone: String,
    pub wechat: String,
    #[serde(default)]
    pub qq: String,
    pub address: String,
    pub tags: Vec<String>,
    pub shipping_notes: String,
    pub notes: String,
    pub quote_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceQuoteInput {
    pub factory_id: String,
    pub item_type: String,
    pub item_name: String,
    pub quantity: i64,
    pub size: String,
    pub material: String,
    pub paper_weight: String,
    pub sides: String,
    pub color: String,
    pub finish: String,
    pub production_cost_cents: i64,
    pub shipping_cost_cents: i64,
    pub lead_time: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceQuote {
    pub id: String,
    pub factory_id: String,
    pub factory_name: String,
    pub item_type: String,
    pub item_name: String,
    pub quantity: i64,
    pub size: String,
    pub material: String,
    pub paper_weight: String,
    pub sides: String,
    pub color: String,
    pub finish: String,
    pub production_cost_cents: i64,
    pub shipping_cost_cents: i64,
    pub lead_time: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewOrder {
    pub customer_id: String,
    pub platform: String,
    pub platform_account: String,
    pub external_order_no: String,
    pub design_status: String,
    pub fulfillment_status: String,
    pub design_due_at: Option<String>,
    pub delivery_due_at: Option<String>,
    pub notes: String,
    pub tags: Vec<String>,
    pub items: Vec<OrderItemInput>,
    pub shipment_company: String,
    pub shipment_tracking_no: String,
    pub shipping_address: Option<AddressInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentInput {
    pub amount_cents: i64,
    pub paid_at: String,
    pub method: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payment {
    pub id: String,
    pub order_id: String,
    pub amount_cents: i64,
    pub paid_at: String,
    pub method: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Order {
    pub id: String,
    pub customer_id: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub customer_wechat: String,
    pub customer_vip_level: i64,
    pub platform: String,
    pub platform_account: String,
    pub external_order_no: String,
    pub design_status: String,
    pub fulfillment_status: String,
    pub design_due_at: Option<String>,
    pub delivery_due_at: Option<String>,
    pub notes: String,
    pub tags: Vec<String>,
    pub items: Vec<OrderItem>,
    pub payments: Vec<Payment>,
    pub total_cents: i64,
    pub received_cents: i64,
    pub payment_status: String,
    pub shipment_company: String,
    pub shipment_tracking_no: String,
    pub shipping_address: Option<AddressInput>,
    pub folder_path: Option<String>,
    pub folder_state: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRecord {
    pub id: String,
    pub order_id: Option<String>,
    pub customer_id: String,
    pub category: String,
    pub name: String,
    pub relative_path: String,
    pub size_bytes: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub entity_type: String,
    pub entity_id: String,
    pub title: String,
    pub subtitle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub pending_design: i64,
    pub due_soon: i64,
    pub overdue: i64,
    pub pending_shipment: i64,
    pub unpaid_cents: i64,
    pub month_revenue_cents: i64,
    pub todo_orders: Vec<Order>,
    pub recent_orders: Vec<Order>,
    pub recent_files: Vec<FileRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub library_root: Option<String>,
    pub backup_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCustomerRow {
    pub row_number: usize,
    pub name: String,
    pub phone: String,
    pub wechat: String,
    pub platform: String,
    pub platform_handle: String,
    pub notes: String,
    pub vip_level: i64,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
    pub duplicate_warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpreadsheetPreview {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}
