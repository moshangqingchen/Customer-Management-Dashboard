#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OrderLine {
    pub quantity: i64,
    pub unit_price_cents: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentStatus {
    Unpaid,
    Partial,
    Paid,
}

pub fn total_amount(lines: &[OrderLine]) -> i64 {
    lines
        .iter()
        .map(|line| line.quantity.saturating_mul(line.unit_price_cents))
        .sum()
}

pub fn payment_status(total_cents: i64, received_cents: i64) -> PaymentStatus {
    if received_cents <= 0 {
        PaymentStatus::Unpaid
    } else if received_cents < total_cents {
        PaymentStatus::Partial
    } else {
        PaymentStatus::Paid
    }
}
