use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Map, Value};

macro_rules! string_enum {
    ($name:ident { $($variant:ident => $value:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        pub enum $name { $(#[serde(rename = $value)] $variant),+ }
        impl $name {
            pub fn as_str(self) -> &'static str { match self { $(Self::$variant => $value),+ } }
        }
        impl rusqlite::types::FromSql for $name {
            fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
                match value.as_str()? {
                    $($value => Ok(Self::$variant),)+
                    _ => Err(rusqlite::types::FromSqlError::InvalidType),
                }
            }
        }
    };
}

string_enum!(ProjectStatus { Lead => "lead", Active => "active", Review => "review", Delivered => "delivered", Done => "done", Cancelled => "cancelled" });
string_enum!(PaymentKind { Income => "income", Refund => "refund" });
string_enum!(TagColor { Red => "red", Orange => "orange", Amber => "amber", Lime => "lime", Green => "green", Teal => "teal", Cyan => "cyan", Blue => "blue", Violet => "violet", Pink => "pink", Gray => "gray" });
string_enum!(FileKind { Image => "image", Design => "design", Pdf => "pdf", Doc => "doc", Archive => "archive", Video => "video", Other => "other" });
string_enum!(ActivityKind { Note => "note", Status => "status", Payment => "payment", File => "file", Created => "created" });
string_enum!(Theme { Light => "light", Dark => "dark", System => "system" });
string_enum!(LibraryState { Ready => "ready", NotConfigured => "notConfigured", Missing => "missing", ReadOnly => "readOnly" });
string_enum!(BackupKind { Auto => "auto", Manual => "manual", BeforeRestore => "beforeRestore" });
string_enum!(TrashType { Client => "client", Project => "project" });

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: TagColor,
    pub sort: i64,
    pub client_count: i64,
    pub project_count: i64,
}
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TagPatch {
    pub name: Option<String>,
    pub color: Option<TagColor>,
    pub sort: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientAccount {
    pub platform: String,
    pub handle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Client {
    pub id: String,
    pub name: String,
    pub company: String,
    pub phone: String,
    pub wechat: String,
    pub email: String,
    pub address: String,
    pub accounts: Vec<ClientAccount>,
    pub rating: i64,
    pub pinned: bool,
    pub notes: String,
    pub folder: Option<String>,
    pub tag_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub project_count: i64,
    pub open_project_count: i64,
    pub billed_cents: i64,
    pub received_cents: i64,
    pub outstanding_cents: i64,
    pub first_project_at: Option<String>,
    pub last_activity_at: String,
}
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClientInput {
    pub name: String,
    pub company: Option<String>,
    pub phone: Option<String>,
    pub wechat: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub accounts: Option<Vec<ClientAccount>>,
    pub rating: Option<i64>,
    pub pinned: Option<bool>,
    pub notes: Option<String>,
    pub tag_ids: Option<Vec<String>>,
}
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ClientPatch {
    pub name: Option<String>,
    pub company: Option<String>,
    pub phone: Option<String>,
    pub wechat: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub accounts: Option<Vec<ClientAccount>>,
    pub rating: Option<i64>,
    pub pinned: Option<bool>,
    pub notes: Option<String>,
    pub rename_folder: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub client_id: String,
    pub client_name: String,
    pub title: String,
    pub status: ProjectStatus,
    pub pinned: bool,
    pub brief: String,
    pub source_platform: String,
    pub source_order_no: String,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub delivered_at: Option<String>,
    pub completed_at: Option<String>,
    pub price_cents: i64,
    pub cost_cents: i64,
    pub tag_ids: Vec<String>,
    pub folder: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub received_cents: i64,
    pub payment_count: i64,
    pub file_count: i64,
    pub cover_path: Option<String>,
}
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectInput {
    pub client_id: String,
    pub title: String,
    pub status: Option<ProjectStatus>,
    pub pinned: Option<bool>,
    pub brief: Option<String>,
    pub source_platform: Option<String>,
    pub source_order_no: Option<String>,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub price_cents: Option<i64>,
    pub cost_cents: Option<i64>,
    pub tag_ids: Option<Vec<String>>,
}

// Omitted dates leave the field unchanged, explicit null clears it.
fn nullable_patch<'de, D, T>(deserializer: D) -> std::result::Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectPatch {
    pub client_id: Option<String>,
    pub title: Option<String>,
    pub pinned: Option<bool>,
    pub brief: Option<String>,
    pub source_platform: Option<String>,
    pub source_order_no: Option<String>,
    #[serde(default, deserialize_with = "nullable_patch")]
    pub start_date: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable_patch")]
    pub due_date: Option<Option<String>>,
    pub price_cents: Option<i64>,
    pub cost_cents: Option<i64>,
    pub rename_folder: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payment {
    pub id: String,
    pub project_id: String,
    pub kind: PaymentKind,
    pub amount_cents: i64,
    pub paid_at: String,
    pub method: String,
    pub note: String,
    pub created_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentWithContext {
    #[serde(flatten)]
    pub payment: Payment,
    pub project_title: String,
    pub client_id: String,
    pub client_name: String,
}
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PaymentInput {
    pub project_id: String,
    pub kind: Option<PaymentKind>,
    pub amount_cents: i64,
    pub paid_at: String,
    pub method: Option<String>,
    pub note: Option<String>,
}
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PaymentPatch {
    pub kind: Option<PaymentKind>,
    pub amount_cents: Option<i64>,
    pub paid_at: Option<String>,
    pub method: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub client_id: String,
    pub project_id: Option<String>,
    pub project_title: Option<String>,
    pub client_name: String,
    pub kind: ActivityKind,
    pub body: String,
    pub meta: Map<String, Value>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetGroup {
    pub id: String,
    pub name: String,
    pub sort: i64,
}
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SnippetGroupPatch {
    pub name: Option<String>,
    pub sort: Option<i64>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snippet {
    pub id: String,
    pub group_id: String,
    pub title: String,
    pub body: String,
    pub sort: i64,
    pub use_count: i64,
    pub updated_at: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SnippetInput {
    pub group_id: String,
    pub title: String,
    pub body: String,
}
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SnippetPatch {
    pub group_id: Option<String>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub sort: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub rel_path: String,
    pub name: String,
    pub ext: String,
    pub kind: FileKind,
    pub size_bytes: u64,
    pub modified_at: String,
    pub folder_group: String,
    pub client_id: Option<String>,
    pub project_id: Option<String>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileListResult {
    pub files: Vec<FileEntry>,
    pub folder: Option<String>,
    pub folder_missing: bool,
}
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilesAddResult {
    pub added: Vec<FileEntry>,
    pub failed: Vec<FileAddFailure>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileAddFailure {
    pub name: String,
    pub message: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged, deny_unknown_fields)]
pub enum FileTarget {
    Project {
        #[serde(rename = "projectId")]
        project_id: String,
    },
    Client {
        #[serde(rename = "clientId")]
        client_id: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStatus {
    pub root: Option<String>,
    pub state: LibraryState,
    pub free_bytes: Option<u64>,
    pub message: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: Theme,
    pub subfolder_template: Vec<String>,
    pub payment_methods: Vec<String>,
    pub source_platforms: Vec<String>,
    pub last_payment_method: String,
}
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettingsPatch {
    pub theme: Option<Theme>,
    pub subfolder_template: Option<Vec<String>>,
    pub payment_methods: Option<Vec<String>>,
    pub source_platforms: Option<Vec<String>>,
    pub last_payment_method: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub kind: BackupKind,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashItem {
    pub r#type: TrashType,
    pub id: String,
    pub title: String,
    pub subtitle: String,
    pub deleted_at: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub data_dir: String,
    pub db_path: String,
    pub portable: bool,
    pub suggested_library_root: Option<String>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MutationResult<T> {
    pub value: T,
    pub warning: Option<String>,
}
