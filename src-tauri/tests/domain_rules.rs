use startup_customer_workbench_lib::domain::{
    folder_names::{customer_folder_name, next_available_name, order_folder_name},
    money::{payment_status, total_amount, OrderLine, PaymentStatus},
};

#[test]
fn totals_order_lines_in_cents_without_float_rounding() {
    let lines = vec![
        OrderLine {
            quantity: 3,
            unit_price_cents: 199,
        },
        OrderLine {
            quantity: 2,
            unit_price_cents: 2_500,
        },
    ];

    assert_eq!(total_amount(&lines), 5_597);
}

#[test]
fn derives_payment_status_from_received_amount() {
    assert_eq!(payment_status(10_000, 0), PaymentStatus::Unpaid);
    assert_eq!(payment_status(10_000, 4_000), PaymentStatus::Partial);
    assert_eq!(payment_status(10_000, 10_000), PaymentStatus::Paid);
    assert_eq!(payment_status(10_000, 11_000), PaymentStatus::Paid);
}

#[test]
fn creates_stable_sanitized_customer_and_order_folder_names() {
    assert_eq!(
        customer_folder_name("林女士/设计", "abc12345"),
        "林女士_设计_[abc12345]"
    );
    assert_eq!(
        order_folder_name("2026-06-06", "XY:9988/01", "order001"),
        "2026-06-06_XY_9988_01_[order001]"
    );
}

#[test]
fn versions_duplicate_file_names_without_overwriting() {
    let existing = vec!["成品.png".to_string(), "成品 (2).png".to_string()];
    assert_eq!(next_available_name("成品.png", &existing), "成品 (3).png");
}
