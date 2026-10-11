from decimal import Decimal
import pytest
from app.core.decimal_utils import (
    quantize_money,
    quantize_rate,
    calculate_line_item,
    calculate_invoice_totals,
    validate_and_calculate_payment,
    to_decimal,
)


def test_quantize_money_round_half_up():
    # 0.005 rounds up to 0.01
    assert quantize_money("10.005") == Decimal("10.01")
    # 0.004 rounds down to 0.00
    assert quantize_money("10.004") == Decimal("10.00")
    # Exact 2 decimal places unchanged
    assert quantize_money("125.50") == Decimal("125.50")
    assert quantize_money(12.345) == Decimal("12.35")
    assert quantize_money(0) == Decimal("0.00")


def test_line_item_calculation_simple():
    # 2 units @ 50.00 = 100.00 subtotal, 0 discount, 0 tax -> 100.00
    item = calculate_line_item(quantity=2, unit_price="50.00")
    assert item["line_subtotal"] == Decimal("100.00")
    assert item["line_discount"] == Decimal("0.00")
    assert item["line_tax"] == Decimal("0.00")
    assert item["line_total"] == Decimal("100.00")


def test_line_item_with_discount_and_tax():
    # 3 units @ 100.00 = 300.00
    # 10% discount = 30.00 -> taxable: 270.00
    # 8.25% tax = 270.00 * 0.0825 = 22.275 -> 22.28
    # line total = 270.00 + 22.28 = 292.28
    item = calculate_line_item(
        quantity=3,
        unit_price=100.00,
        discount_percent="10.00",
        tax_rate="8.25",
    )
    assert item["line_subtotal"] == Decimal("300.00")
    assert item["line_discount"] == Decimal("30.00")
    assert item["taxable_amount"] == Decimal("270.00")
    assert item["line_tax"] == Decimal("22.28")
    assert item["line_total"] == Decimal("292.28")


def test_invoice_totals_aggregation():
    items = [
        {"quantity": 2, "unit_price": "100.00", "discount_percent": 0, "tax_rate": "10.00"},  # 200 + 20 = 220
        {"quantity": 1, "unit_price": "50.00", "discount_percent": "20.00", "tax_rate": "10.00"},  # 50 - 10 = 40 + 4 = 44
    ]
    totals = calculate_invoice_totals(items)
    assert totals["subtotal"] == Decimal("250.00")
    assert totals["discount_amount"] == Decimal("10.00")
    assert totals["tax_amount"] == Decimal("24.00")
    assert totals["total_amount"] == Decimal("264.00")


def test_payment_validation_and_balances():
    total_amount = Decimal("500.00")
    current_paid = Decimal("0.00")

    # 1. Valid partial payment of $200
    res1 = validate_and_calculate_payment(total_amount, current_paid, "200.00")
    assert res1["is_valid"] is True
    assert res1["new_amount_paid"] == Decimal("200.00")
    assert res1["new_balance_due"] == Decimal("300.00")
    assert res1["is_fully_paid"] is False

    # 2. Second partial payment of $300 to settle
    res2 = validate_and_calculate_payment(total_amount, res1["new_amount_paid"], "300.00")
    assert res2["is_valid"] is True
    assert res2["new_amount_paid"] == Decimal("500.00")
    assert res2["new_balance_due"] == Decimal("0.00")
    assert res2["is_fully_paid"] is True

    # 3. Reject overpayment
    res3 = validate_and_calculate_payment(total_amount, Decimal("400.00"), "150.00")
    assert res3["is_valid"] is False
    assert "exceeds remaining balance" in res3["error"]

    # 4. Reject negative or zero payment
    res_zero = validate_and_calculate_payment(total_amount, Decimal("0.00"), "0.00")
    assert res_zero["is_valid"] is False
    assert "greater than zero" in res_zero["error"]


def test_fractional_quantities_and_precision():
    # 3.75 hours @ 85.50 / hr = 320.625 -> line_subtotal: 320.63
    # 5% discount = 320.625 * 0.05 = 16.03125 -> 16.03
    # taxable: 320.625 - 16.03125 = 304.59375
    # 7.5% tax = 304.59375 * 0.075 = 22.84453125 -> 22.84
    # line_total: 304.59375 + 22.84453125 = 327.43828125 -> 327.44
    item = calculate_line_item(
        quantity="3.75",
        unit_price="85.50",
        discount_percent="5.00",
        tax_rate="7.50",
    )
    assert item["line_subtotal"] == Decimal("320.63")
    assert item["line_discount"] == Decimal("16.03")
    assert item["line_tax"] == Decimal("22.85")
    assert item["line_total"] == Decimal("327.45")


def test_zero_value_invoices_and_items():
    # Free consultation / zero-value invoice item
    item = calculate_line_item(quantity=1, unit_price="0.00", discount_percent=0, tax_rate=0)
    assert item["line_subtotal"] == Decimal("0.00")
    assert item["line_discount"] == Decimal("0.00")
    assert item["line_tax"] == Decimal("0.00")
    assert item["line_total"] == Decimal("0.00")

    totals = calculate_invoice_totals([{"quantity": 1, "unit_price": "0.00"}])
    assert totals["subtotal"] == Decimal("0.00")
    assert totals["total_amount"] == Decimal("0.00")


def test_rounding_boundary_exact_half():
    # Exact 0.00500 should round up to 0.01 under ROUND_HALF_UP
    assert quantize_money("0.005") == Decimal("0.01")
    assert quantize_money("0.015") == Decimal("0.02")
    assert quantize_money("0.025") == Decimal("0.03")
    assert quantize_money("0.035") == Decimal("0.04")
    assert quantize_money("0.045") == Decimal("0.05")
    # Sub-half rounds down
    assert quantize_money("0.004999") == Decimal("0.00")


def test_large_permitted_amounts():
    # Subtotal in millions
    item = calculate_line_item(
        quantity="1000",
        unit_price="999999.99",
        discount_percent="2.50",
        tax_rate="5.00",
    )
    # line_subtotal = 999,999,990.00
    assert item["line_subtotal"] == Decimal("999999990.00")
    assert item["line_discount"] == Decimal("24999999.75")
    # taxable = 974,999,990.25
    assert item["line_tax"] == Decimal("48749999.51")
    assert item["line_total"] == Decimal("1023749989.76")


def test_invalid_negative_or_out_of_bounds_inputs():
    with pytest.raises(ValueError):
        calculate_line_item(quantity="-1", unit_price="10.00")

    with pytest.raises(ValueError):
        calculate_line_item(quantity="1", unit_price="-50.00")

    with pytest.raises(ValueError):
        calculate_line_item(quantity="1", unit_price="50.00", discount_percent="-5.00")

    with pytest.raises(ValueError):
        calculate_line_item(quantity="1", unit_price="50.00", discount_percent="105.00")

    with pytest.raises(ValueError):
        calculate_line_item(quantity="1", unit_price="50.00", tax_rate="-1.00")

    with pytest.raises(ValueError):
        calculate_line_item(quantity="1", unit_price="50.00", tax_rate="150.00")

