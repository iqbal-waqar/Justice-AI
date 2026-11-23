"""Client statement of account as a PDF (reportlab)."""
import io
from datetime import datetime
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

GOLD = colors.HexColor("#a67c2e")
INK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#64748b")
LINE = colors.HexColor("#e2e8f0")


def _pkr(v) -> str:
    if v is None:
        return ""
    v = Decimal(v)
    s = f"{abs(v):,.2f}"
    return f"({s})" if v < 0 else s


def _esc(text) -> str:
    return (str(text or "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_statement_pdf(st: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=16 * mm, bottomMargin=18 * mm,
                            title=f"Statement - {st['client'].name}", author=st["firm_name"])
    ss = getSampleStyleSheet()
    h_firm = ParagraphStyle("firm", parent=ss["Title"], fontSize=17, textColor=INK, alignment=0, spaceAfter=2)
    h_doc = ParagraphStyle("doc", parent=ss["Normal"], fontSize=10, textColor=GOLD, spaceAfter=10)
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=9, leading=12, textColor=INK)
    small = ParagraphStyle("small", parent=body, fontSize=8, textColor=MUTED)
    cell = ParagraphStyle("cell", parent=body, fontSize=8.5, leading=10.5)
    right = ParagraphStyle("right", parent=cell, alignment=TA_RIGHT)

    c = st["client"]
    period = "All dates"
    if st["date_from"] or st["date_to"]:
        period = f"{st['date_from'].strftime('%d %b %Y') if st['date_from'] else 'Beginning'} to " \
                 f"{st['date_to'].strftime('%d %b %Y') if st['date_to'] else 'today'}"

    story = [
        Paragraph(_esc(st["firm_name"]), h_firm),
        Paragraph("STATEMENT OF ACCOUNT", h_doc),
    ]
    details = [
        [Paragraph("<b>Client</b>", body), Paragraph(_esc(c.name), body),
         Paragraph("<b>Period</b>", body), Paragraph(period, body)],
        [Paragraph("<b>Phone</b>", body), Paragraph(_esc(c.phone or "-"), body),
         Paragraph("<b>Issued</b>", body), Paragraph(datetime.now().strftime("%d %b %Y"), body)],
        [Paragraph("<b>Email</b>", body), Paragraph(_esc(c.email or "-"), body),
         Paragraph("<b>Currency</b>", body), Paragraph("PKR", body)],
    ]
    t = Table(details, colWidths=[20 * mm, 70 * mm, 22 * mm, 66 * mm])
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    story += [t, Spacer(1, 8 * mm)]

    rows = [[Paragraph(f"<b>{h}</b>", right if i >= 3 else cell) for i, h in
             enumerate(["Date", "Particulars", "Reference", "Charges", "Payments", "Balance"])]]
    rows.append([Paragraph("", cell), Paragraph("<b>Opening balance</b>", cell), Paragraph("", cell),
                 Paragraph("", right), Paragraph("", right), Paragraph(f"<b>{_pkr(st['opening'])}</b>", right)])
    for ln in st["lines"]:
        particulars = f"<b>{_esc(ln['type'])}</b> — {_esc(ln['description'])}"
        if ln["matter"]:
            particulars += f"<br/><font color='#64748b'>Case: {_esc(ln['matter'])}</font>"
        rows.append([
            Paragraph(ln["date"].strftime("%d %b %Y"), cell), Paragraph(particulars, cell),
            Paragraph(_esc(ln["reference"] or ""), cell),
            Paragraph(_pkr(ln["charge"]) if ln["charge"] is not None else "", right),
            Paragraph(_pkr(ln["payment"]) if ln["payment"] is not None else "", right),
            Paragraph(_pkr(ln["balance"]), right),
        ])
    rows.append([Paragraph("", cell), Paragraph("<b>Totals for the period</b>", cell), Paragraph("", cell),
                 Paragraph(f"<b>{_pkr(st['total_charges'])}</b>", right),
                 Paragraph(f"<b>{_pkr(st['total_payments'])}</b>", right), Paragraph("", right)])
    table = Table(rows, colWidths=[22 * mm, 70 * mm, 22 * mm, 22 * mm, 22 * mm, 22 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, GOLD),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, LINE),
        ("LINEABOVE", (0, -1), (-1, -1), 0.8, INK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [table, Spacer(1, 6 * mm)]

    closing = Decimal(st["closing"])
    label = "Balance due from client" if closing > 0 else ("Advance held for client" if closing < 0 else "Account settled")
    box = Table([[Paragraph(f"<b>{label}</b>", body), Paragraph(f"<b>PKR {_pkr(abs(closing))}</b>", ParagraphStyle(
        "big", parent=body, fontSize=12, alignment=TA_RIGHT, textColor=INK))]], colWidths=[118 * mm, 62 * mm])
    box.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, GOLD),
                             ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fffbeb")),
                             ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 7),
                             ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    story += [box, Spacer(1, 6 * mm)]

    notes = ["Only entries approved under the firm's maker-checker process are included. "
             "Amounts in brackets are credits in the client's favour."]
    if st["pending_excluded"]:
        notes.append(f"{st['pending_excluded']} entr{'y is' if st['pending_excluded'] == 1 else 'ies are'} "
                     "awaiting approval and not included.")
    notes.append(f"Generated by {_esc(st['generated_by'])} with Justice AI.")
    story += [Paragraph(" ".join(notes), small)]

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(16 * mm, 10 * mm, f"{st['firm_name']} — Statement of account for {c.name}")
        canvas.drawRightString(A4[0] - 16 * mm, 10 * mm, f"Page {d.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
