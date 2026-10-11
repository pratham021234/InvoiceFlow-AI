import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.invoice import Invoice, InvoiceStatus
from app.models.client import Client
from app.models.organization import Organization
from app.models.reminder import EmailLog, EmailType, EmailStatus
from app.models.base import utc_now
from app.services.pdf_service import generate_invoice_pdf
from app.services.audit_service import log_security_event


class EmailConfigurationError(RuntimeError):
    """Raised when email delivery is attempted without configured credentials."""
    pass


def is_email_configured() -> bool:
    """Checks whether the transactional email provider is properly configured."""
    return bool(settings.SMTP_HOST and settings.SMTP_HOST.strip())


def deliver_smtp_message(
    recipient_email: str,
    subject: str,
    html_content: str,
    plain_text: str,
    attachments: Optional[List[Tuple[str, bytes, str]]] = None,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Delivers a message via configured SMTP server with timeout controls.
    Returns: (success: bool, provider_message_id: Optional[str], error_message: Optional[str])
    """
    if not is_email_configured():
        return (
            False,
            None,
            "Email service is not configured. Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD in your environment.",
        )

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>"
    msg["To"] = recipient_email
    provider_msg_id = f"msg_{uuid.uuid4().hex[:16]}"
    msg["Message-ID"] = f"<{provider_msg_id}@{settings.SMTP_HOST}>"

    # Alternative body (text + html)
    body_part = MIMEMultipart("alternative")
    body_part.attach(MIMEText(plain_text, "plain", "utf-8"))
    body_part.attach(MIMEText(html_content, "html", "utf-8"))
    msg.attach(body_part)

    # Attachments
    if attachments:
        for filename, file_bytes, content_type in attachments:
            part = MIMEApplication(file_bytes, Name=filename)
            part["Content-Disposition"] = f'attachment; filename="{filename}"'
            msg.attach(part)

    try:
        # Use timeout=10 to avoid hanging worker threads
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        
        server.send_message(msg)
        server.quit()
        return (True, provider_msg_id, None)
    except Exception as exc:
        return (False, None, f"SMTP delivery failed: {str(exc)}")


def send_invoice_email(
    db: Session,
    organization_id: str,
    invoice_id: str,
    user_id: Optional[str] = None,
    recipient_email: Optional[str] = None,
    custom_subject: Optional[str] = None,
    custom_message: Optional[str] = None,
    attach_pdf: bool = True,
) -> EmailLog:
    """
    Sends an official invoice notification to the client with attached PDF.
    Records delivery status in EmailLog.
    """
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.organization_id == organization_id)
        .first()
    )
    if not invoice:
        raise LookupError("Invoice not found.")

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    client = db.query(Client).filter(Client.id == invoice.client_id).first() if invoice.client_id else None

    target_email = (recipient_email or (client.email if client else None) or "").strip()
    if not target_email:
        raise ValueError("Recipient email address is required. Please specify a valid email address.")

    subject = custom_subject or f"Invoice {invoice.invoice_number} from {org.name if org else 'InvoiceFlow AI'}"

    # Templates
    personal_note = f"<p style='color: #475569; font-style: italic;'>{custom_message}</p>" if custom_message else ""
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
        <h2 style="color: #4f46e5; margin-bottom: 8px;">Invoice {invoice.invoice_number}</h2>
        <p>Dear {client.name if client else 'Customer'},</p>
        <p>Please find attached invoice <strong>{invoice.invoice_number}</strong> for <strong>{invoice.currency} {invoice.total_amount:.2f}</strong>.</p>
        {personal_note}
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Invoice Date:</strong> {invoice.issue_date}</p>
            <p style="margin: 4px 0;"><strong>Due Date:</strong> {invoice.due_date}</p>
            <p style="margin: 4px 0;"><strong>Balance Due:</strong> {invoice.currency} {invoice.balance_due:.2f}</p>
        </div>
        <p>Thank you for your business!</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #64748b;">{org.name if org else 'InvoiceFlow AI'}</p>
    </div>
    """

    plain = f"""
Invoice {invoice.invoice_number}
Dear {client.name if client else 'Customer'},

Please find your invoice {invoice.invoice_number} for {invoice.currency} {invoice.total_amount:.2f}.
Due Date: {invoice.due_date}
Balance Due: {invoice.currency} {invoice.balance_due:.2f}

Thank you for your business!
{org.name if org else ''}
    """

    attachments = []
    if attach_pdf and org and client:
        pdf_bytes = generate_invoice_pdf(invoice=invoice, organization=org, client=client)
        attachments.append((f"{invoice.invoice_number}.pdf", pdf_bytes, "application/pdf"))

    # Initial EmailLog
    email_log = EmailLog(
        organization_id=organization_id,
        invoice_id=invoice.id,
        client_id=invoice.client_id,
        notification_type=EmailType.INVOICE_SEND,
        recipient_email=target_email,
        subject=subject,
        delivery_status=EmailStatus.QUEUED,
        attempt_count=1,
        last_attempt_at=utc_now(),
    )
    db.add(email_log)
    db.flush()

    # Attempt delivery
    success, provider_msg_id, error_msg = deliver_smtp_message(
        recipient_email=target_email,
        subject=subject,
        html_content=html,
        plain_text=plain,
        attachments=attachments,
    )

    if success:
        email_log.delivery_status = EmailStatus.ACCEPTED_BY_PROVIDER
        email_log.provider_message_id = provider_msg_id
        email_log.sent_at = utc_now()
        email_log.error_message = None
    else:
        email_log.delivery_status = EmailStatus.FAILED
        email_log.error_message = error_msg

    db.commit()
    db.refresh(email_log)

    log_security_event(
        db=db,
        organization_id=organization_id,
        action="invoice_email_sent" if success else "invoice_email_failed",
        entity_type="invoice",
        entity_id=invoice.id,
        user_id=user_id,
        details={
            "recipient": target_email,
            "status": email_log.delivery_status.value,
            "provider_message_id": provider_msg_id,
            "error": error_msg,
        },
    )

    if not success and not is_email_configured():
        raise EmailConfigurationError(error_msg)

    return email_log


def send_payment_reminder_email(
    db: Session,
    organization_id: str,
    invoice_id: str,
    user_id: Optional[str] = None,
    custom_message: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> EmailLog:
    """
    Sends a payment reminder for an eligible invoice.
    Enforces idempotency and records provider submission in EmailLog.
    """
    # 1. Idempotency check
    if idempotency_key:
        existing = (
            db.query(EmailLog)
            .filter(
                EmailLog.organization_id == organization_id,
                EmailLog.idempotency_key == idempotency_key,
                EmailLog.delivery_status == EmailStatus.ACCEPTED_BY_PROVIDER,
            )
            .first()
        )
        if existing:
            return existing

    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id, Invoice.organization_id == organization_id)
        .first()
    )
    if not invoice:
        raise LookupError("Invoice not found.")

    if invoice.status in (InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED):
        raise ValueError(f"Cannot send reminders for invoice in '{invoice.status.value}' status.")

    if invoice.balance_due <= 0:
        raise ValueError("Invoice is fully paid. Reminders cannot be sent for settled invoices.")

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    client = db.query(Client).filter(Client.id == invoice.client_id).first() if invoice.client_id else None

    target_email = (client.email if client else "").strip()
    if not target_email:
        raise ValueError("Client has no email address configured for reminders.")

    is_overdue = invoice.effective_status.value == "overdue"
    reminder_prefix = "Overdue Notice" if is_overdue else "Friendly Payment Reminder"
    subject = f"{reminder_prefix}: Invoice {invoice.invoice_number} ({org.name if org else 'InvoiceFlow AI'})"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
        <h2 style="color: {'#e11d48' if is_overdue else '#4f46e5'}; margin-bottom: 8px;">{reminder_prefix}</h2>
        <p>Dear {client.name},</p>
        <p>This is a notice regarding outstanding balance for invoice <strong>{invoice.invoice_number}</strong>.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Invoice Total:</strong> {invoice.currency} {invoice.total_amount:.2f}</p>
            <p style="margin: 4px 0;"><strong>Amount Paid:</strong> {invoice.currency} {invoice.amount_paid:.2f}</p>
            <p style="margin: 4px 0; color: {'#e11d48' if is_overdue else '#d97706'}; font-weight: bold;">
                <strong>Balance Due:</strong> {invoice.currency} {invoice.balance_due:.2f}
            </p>
            <p style="margin: 4px 0;"><strong>Due Date:</strong> {invoice.due_date}</p>
        </div>
        <p>If you have already sent payment, please disregard this notice.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #64748b;">{org.name if org else 'InvoiceFlow AI'}</p>
    </div>
    """

    plain = f"""
{reminder_prefix}: Invoice {invoice.invoice_number}
Dear {client.name},

Please be reminded that balance of {invoice.currency} {invoice.balance_due:.2f} is due for invoice {invoice.invoice_number} on {invoice.due_date}.

Thank you,
{org.name if org else ''}
    """

    email_log = EmailLog(
        organization_id=organization_id,
        invoice_id=invoice.id,
        client_id=invoice.client_id,
        notification_type=EmailType.PAYMENT_REMINDER,
        recipient_email=target_email,
        subject=subject,
        delivery_status=EmailStatus.QUEUED,
        attempt_count=1,
        last_attempt_at=utc_now(),
        idempotency_key=idempotency_key,
    )
    db.add(email_log)
    db.flush()

    success, provider_msg_id, error_msg = deliver_smtp_message(
        recipient_email=target_email,
        subject=subject,
        html_content=html,
        plain_text=plain,
    )

    if success:
        email_log.delivery_status = EmailStatus.ACCEPTED_BY_PROVIDER
        email_log.provider_message_id = provider_msg_id
        email_log.sent_at = utc_now()
        email_log.error_message = None
    else:
        email_log.delivery_status = EmailStatus.FAILED
        email_log.error_message = error_msg

    db.commit()
    db.refresh(email_log)

    log_security_event(
        db=db,
        organization_id=organization_id,
        action="reminder_sent" if success else "reminder_failed",
        entity_type="invoice",
        entity_id=invoice.id,
        user_id=user_id,
        details={
            "recipient": target_email,
            "status": email_log.delivery_status.value,
            "is_overdue": is_overdue,
            "error": error_msg,
        },
    )

    if not success and not is_email_configured():
        raise EmailConfigurationError(error_msg)

    return email_log
