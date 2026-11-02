use crate::{
    error::{AppError, Result},
    models::{ActivityKind, Payment, PaymentInput, PaymentKind, PaymentPatch, PaymentWithContext},
};
use rusqlite::{params, Connection, Row};
use serde_json::json;

const SELECT: &str = "SELECT m.*,p.title AS project_title,c.id AS client_id,c.name AS client_name
    FROM payments m JOIN projects p ON p.id=m.project_id JOIN clients c ON c.id=p.client_id
    WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL";
const SORT: &str = "ORDER BY m.paid_at DESC,m.created_at DESC,m.id";

fn from_row(row: &Row<'_>) -> rusqlite::Result<Payment> {
    Ok(Payment {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        kind: row.get("kind")?,
        amount_cents: row.get("amount_cents")?,
        paid_at: row.get("paid_at")?,
        method: row.get("method")?,
        note: row.get("note")?,
        created_at: row.get("created_at")?,
    })
}

fn get(connection: &Connection, id: &str) -> Result<Payment> {
    Ok(connection.query_row(&format!("{SELECT} AND m.id=?1"), [id], from_row)?)
}

pub fn list(connection: &Connection, project_id: &str) -> Result<Vec<Payment>> {
    let mut statement = connection.prepare(&format!("{SELECT} AND m.project_id=?1 {SORT}"))?;
    let rows = statement.query_map([project_id], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn all(connection: &Connection) -> Result<Vec<PaymentWithContext>> {
    let mut statement = connection.prepare(&format!("{SELECT} {SORT}"))?;
    let rows = statement.query_map([], |row| {
        Ok(PaymentWithContext {
            payment: from_row(row)?,
            project_title: row.get("project_title")?,
            client_id: row.get("client_id")?,
            client_name: row.get("client_name")?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

fn validate(amount: i64, paid_at: &str) -> Result<()> {
    if amount <= 0 {
        return Err(AppError::invalid("收款或退款金额必须大于零"));
    }
    super::date(paid_at)
}

fn record(connection: &Connection, client_id: &str, payment: &Payment, body: &str) -> Result<()> {
    super::activities::insert(
        connection,
        client_id,
        Some(&payment.project_id),
        ActivityKind::Payment,
        body,
        json!({"kind":payment.kind,"amountCents":payment.amount_cents,"method":payment.method}),
    )?;
    Ok(())
}

pub fn add(connection: &Connection, input: PaymentInput) -> Result<Payment> {
    validate(input.amount_cents, &input.paid_at)?;
    let transaction = connection.unchecked_transaction()?;
    let client_id = super::project_client(&transaction, &input.project_id)?;
    let kind = input.kind.unwrap_or(PaymentKind::Income);
    let method = match input.method {
        Some(method) => {
            if !method.is_empty() {
                super::settings::write(&transaction, "lastPaymentMethod", &method)?;
            }
            method
        }
        None => super::settings::read(&transaction, "lastPaymentMethod")?.unwrap_or_default(),
    };
    let id = super::id();
    let timestamp = super::now();
    transaction.execute(
        "INSERT INTO payments(id,project_id,kind,amount_cents,paid_at,method,note,created_at)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
        params![
            id,
            input.project_id,
            kind.as_str(),
            input.amount_cents,
            input.paid_at,
            method,
            input.note.unwrap_or_default(),
            timestamp
        ],
    )?;
    let payment = get(&transaction, &id)?;
    record(
        &transaction,
        &client_id,
        &payment,
        match kind {
            PaymentKind::Income => "新增了收款",
            PaymentKind::Refund => "新增了退款",
        },
    )?;
    transaction.execute(
        "UPDATE projects SET updated_at=?2 WHERE id=?1",
        params![input.project_id, timestamp],
    )?;
    transaction.commit()?;
    Ok(payment)
}

pub fn update(connection: &Connection, id: &str, patch: PaymentPatch) -> Result<Payment> {
    let transaction = connection.unchecked_transaction()?;
    let current = get(&transaction, id)?;
    let amount = patch.amount_cents.unwrap_or(current.amount_cents);
    let paid_at = patch.paid_at.unwrap_or(current.paid_at);
    validate(amount, &paid_at)?;
    transaction.execute(
        "UPDATE payments SET kind=?2,amount_cents=?3,paid_at=?4,method=?5,note=?6 WHERE id=?1",
        params![
            id,
            patch.kind.unwrap_or(current.kind).as_str(),
            amount,
            paid_at,
            patch.method.unwrap_or(current.method),
            patch.note.unwrap_or(current.note)
        ],
    )?;
    transaction.execute(
        "UPDATE projects SET updated_at=?2 WHERE id=?1",
        params![current.project_id, super::now()],
    )?;
    let payment = get(&transaction, id)?;
    transaction.commit()?;
    Ok(payment)
}

pub fn delete(connection: &Connection, id: &str) -> Result<()> {
    let transaction = connection.unchecked_transaction()?;
    let payment = get(&transaction, id)?;
    let client_id = super::project_client(&transaction, &payment.project_id)?;
    transaction.execute("DELETE FROM payments WHERE id=?1", [id])?;
    record(
        &transaction,
        &client_id,
        &payment,
        match payment.kind {
            PaymentKind::Income => "删除了收款",
            PaymentKind::Refund => "删除了退款",
        },
    )?;
    transaction.execute(
        "UPDATE projects SET updated_at=?2 WHERE id=?1",
        params![payment.project_id, super::now()],
    )?;
    transaction.commit()?;
    Ok(())
}
