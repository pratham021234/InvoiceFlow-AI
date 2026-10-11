import os
import re
import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.invoice import Invoice, InvoiceStatus
from app.models.client import Client
from app.models.organization import Organization
from app.models.payment import Payment, PaymentStatus
from app.core.decimal_utils import quantize_money
from app.services.analytics_service import (
    get_analytics_summary,
    get_client_performance_report,
    get_aging_analytics,
)
from app.schemas.ai import (
    AISummaryResponse,
    AIDraftReminderResponse,
    AINaturalQueryResponse,
)


def is_openai_configured() -> bool:
    """Checks if external OpenAI provider is configured with an active key."""
    return (
        settings.AI_PROVIDER.lower() == "openai"
        and bool(settings.OPENAI_API_KEY)
        and settings.OPENAI_API_KEY.strip() != ""
        and not settings.OPENAI_API_KEY.startswith("sk-your-openai")
    )


def generate_financial_summary(
    db: Session,
    organization_id: str,
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    currency: Optional[str] = None,
) -> AISummaryResponse:
    """
    Generates an authoritative executive receivables summary.
    Uses backend-calculated ground truth data and enhances with AI if configured.
    """
    summary_data = get_analytics_summary(
        db=db,
        organization_id=organization_id,
        start_date=start_date,
        end_date=end_date,
        preset="30d",
        currency=currency,
    )
    aging_data = get_aging_analytics(db=db, organization_id=organization_id, currency=currency)
    client_report = get_client_performance_report(
        db=db, organization_id=organization_id, limit=5, sort_by="outstanding_balance", currency=currency
    )

    curr = summary_data.currency
    inv_amt = summary_data.invoiced_amount
    coll_amt = summary_data.payments_collected
    out_amt = summary_data.outstanding_receivables
    od_amt = summary_data.overdue_receivables
    coll_rate = summary_data.collection_rate

    # Pre-computed key insights
    insights = [
        f"Invoiced {curr} {inv_amt:.2f} with {curr} {coll_amt:.2f} collected in the evaluated 30-day window (Collection Rate: {coll_rate}%).",
        f"Total active outstanding receivables stand at {curr} {out_amt:.2f}, of which {curr} {od_amt:.2f} is currently past due.",
    ]

    top_debtors = [c for c in client_report.items if c.outstanding_balance > Decimal("0.00")]
    if top_debtors:
        top_names = ", ".join([f"{c.client_name} ({curr} {c.outstanding_balance:.2f})" for c in top_debtors[:3]])
        insights.append(f"Top outstanding exposure is concentrated in: {top_names}.")
    else:
        insights.append("All client accounts are currently settled with zero outstanding exposure.")

    # Recommended actions
    actions = []
    if summary_data.overdue_invoices_count > 0:
        actions.append(
            f"Review and dispatch payment reminders to {summary_data.overdue_invoices_count} overdue invoice accounts."
        )
    if top_debtors:
        actions.append(f"Prioritize direct phone or email follow-up with {top_debtors[0].client_name}.")
    actions.append("Export current monthly receivables summary CSV for executive cashflow review.")

    # Base executive text
    exec_summary = (
        f"Receivables Portfolio Overview: Over the evaluated 30-day period, your organization invoiced "
        f"{curr} {inv_amt:.2f} and collected {curr} {coll_amt:.2f}. Outstanding receivables total {curr} {out_amt:.2f}, "
        f"with {curr} {od_amt:.2f} ({summary_data.overdue_invoices_count} invoices) past due. "
        f"Your portfolio collection efficiency is currently {coll_rate}%."
    )

    # Optional OpenAI enhancement if configured
    if is_openai_configured():
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            prompt = (
                f"You are a financial controller assistant for a SaaS business. "
                f"Based strictly on these authorized figures, write a concise 2-sentence executive summary:\n"
                f"- Currency: {curr}\n"
                f"- Invoiced (30d): {inv_amt:.2f}\n"
                f"- Collected (30d): {coll_amt:.2f}\n"
                f"- Outstanding: {out_amt:.2f}\n"
                f"- Overdue: {od_amt:.2f}\n"
                f"- Overdue Invoices Count: {summary_data.overdue_invoices_count}\n"
                f"Do not hallucinate or modify numbers. Keep tone professional."
            )
            response = client.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=200,
            )
            if response.choices and response.choices[0].message.content:
                exec_summary = response.choices[0].message.content.strip()
                return AISummaryResponse(
                    summary=exec_summary,
                    key_insights=insights,
                    recommended_actions=actions,
                    is_mock=False,
                    provider="OpenAI (" + settings.AI_MODEL + ")",
                )
        except Exception:
            # Graceful fallback to deterministic controller summary on network or rate limit errors
            pass

    return AISummaryResponse(
        summary=exec_summary,
        key_insights=insights,
        recommended_actions=actions,
        is_mock=True,
        provider="Internal Financial Rules Engine",
    )


def draft_payment_reminder(
    db: Session,
    organization_id: str,
    invoice_id: str,
    tone: str = "professional",
    custom_instructions: Optional[str] = None,
) -> AIDraftReminderResponse:
    """
    Drafts an editable payment reminder message based strictly on authorized database records.
    Supports selectable tone: 'friendly', 'professional', or 'firm'.
    """
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.organization_id == organization_id)
        .first()
    )
    if not invoice:
        raise LookupError("Invoice not found or access denied.")

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    client = db.query(Client).filter(Client.id == invoice.client_id).first() if invoice.client_id else None

    client_name = client.name if client else "Valued Client"
    client_email = (client.email if client else "") or ""
    org_name = org.name if org else "Our Company"
    currency = invoice.currency
    balance = quantize_money(invoice.balance_due)
    due_date_str = str(invoice.due_date) if invoice.due_date else "upon receipt"

    today = datetime.date.today()
    days_od = (today - invoice.due_date).days if (invoice.due_date and invoice.due_date < today) else 0

    clean_tone = tone.lower().strip()
    if clean_tone not in ("friendly", "professional", "firm"):
        clean_tone = "professional"

    # Deterministic templates matching business tone
    if clean_tone == "friendly":
        subject = f"Friendly reminder: Invoice {invoice.invoice_number} from {org_name}"
        body = (
            f"Hi {client_name},\n\n"
            f"We hope you are having a great week! This is just a quick, friendly reminder that invoice "
            f"{invoice.invoice_number} for {currency} {balance:.2f} was due on {due_date_str}.\n\n"
            f"If payment is already on its way, please disregard this note. If you have any questions or need "
            f"an updated copy of the invoice, feel free to reply directly to this email.\n\n"
            f"Warm regards,\n{org_name}"
        )
    elif clean_tone == "firm":
        subject = f"OVERDUE NOTICE: Immediate settlement required for Invoice {invoice.invoice_number}"
        days_note = f" (now {days_od} days past due)" if days_od > 0 else ""
        body = (
            f"Dear {client_name},\n\n"
            f"Our records indicate that invoice {invoice.invoice_number} in the amount of {currency} {balance:.2f} "
            f"remains unpaid and is currently overdue{days_note}. The original due date was {due_date_str}.\n\n"
            f"Please arrange for immediate settlement of this balance via bank transfer or credit card to ensure "
            f"uninterrupted services and avoid escalation to our collections department.\n\n"
            f"If payment has already been remitted, please provide the transfer transaction reference.\n\n"
            f"Sincerely,\nFinance Department\n{org_name}"
        )
    else:  # professional
        subject = f"Payment Reminder: Invoice {invoice.invoice_number} - {org_name}"
        body = (
            f"Dear {client_name},\n\n"
            f"This is a reminder regarding outstanding invoice {invoice.invoice_number} for {currency} {balance:.2f}, "
            f"which was due on {due_date_str}.\n\n"
            f"Please review the attached invoice details and remit payment according to the agreed terms. "
            f"If you have already processed this transaction, please let us know so we can update our records.\n\n"
            f"Thank you for your prompt attention to this matter.\n\n"
            f"Best regards,\n{org_name}"
        )

    # Optional OpenAI refinement if configured
    if is_openai_configured():
        try:
            from openai import OpenAI
            client_ai = OpenAI(api_key=settings.OPENAI_API_KEY)
            prompt = (
                f"You are a professional billing specialist. Draft an email reminder for an invoice with these verified details:\n"
                f"- Organization: {org_name}\n"
                f"- Client: {client_name}\n"
                f"- Invoice Number: {invoice.invoice_number}\n"
                f"- Balance Due: {currency} {balance:.2f}\n"
                f"- Due Date: {due_date_str}\n"
                f"- Days Overdue: {days_od}\n"
                f"- Requested Tone: {clean_tone}\n"
                f"- Custom Instruction: {custom_instructions or 'Standard reminder'}\n"
                f"Format as Subject: [Subject line]\nBody:\n[Body text]"
            )
            resp = client_ai.chat.completions.create(
                model=settings.AI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=350,
            )
            content = resp.choices[0].message.content if resp.choices else ""
            if "Subject:" in content and "Body:" in content:
                parts = content.split("Body:", 1)
                subj_line = parts[0].replace("Subject:", "").strip()
                body_text = parts[1].strip()
                return AIDraftReminderResponse(
                    invoice_id=invoice.id,
                    invoice_number=invoice.invoice_number,
                    client_name=client_name,
                    recipient_email=client_email,
                    balance_due=f"{balance:.2f}",
                    currency=currency,
                    due_date=due_date_str,
                    subject=subj_line,
                    body=body_text,
                    tone=clean_tone,
                    is_mock=False,
                )
        except Exception:
            pass

    return AIDraftReminderResponse(
        invoice_id=invoice.id,
        invoice_number=invoice.invoice_number,
        client_name=client_name,
        recipient_email=client_email,
        balance_due=f"{balance:.2f}",
        currency=currency,
        due_date=due_date_str,
        subject=subject,
        body=body,
        tone=clean_tone,
        is_mock=True,
    )


def answer_natural_language_query(
    db: Session,
    organization_id: str,
    query_text: str,
) -> AINaturalQueryResponse:
    """
    Answers read-only financial questions using validated intent matching and trusted analytics.
    STRICT SECURITY RULE: Never executes arbitrary or LLM-generated SQL against the database.
    """
    q_norm = query_text.lower().strip()
    today = datetime.date.today()
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    currency = org.currency if org else "USD"

    # Intent 1: "How much collected this month?" / "Collections this month"
    if any(k in q_norm for k in ["collected this month", "collection this month", "revenue this month", "how much did i collect"]):
        data = get_analytics_summary(db=db, organization_id=organization_id, preset="current_month")
        ans = (
            f"During the current month ({data.start_date.strftime('%B %Y')}), your organization has collected "
            f"a total of {data.currency} {data.payments_collected:.2f} across verified payments."
        )
        return AINaturalQueryResponse(
            query=query_text,
            intent="collections_current_month",
            answer=ans,
            supporting_data={
                "collected": str(data.payments_collected),
                "currency": data.currency,
                "period": data.start_date.strftime("%B %Y"),
            },
            is_mock=not is_openai_configured(),
        )

    # Intent 2: "Which invoices are overdue?" / "Overdue invoices"
    elif any(k in q_norm for k in ["overdue", "past due", "late invoices"]):
        overdue_invoices = (
            db.query(Invoice, Client)
            .join(Client, Invoice.client_id == Client.id)
            .filter(
                Invoice.organization_id == organization_id,
                Invoice.status.notin_([InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.PAID]),
                Invoice.due_date < today,
                Invoice.balance_due > Decimal("0.00"),
            )
            .order_by(Invoice.due_date)
            .all()
        )

        if not overdue_invoices:
            ans = "Great news! You currently have zero overdue invoices in this workspace."
            items_data = []
        else:
            total_od = sum((inv.balance_due for inv, _ in overdue_invoices), Decimal("0.00"))
            details = [
                f"{inv.invoice_number} ({client.name}: {inv.currency} {inv.balance_due:.2f}, due {inv.due_date})"
                for inv, client in overdue_invoices[:5]
            ]
            ans = (
                f"You have {len(overdue_invoices)} overdue invoice(s) totaling {currency} {total_od:.2f}. "
                f"Top overdue: {'; '.join(details)}."
            )
            items_data = [
                {"invoice_number": inv.invoice_number, "client": client.name, "balance": str(inv.balance_due), "due_date": str(inv.due_date)}
                for inv, client in overdue_invoices[:10]
            ]

        return AINaturalQueryResponse(
            query=query_text,
            intent="overdue_invoices",
            answer=ans,
            supporting_data={"count": len(overdue_invoices), "items": items_data},
            is_mock=not is_openai_configured(),
        )

    # Intent 3: "Which clients owe the most?" / "Top debtor clients" / "Largest outstanding"
    elif any(k in q_norm for k in ["clients owe", "debtor", "largest balance", "who owes", "top clients"]):
        report = get_client_performance_report(
            db=db, organization_id=organization_id, limit=5, sort_by="outstanding_balance"
        )
        debtors = [c for c in report.items if c.outstanding_balance > Decimal("0.00")]

        if not debtors:
            ans = "None of your clients currently have an outstanding balance."
            debtor_list = []
        else:
            names = [f"{c.client_name} ({currency} {c.outstanding_balance:.2f})" for c in debtors[:3]]
            ans = f"The clients with the largest outstanding balances are: {', '.join(names)}."
            debtor_list = [{"client": c.client_name, "balance": str(c.outstanding_balance)} for c in debtors]

        return AINaturalQueryResponse(
            query=query_text,
            intent="largest_debtors",
            answer=ans,
            supporting_data={"debtors": debtor_list},
            is_mock=not is_openai_configured(),
        )

    # Intent 4: "Compare with last month" / "MoM comparison"
    elif any(k in q_norm for k in ["compare", "last month", "month over month", "trend"]):
        data = get_analytics_summary(db=db, organization_id=organization_id, preset="current_month")
        mom_c = data.mom_collected
        change_text = (
            f"up {mom_c.percentage_change}%"
            if (mom_c.percentage_change or Decimal("0")) > 0
            else f"down {abs(mom_c.percentage_change or Decimal('0'))}%"
        )
        ans = (
            f"Collections this month are {data.currency} {mom_c.current:.2f} compared to {data.currency} "
            f"{mom_c.prior:.2f} in the previous period, representing a change of {change_text} "
            f"({data.currency} {mom_c.absolute_change:+.2f})."
        )
        return AINaturalQueryResponse(
            query=query_text,
            intent="mom_comparison",
            answer=ans,
            supporting_data={"current": str(mom_c.current), "prior": str(mom_c.prior), "change": str(mom_c.percentage_change)},
            is_mock=not is_openai_configured(),
        )

    # Default Intent: General Portfolio Health Check
    else:
        data = get_analytics_summary(db=db, organization_id=organization_id, preset="30d")
        ans = (
            f"Portfolio Snapshot: Over the last 30 days, your business invoiced {data.currency} {data.invoiced_amount:.2f} "
            f"and collected {data.currency} {data.payments_collected:.2f}. Outstanding receivables currently total "
            f"{data.currency} {data.outstanding_receivables:.2f} with {data.currency} {data.overdue_receivables:.2f} overdue."
        )
        return AINaturalQueryResponse(
            query=query_text,
            intent="general_snapshot",
            answer=ans,
            supporting_data={
                "invoiced": str(data.invoiced_amount),
                "collected": str(data.payments_collected),
                "outstanding": str(data.outstanding_receivables),
                "overdue": str(data.overdue_receivables),
            },
            is_mock=not is_openai_configured(),
        )
