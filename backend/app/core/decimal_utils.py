from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Union

# Standard financial precision constants
TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")


def to_decimal(val: Union[int, float, str, Decimal, None], default: str = "0.00") -> Decimal:
    """Safely convert any numeric value or string to Decimal."""
    if val is None or val == "":
        return Decimal(default)
    if isinstance(val, Decimal):
        return val
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal(default)


def quantize_money(amount: Union[Decimal, str, int, float]) -> Decimal:
    """
    Quantize monetary amounts strictly to 2 decimal places using ROUND_HALF_UP.
    Example: 10.005 -> 10.01, 10.004 -> 10.00
    """
    d = to_decimal(amount)
    return d.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def quantize_rate(rate: Union[Decimal, str, int, float]) -> Decimal:
    """
    Quantize tax / discount percentage rates to 4 decimal places using ROUND_HALF_UP.
    Example: 8.25% -> 8.2500%
    """
    d = to_decimal(rate)
    return d.quantize(FOUR_PLACES, rounding=ROUND_HALF_UP)


class LineItemCalculation:
    def __init__(
        self,
        quantity: Decimal,
        unit_price: Decimal,
        discount_percent: Decimal = Decimal("0.00"),
        tax_rate: Decimal = Decimal("0.00"),
    ):
        self.quantity = to_decimal(quantity)
        self.unit_price = quantize_money(unit_price)
        self.discount_percent = to_decimal(discount_percent)
        self.tax_rate = to_decimal(tax_rate)

        if self.quantity <= Decimal("0.0000"):
            raise ValueError("Quantity must be greater than zero.")
        if self.unit_price < Decimal("0.00"):
            raise ValueError("Unit price cannot be negative.")
        if self.discount_percent < Decimal("0.00") or self.discount_percent > Decimal("100.00"):
            raise ValueError("Discount percent must be between 0 and 100.")
        if self.tax_rate < Decimal("0.00") or self.tax_rate > Decimal("100.00"):
            raise ValueError("Tax rate must be between 0 and 100.")

        # 1. Base Subtotal = quantity * unit_price
        self.line_subtotal = quantize_money(self.quantity * self.unit_price)

        # 2. Line Discount = line_subtotal * (discount_percent / 100)
        if self.discount_percent > Decimal("0.00"):
            discount_fraction = self.discount_percent / Decimal("100.00")
            self.line_discount = quantize_money(self.line_subtotal * discount_fraction)
        else:
            self.line_discount = Decimal("0.00")

        # 3. Taxable Amount after discount
        self.taxable_amount = quantize_money(max(Decimal("0.00"), self.line_subtotal - self.line_discount))

        # 4. Line Tax = taxable_amount * (tax_rate / 100)
        if self.tax_rate > Decimal("0.00"):
            tax_fraction = self.tax_rate / Decimal("100.00")
            self.line_tax = quantize_money(self.taxable_amount * tax_fraction)
        else:
            self.line_tax = Decimal("0.00")

        # 5. Line Total = taxable_amount + line_tax
        self.line_total = quantize_money(self.taxable_amount + self.line_tax)


class InvoiceTotalsCalculation:
    def __init__(
        self,
        items: List[LineItemCalculation],
        additional_discount_amount: Decimal = Decimal("0.00"),
    ):
        self.items = items
        self.additional_discount = quantize_money(additional_discount_amount)

        # Aggregate line item calculations
        self.subtotal = quantize_money(sum((item.line_subtotal for item in items), Decimal("0.00")))
        self.line_discounts_total = quantize_money(sum((item.line_discount for item in items), Decimal("0.00")))
        self.total_discount = quantize_money(self.line_discounts_total + self.additional_discount)
        self.tax_amount = quantize_money(sum((item.line_tax for item in items), Decimal("0.00")))
        
        # Grand total = (Subtotal - Line Discounts - Additional Discount) + Total Tax
        taxable_base = quantize_money(max(Decimal("0.00"), self.subtotal - self.total_discount))
        self.total_amount = quantize_money(taxable_base + self.tax_amount)


def calculate_line_item(
    quantity: Union[Decimal, int, float, str],
    unit_price: Union[Decimal, int, float, str],
    discount_percent: Union[Decimal, int, float, str] = 0,
    tax_rate: Union[Decimal, int, float, str] = 0,
) -> Dict[str, Decimal]:
    calc = LineItemCalculation(
        quantity=to_decimal(quantity),
        unit_price=to_decimal(unit_price),
        discount_percent=to_decimal(discount_percent),
        tax_rate=to_decimal(tax_rate),
    )
    return {
        "quantity": calc.quantity,
        "unit_price": calc.unit_price,
        "discount_percent": calc.discount_percent,
        "tax_rate": calc.tax_rate,
        "line_subtotal": calc.line_subtotal,
        "line_discount": calc.line_discount,
        "taxable_amount": calc.taxable_amount,
        "line_tax": calc.line_tax,
        "line_total": calc.line_total,
    }


def calculate_invoice_totals(
    items_data: List[Dict[str, Any]],
    additional_discount_amount: Union[Decimal, int, float, str] = 0,
) -> Dict[str, Any]:
    calculated_items = []
    for item in items_data:
        calc = LineItemCalculation(
            quantity=to_decimal(item.get("quantity", 1)),
            unit_price=to_decimal(item.get("unit_price", 0)),
            discount_percent=to_decimal(item.get("discount_percent", 0)),
            tax_rate=to_decimal(item.get("tax_rate", 0)),
        )
        calculated_items.append(calc)

    invoice_calc = InvoiceTotalsCalculation(
        items=calculated_items,
        additional_discount_amount=to_decimal(additional_discount_amount),
    )

    return {
        "subtotal": invoice_calc.subtotal,
        "discount_amount": invoice_calc.total_discount,
        "tax_amount": invoice_calc.tax_amount,
        "total_amount": invoice_calc.total_amount,
        "items": [
            {
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "discount_percent": it.discount_percent,
                "tax_rate": it.tax_rate,
                "line_subtotal": it.line_subtotal,
                "line_discount": it.line_discount,
                "line_tax": it.line_tax,
                "line_total": it.line_total,
            }
            for it in calculated_items
        ],
    }


def validate_and_calculate_payment(
    total_amount: Union[Decimal, str, int, float],
    current_amount_paid: Union[Decimal, str, int, float],
    payment_amount: Union[Decimal, str, int, float],
    allow_overpayment: bool = False,
) -> Dict[str, Any]:
    """
    Safely calculates new balance and checks overpayment constraints.
    Returns: {
        "is_valid": bool,
        "error": Optional[str],
        "new_amount_paid": Decimal,
        "new_balance_due": Decimal,
        "is_fully_paid": bool
    }
    """
    total = quantize_money(total_amount)
    current_paid = quantize_money(current_amount_paid)
    pmt = quantize_money(payment_amount)

    if pmt <= Decimal("0.00"):
        return {
            "is_valid": False,
            "error": "Payment amount must be greater than zero.",
            "new_amount_paid": current_paid,
            "new_balance_due": quantize_money(total - current_paid),
            "is_fully_paid": False,
        }

    current_balance = quantize_money(total - current_paid)
    if not allow_overpayment and pmt > current_balance:
        return {
            "is_valid": False,
            "error": f"Payment amount ({pmt}) exceeds remaining balance ({current_balance}).",
            "new_amount_paid": current_paid,
            "new_balance_due": current_balance,
            "is_fully_paid": False,
        }

    new_paid = quantize_money(current_paid + pmt)
    new_balance = quantize_money(max(Decimal("0.00"), total - new_paid))
    is_fully_paid = (new_balance == Decimal("0.00"))

    return {
        "is_valid": True,
        "error": None,
        "new_amount_paid": new_paid,
        "new_balance_due": new_balance,
        "is_fully_paid": is_fully_paid,
    }
