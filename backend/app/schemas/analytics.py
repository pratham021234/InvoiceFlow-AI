from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class DateRangeParams(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    preset: Optional[str] = Field(None, description="Preset range: 30d, 90d, current_month, last_month, current_year, all")
    currency: Optional[str] = None


class MomChangeMetric(BaseModel):
    current: Decimal
    prior: Decimal
    absolute_change: Decimal
    percentage_change: Optional[Decimal] = None  # None if prior was 0 and current is 0


class AnalyticsSummaryResponse(BaseModel):
    currency: str
    start_date: date
    end_date: date
    invoiced_amount: Decimal
    payments_collected: Decimal
    outstanding_receivables: Decimal
    overdue_receivables: Decimal
    partially_paid_amount: Decimal
    collection_rate: Decimal  # Percentage (0-100)
    average_collection_days: Optional[Decimal] = None  # Days to settlement for paid invoices
    active_invoices_count: int
    overdue_invoices_count: int
    paid_invoices_count: int
    mom_invoiced: MomChangeMetric
    mom_collected: MomChangeMetric

    model_config = ConfigDict(from_attributes=True)


class MonthlyTrendItem(BaseModel):
    period: str  # e.g. "2026-09"
    period_label: str  # e.g. "Sep 2026"
    invoiced_amount: Decimal
    collected_amount: Decimal
    net_difference: Decimal
    invoice_count: int
    payment_count: int


class RevenueTrendsResponse(BaseModel):
    currency: str
    items: List[MonthlyTrendItem]
    total_invoiced: Decimal
    total_collected: Decimal


class AgingBracketMetric(BaseModel):
    bracket: str
    label: str
    total_balance: Decimal
    invoice_count: int
    percentage_of_receivables: Decimal


class AgingAnalyticsResponse(BaseModel):
    currency: str
    total_receivables: Decimal
    total_overdue: Decimal
    brackets: List[AgingBracketMetric]


class StatusDistributionItem(BaseModel):
    status: str
    label: str
    count: int
    total_amount: Decimal
    percentage: Decimal


class StatusDistributionResponse(BaseModel):
    currency: str
    total_invoices: int
    items: List[StatusDistributionItem]


class ClientPerformanceItem(BaseModel):
    client_id: str
    client_name: str
    email: Optional[str] = None
    currency: str
    total_invoiced: Decimal
    total_collected: Decimal
    outstanding_balance: Decimal
    overdue_balance: Decimal
    invoice_count: int
    overdue_invoice_count: int
    average_settlement_days: Optional[Decimal] = None
    latest_payment_date: Optional[date] = None


class ClientPerformanceResponse(BaseModel):
    items: List[ClientPerformanceItem]
    total: int
    skip: int
    limit: int
