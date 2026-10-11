import io
from datetime import datetime
from decimal import Decimal
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)
from reportlab.pdfgen import canvas
from app.models.invoice import Invoice
from app.models.organization import Organization
from app.models.client import Client


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print 'Page X of Y' in the footer."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(letter[0] - 36, 25, page_text)
        self.drawString(36, 25, "Generated securely by InvoiceFlow AI")
        self.restoreState()


def format_amount(amount: Decimal, currency: str = "USD") -> str:
    return f"{currency} {amount:,.2f}"


def generate_invoice_pdf(
    invoice: Invoice,
    organization: Organization,
    client: Client,
) -> bytes:
    """
    Renders a banking-grade, professional invoice PDF into a byte string.
    """
    buffer = io.BytesIO()

    # 0.5-inch margins (36 pt)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0f172a"),
    )

    h2_style = ParagraphStyle(
        "Header2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#1e293b"),
    )

    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#334155"),
    )

    body_muted = ParagraphStyle(
        "BodyMuted",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1e293b"),
    )

    table_cell_right = ParagraphStyle(
        "TableCellRight",
        parent=table_cell_style,
        alignment=2,  # Right aligned
    )

    table_cell_bold_right = ParagraphStyle(
        "TableCellBoldRight",
        parent=table_cell_right,
        fontName="Helvetica-Bold",
    )

    story = []

    # 1. Header: Organization Info (Left) and Invoice Metadata (Right)
    org_info = [
        Paragraph(organization.name, h2_style),
    ]
    if organization.address:
        org_info.append(Paragraph(organization.address.replace("\n", "<br/>"), body_muted))
    if organization.email:
        org_info.append(Paragraph(f"Email: {organization.email}", body_muted))
    if organization.phone:
        org_info.append(Paragraph(f"Phone: {organization.phone}", body_muted))
    if organization.tax_id:
        org_info.append(Paragraph(f"Tax ID: {organization.tax_id}", body_muted))

    status_str = invoice.status.value.upper()
    invoice_meta = [
        Paragraph("INVOICE", title_style),
        Paragraph(f"<b>Invoice #:</b> {invoice.invoice_number}", body_style),
        Paragraph(f"<b>Issue Date:</b> {invoice.issue_date.strftime('%B %d, %Y')}", body_style),
        Paragraph(f"<b>Due Date:</b> {invoice.due_date.strftime('%B %d, %Y')}", body_style),
        Paragraph(f"<b>Status:</b> {status_str}", body_style),
    ]

    header_table = Table(
        [[org_info, invoice_meta]],
        colWidths=[280, 260],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 15))

    # 2. Bill To: Client Info Box
    client_info = [
        Paragraph("<b>BILLED TO:</b>", body_muted),
        Paragraph(f"<b>{client.name}</b>", body_style),
    ]
    if client.contact_name:
        client_info.append(Paragraph(f"Attn: {client.contact_name}", body_style))
    if client.billing_address:
        client_info.append(Paragraph(client.billing_address.replace("\n", "<br/>"), body_muted))
    if client.email:
        client_info.append(Paragraph(f"Email: {client.email}", body_muted))
    if client.tax_id:
        client_info.append(Paragraph(f"Client Tax ID: {client.tax_id}", body_muted))

    client_table = Table(
        [[client_info]],
        colWidths=[540],
    )
    client_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(client_table)
    story.append(Spacer(1, 15))

    # 3. Line Items Table
    col_widths = [230, 50, 70, 60, 55, 75]
    table_data = [
        [
            Paragraph("DESCRIPTION", table_header_style),
            Paragraph("QTY", table_header_style),
            Paragraph("UNIT PRICE", table_header_style),
            Paragraph("DISC %", table_header_style),
            Paragraph("TAX %", table_header_style),
            Paragraph("TOTAL", table_header_style),
        ]
    ]

    for it in invoice.items:
        table_data.append([
            Paragraph(it.description, table_cell_style),
            Paragraph(f"{it.quantity:g}", table_cell_right),
            Paragraph(format_amount(it.unit_price, invoice.currency), table_cell_right),
            Paragraph(f"{it.discount_percent:g}%" if it.discount_percent > 0 else "—", table_cell_right),
            Paragraph(f"{it.tax_rate:g}%" if it.tax_rate > 0 else "—", table_cell_right),
            Paragraph(format_amount(it.line_total, invoice.currency), table_cell_bold_right),
        ])

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 12))

    # 4. Financial Totals Section
    totals_data = [
        [Paragraph("Subtotal:", table_cell_style), Paragraph(format_amount(invoice.subtotal, invoice.currency), table_cell_right)],
    ]
    if invoice.discount_amount > Decimal("0.00"):
        totals_data.append([
            Paragraph("Total Discounts:", table_cell_style),
            Paragraph(f"-{format_amount(invoice.discount_amount, invoice.currency)}", table_cell_right),
        ])
    if invoice.tax_amount > Decimal("0.00"):
        totals_data.append([
            Paragraph("Total Taxes:", table_cell_style),
            Paragraph(format_amount(invoice.tax_amount, invoice.currency), table_cell_right),
        ])

    totals_data.append([
        Paragraph("<b>Grand Total:</b>", table_cell_style),
        Paragraph(f"<b>{format_amount(invoice.total_amount, invoice.currency)}</b>", table_cell_bold_right),
    ])
    totals_data.append([
        Paragraph("Amount Paid:", table_cell_style),
        Paragraph(format_amount(invoice.amount_paid, invoice.currency), table_cell_right),
    ])
    totals_data.append([
        Paragraph("<b>Balance Due:</b>", h2_style),
        Paragraph(f"<b>{format_amount(invoice.balance_due, invoice.currency)}</b>", table_cell_bold_right),
    ])

    totals_table = Table(totals_data, colWidths=[120, 120])
    totals_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#f1f5f9")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e0e7ff")),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))

    # Place notes on the left, totals table on the right
    notes_blocks = []
    if invoice.payment_terms:
        notes_blocks.append(Paragraph(f"<b>Payment Terms:</b> {invoice.payment_terms}", body_style))
        notes_blocks.append(Spacer(1, 4))
    if invoice.notes:
        notes_blocks.append(Paragraph(f"<b>Notes:</b> {invoice.notes}", body_muted))
        notes_blocks.append(Spacer(1, 4))
    if organization.payment_instructions:
        notes_blocks.append(Paragraph(f"<b>Payment Instructions:</b> {organization.payment_instructions}", body_muted))

    notes_and_totals = Table(
        [[notes_blocks, totals_table]],
        colWidths=[300, 240],
    )
    notes_and_totals.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
    ]))

    story.append(KeepTogether([notes_and_totals]))

    # Build document using NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes
