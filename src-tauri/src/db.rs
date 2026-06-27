use std::path::Path;

use rusqlite::{Connection, Result};

pub fn open(path: &Path) -> Result<Connection> {
    let connection = Connection::open(path)?;
    connection.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        ",
    )?;
    migrate(&connection)?;
    Ok(connection)
}

fn migrate(connection: &Connection) -> Result<()> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '',
            wechat TEXT NOT NULL DEFAULT '',
            vip_level INTEGER NOT NULL DEFAULT 0 CHECK(vip_level BETWEEN 0 AND 5),
            notes TEXT NOT NULL DEFAULT '',
            tags_json TEXT NOT NULL DEFAULT '[]',
            qr_code_path TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS platform_identities (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            platform TEXT NOT NULL,
            handle TEXT NOT NULL DEFAULT '',
            account TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS addresses (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            label TEXT NOT NULL DEFAULT '',
            recipient TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL REFERENCES customers(id),
            platform TEXT NOT NULL DEFAULT '',
            platform_account TEXT NOT NULL DEFAULT '',
            external_order_no TEXT NOT NULL DEFAULT '',
            design_status TEXT NOT NULL,
            fulfillment_status TEXT NOT NULL,
            design_due_at TEXT,
            delivery_due_at TEXT,
            notes TEXT NOT NULL DEFAULT '',
            tags_json TEXT NOT NULL DEFAULT '[]',
            total_cents INTEGER NOT NULL DEFAULT 0,
            received_cents INTEGER NOT NULL DEFAULT 0,
            shipment_company TEXT NOT NULL DEFAULT '',
            shipment_tracking_no TEXT NOT NULL DEFAULT '',
            shipping_address_label TEXT NOT NULL DEFAULT '',
            shipping_recipient TEXT NOT NULL DEFAULT '',
            shipping_phone TEXT NOT NULL DEFAULT '',
            shipping_address TEXT NOT NULL DEFAULT '',
            folder_path TEXT,
            folder_state TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            item_type TEXT NOT NULL,
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price_cents INTEGER NOT NULL,
            print_spec TEXT,
            source_quote_id TEXT,
            source_factory_id TEXT,
            source_factory_name TEXT NOT NULL DEFAULT '',
            source_quote_summary TEXT NOT NULL DEFAULT '',
            source_production_cost_cents INTEGER NOT NULL DEFAULT 0,
            source_shipping_cost_cents INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS source_factories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            contact_name TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            wechat TEXT NOT NULL DEFAULT '',
            qq TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            tags_json TEXT NOT NULL DEFAULT '[]',
            shipping_notes TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS source_factory_quotes (
            id TEXT PRIMARY KEY,
            factory_id TEXT NOT NULL REFERENCES source_factories(id),
            item_type TEXT NOT NULL DEFAULT '',
            item_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            size TEXT NOT NULL DEFAULT '',
            material TEXT NOT NULL DEFAULT '',
            paper_weight TEXT NOT NULL DEFAULT '',
            sides TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '',
            finish TEXT NOT NULL DEFAULT '',
            production_cost_cents INTEGER NOT NULL DEFAULT 0,
            shipping_cost_cents INTEGER NOT NULL DEFAULT 0,
            lead_time TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS source_factory_projects (
            id TEXT PRIMARY KEY,
            factory_id TEXT NOT NULL REFERENCES source_factories(id),
            category_name TEXT NOT NULL,
            project_name TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            amount_cents INTEGER NOT NULL,
            paid_at TEXT NOT NULL,
            method TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
            customer_id TEXT NOT NULL REFERENCES customers(id),
            category TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL,
            relative_path TEXT NOT NULL,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            deleted_at TEXT
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
            entity_type,
            entity_id UNINDEXED,
            title,
            content,
            tokenize = 'unicode61'
        );

        CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(design_status, fulfillment_status);
        CREATE INDEX IF NOT EXISTS idx_orders_due ON orders(design_due_at, delivery_due_at);
        CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_source_quotes_factory ON source_factory_quotes(factory_id);
        CREATE INDEX IF NOT EXISTS idx_source_quotes_item ON source_factory_quotes(item_name, item_type);
        CREATE INDEX IF NOT EXISTS idx_source_projects_factory ON source_factory_projects(factory_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_source_projects_unique_active
            ON source_factory_projects(factory_id, category_name, project_name)
            WHERE deleted_at IS NULL;

        INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (1, datetime('now'));
        ",
    )?;
    ensure_column(connection, "order_items", "source_quote_id", "TEXT")?;
    ensure_column(connection, "order_items", "source_factory_id", "TEXT")?;
    ensure_column(
        connection,
        "order_items",
        "source_factory_name",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        connection,
        "order_items",
        "source_quote_summary",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        connection,
        "order_items",
        "source_production_cost_cents",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        connection,
        "order_items",
        "source_shipping_cost_cents",
        "INTEGER NOT NULL DEFAULT 0",
    )?;
    ensure_column(
        connection,
        "source_factories",
        "qq",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        connection,
        "orders",
        "shipping_address_label",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        connection,
        "orders",
        "shipping_recipient",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        connection,
        "orders",
        "shipping_phone",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    ensure_column(
        connection,
        "orders",
        "shipping_address",
        "TEXT NOT NULL DEFAULT ''",
    )?;
    Ok(())
}

fn ensure_column(
    connection: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<()> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let exists = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<Result<Vec<_>>>()?
        .iter()
        .any(|name| name == column);
    if !exists {
        connection.execute(
            &format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"),
            [],
        )?;
    }
    Ok(())
}
