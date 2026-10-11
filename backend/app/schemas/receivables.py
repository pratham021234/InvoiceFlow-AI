from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class AgingBracketSummary(BaseModel):
    bracket: str  # "current", "1_7_days", "8_30_days", "31_60_days", "over_60_days"
    label: str
    total_balance: Decimal
    invoice_count: int


class ReceivablesInvoiceItem(BaseModel):
    id: str
    invoice_number: str
    client_id: str
    client_name: str
    issue_date: date
    due_date: date
    currency: str
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    status: str
    effective_status: str
    days_overdue: int
    aging_bracket: str
    latest_reminder_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ReceivablesSummaryResponse(BaseModel):
    total_receivables: Decimal
    total_overdue: Decimal
    total_collected: Decimal
    total_open_invoices: int
    total_overdue_invoices: int
    brackets: List[AgingBracketSummary]
    invoices: List[ReceivablesInvoiceItem]
    total: int
    skip: int
    limit: int
