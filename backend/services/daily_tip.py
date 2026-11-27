"""Daily legal tip — a short, sourced point of Pakistani law every morning.

Every day at 10:00 Pakistan time (DAILY_TIP_HOUR) each lawyer gets one tip by
email and WhatsApp, in the language they chose. The tip is not a canned list:
the day's theme is searched in the research corpus (statutes, court rules and
judgments in Qdrant), the model writes a title, two or three sentences and a
question from that passage only, and the passage's citation and link travel
with the tip so a lawyer can verify it in one tap.

    daily_tip_service.ensure_tip(date.today(), "en")   # generate (or reuse) the day's tip
    daily_tip_service.send_to_all()                     # the 10 am job
    daily_tip_service.send_to_user(user, db)            # "send me today's tip now"
"""
import html
import os
import re
from datetime import date, datetime
from typing import List, Optional
from urllib.parse import quote

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database.db import SessionLocal
from backend.database.migrations.daily_tip import DailyTip
from backend.database.migrations.user import User
from backend.services.llm import llm_service
from backend.services.notifications import notification_service

# The areas of law the tip rotates through. One theme per day, in order, so a month never repeats.
THEMES = [
    "Bail after arrest under section 497 CrPC: when bail is a right and when it is discretionary",
    "Limitation: time limits for filing a civil suit, appeal and revision and condonation of delay",
    "Maintenance of wife and children under the Family Courts Act and the Muslim Family Laws Ordinance",
    "Pre-arrest (anticipatory) bail under section 498 CrPC: conditions and mala fide",
    "Specific performance of an agreement to sell immovable property and readiness and willingness",
    "Acquittal under section 265-K CrPC at any stage when there is no probability of conviction",
    "Khula and dissolution of marriage: grounds and return of dower",
    "Temporary injunction under Order 39 CPC: prima facie case, balance of convenience, irreparable loss",
    "Section 22-A CrPC: Justice of Peace directing registration of an FIR",
    "Succession certificate and letters of administration for the estate of a deceased",
    "Ejectment of a tenant under the Punjab Rented Premises Act: default, personal need, subletting",
    "Quashing of an FIR under section 561-A CrPC and the High Court's inherent powers",
    "Proof of documents and the burden of proof under the Qanun-e-Shahadat Order 1984",
    "Compromise and compounding of offences under section 345 CrPC, including Qisas and Diyat",
    "Guardianship and custody of minors: welfare of the minor under the Guardians and Wards Act",
    "Amendment of pleadings under Order 6 Rule 17 CPC and when it is refused",
    "Cancellation of bail under section 497(5) CrPC: misuse of concession and new grounds",
    "Execution of a decree: objections, attachment and sale under Order 21 CPC",
    "Confession before a magistrate under section 164 CrPC and its evidentiary value",
    "Pre-emption under the Punjab Pre-emption Act: talbs and their timely performance",
    "Writ jurisdiction under Article 199 of the Constitution: alternate remedy and laches",
    "Dower (haq mehr): prompt and deferred dower and the wife's right to recover it",
    "Dishonoured cheque under section 489-F PPC: ingredients and defences",
    "Appeal against acquittal: the standard the appellate court applies",
    "Rejection of plaint under Order 7 Rule 11 CPC: barred by law and no cause of action",
    "Benefit of doubt in criminal trials: a single reasonable doubt is enough",
    "Partition of joint immovable property and the preliminary decree",
    "Right of a female heir to inheritance and the limitation to challenge a fraudulent mutation",
    "Contempt of court and non-compliance with court orders",
    "Review and revision: the difference and the grounds for each",
    "Juvenile Justice System Act: age determination and bail of a juvenile",
]
CORPUS_TYPES = ["federal_law", "punjab_law", "court_rules", "sc_case", "lhc_case", "isb_case"]
_LABEL = {"federal_law": "Federal statute", "punjab_law": "Punjab statute", "court_rules": "Court rules",
          "sc_case": "Supreme Court", "lhc_case": "Lahore High Court", "isb_case": "Islamabad High Court", "district_case": "District court"}


class _TipDraft(BaseModel):
    title: str = Field(description="A headline of at most 70 characters that states the practical rule itself (for example: Succession certificate: file where the deceased lived, with every heir's CNIC). Not a news-style sentence. No quotes.")
    body: str = Field(description="Two or three plain sentences a practising lawyer finds useful, drawn only from the passage. Cite the section or case inside the text.")
    takeaway: str = Field(description="One line, at most 120 characters: the single thing to remember.")
    question: str = Field(description="A question the lawyer can ask Justice AI next, at most 120 characters, about a specific situation.")


def _theme_for(day: date) -> str:
    return THEMES[day.toordinal() % len(THEMES)]


def _search(theme: str) -> List[dict]:
    from backend.services.tools import _hybrid_search, _rerank
    cands = _hybrid_search(theme, top_k=30, doc_type_filter=CORPUS_TYPES)
    return _rerank(theme, cands, top_k=3, max_chunks_per_case=1) if cands else []


def _source_fields(doc: dict) -> dict:
    m = doc.get("metadata", {})
    return {
        "source_title": (m.get("case_title") or m.get("title") or "")[:300] or None,
        "source_citation": (m.get("citation") or m.get("case_number") or "")[:200] or None,
        "source_court": (m.get("court") or _LABEL.get(m.get("doc_type"), ""))[:120] or None,
        "source_year": str(m.get("year") or "")[:10] or None,
        "source_url": (m.get("pdf_url") or m.get("profile_url") or "")[:600] or None,
        "source_doc_type": m.get("doc_type"),
    }


class DailyTipService:
    # ── generation ──
    def ensure_tip(self, day: date, lang: str, db: Optional[Session] = None) -> DailyTip:
        own = db is None
        db = db or SessionLocal()
        try:
            tip = db.query(DailyTip).filter(DailyTip.tip_date == day, DailyTip.lang == lang).first()
            if tip:
                return tip
            tip = self._generate(day, lang)
            db.add(tip)
            db.commit()
            db.refresh(tip)
            return tip
        finally:
            if own:
                db.close()

    def _generate(self, day: date, lang: str) -> DailyTip:
        theme = _theme_for(day)
        docs = _search(theme)
        if not docs:
            raise RuntimeError("the research corpus returned nothing for today's theme")
        passages = "\n\n".join(
            f"[{i + 1}] {d['metadata'].get('case_title') or d['metadata'].get('title')} "
            f"({_LABEL.get(d['metadata'].get('doc_type'), '')}{', ' + str(d['metadata'].get('year')) if d['metadata'].get('year') else ''})\n"
            f"{(d.get('content') or '')[:2200]}"
            for i, d in enumerate(docs))
        language = "Urdu (natural, as a Pakistani lawyer writes it; keep statute names and section numbers as they are)" if lang == "ur" else "English"
        prompt = (
            "You write the Justice AI daily legal tip for practising lawyers in Pakistan.\n"
            f"Today's theme: {theme}\n\n"
            "Write ONLY from the passages below. Do not add rules, sections or cases that are not in them. "
            "If a passage states a test or a time limit, give it exactly. Name the section or case in the body.\n"
            f"Write in {language}. Be concrete and practical, never generic.\n\n"
            f"PASSAGES\n{passages}"
        )
        draft: _TipDraft = llm_service.get_llm().with_structured_output(_TipDraft).invoke(prompt)
        lead = docs[0]
        return DailyTip(tip_date=day, lang=lang, theme=theme[:120], title=draft.title.strip()[:160], body=draft.body.strip(),
                        takeaway=draft.takeaway.strip()[:300] or None, question=draft.question.strip()[:300], **_source_fields(lead))

    # ── formats ──
    @staticmethod
    def _app_url() -> str:
        return os.getenv("APP_URL", "http://localhost:5173").rstrip("/")

    def _ask_link(self, tip: DailyTip) -> str:
        return f"{self._app_url()}/chat?q={quote(tip.question)}"

    def _source_line(self, tip: DailyTip) -> str:
        parts = [tip.source_title, tip.source_citation if tip.source_citation and tip.source_citation != tip.source_title else None,
                 " ".join(x for x in (tip.source_court, tip.source_year) if x) or None]
        return " · ".join(p for p in parts if p)

    def email_html(self, tip: DailyTip, first_name: str) -> str:
        ur = tip.lang == "ur"
        esc = html.escape
        d = tip.tip_date.strftime("%A, %d %B %Y")
        t = {
            "eyebrow": "آج کی قانونی نکتہ" if ur else "Daily legal tip",
            "hello": f"السلام علیکم {esc(first_name)}،" if ur else f"Good morning {esc(first_name)},",
            "remember": "یاد رکھیں" if ur else "Remember",
            "source": "ماخذ" if ur else "Source",
            "open": "دستاویز کھولیں" if ur else "Open the document",
            "ask": "جسٹس اے آئی سے پوچھیں" if ur else "Ask Justice AI",
            "next": "اگلا سوال جو آپ پوچھ سکتے ہیں" if ur else "A question you could ask next",
            "manage": "یہ ٹپ روزانہ صبح 10 بجے آتی ہے۔ پروفائل میں چینلز اور زبان بدلیں۔" if ur else "This tip arrives every morning at 10. Change channels or language in your profile.",
            "theme": "موضوع" if ur else "Theme",
        }
        dir_attr = 'dir="rtl"' if ur else 'dir="ltr"'
        font = "'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Segoe UI',Tahoma,sans-serif" if ur else "'Segoe UI',Helvetica,Arial,sans-serif"
        lh = "2" if ur else "1.7"
        source = self._source_line(tip)
        source_block = f"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0;border-collapse:separate;">
          <tr><td style="background:#f7f8fa;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px;">
            <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#845f1f;font-weight:700;margin-bottom:6px;">{t['source']}</div>
            <div style="font-size:14px;line-height:1.5;color:#1c2a40;font-weight:600;">{esc(source or tip.theme)}</div>
            {f'<a href="{esc(tip.source_url)}" style="display:inline-block;margin-top:10px;font-size:13px;color:#845f1f;font-weight:600;text-decoration:none;">{t["open"]} →</a>' if tip.source_url else ''}
          </td></tr>
        </table>"""
        return f"""<!DOCTYPE html>
<html {dir_attr}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{esc(tip.title)}</title></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:{font};color:#1c2a40;">
  <div style="display:none;max-height:0;overflow:hidden;">{esc(tip.takeaway or tip.body[:120])}</div>
  <div style="max-width:600px;margin:0 auto;padding:28px 16px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
      <tr><td style="background:#0b1220;background-image:linear-gradient(135deg,#0b1220 0%,#17243b 100%);border-radius:18px 18px 0 0;padding:28px 32px 26px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;color:#ffffff;">Justice <span style="color:#e3b65a;">AI</span></div>
        <div style="margin-top:18px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#e3b65a;font-weight:700;">{t['eyebrow']}</div>
        <div style="font-size:13px;color:#aab4c5;margin-top:6px;">{d}</div>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 18px 18px;padding:30px 32px 32px;">
        <p style="font-size:15px;line-height:{lh};color:#475569;margin:0 0 14px;">{t['hello']}</p>
        <h1 style="font-family:{'inherit' if ur else "Georgia,'Times New Roman',serif"};font-size:{'24px' if ur else '26px'};line-height:{'1.9' if ur else '1.25'};font-weight:600;color:#0b1220;margin:0 0 18px;">{esc(tip.title)}</h1>
        <div style="height:3px;width:56px;background:#c89a3c;border-radius:2px;margin:0 0 22px;"></div>
        <p style="font-size:16px;line-height:{lh};color:#1c2a40;margin:0;">{esc(tip.body)}</p>
        {f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;border-collapse:separate;"><tr>
          <td style="background:#fff8e8;border-{'right' if ur else 'left'}:4px solid #c89a3c;border-radius:10px;padding:14px 18px;">
            <div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#845f1f;font-weight:700;margin-bottom:4px;">{t['remember']}</div>
            <div style="font-size:15px;line-height:{lh};color:#0b1220;font-weight:600;">{esc(tip.takeaway)}</div>
          </td></tr></table>''' if tip.takeaway else ''}
        {source_block}
        <div style="margin:28px 0 0;padding:20px 0 0;border-top:1px solid #e2e8f0;">
          <div style="font-size:12.5px;color:#64748b;margin-bottom:10px;">{t['next']}</div>
          <div style="font-size:15px;line-height:{lh};color:#1c2a40;font-style:{'normal' if ur else 'italic'};margin-bottom:16px;">“{esc(tip.question)}”</div>
          <a href="{esc(self._ask_link(tip))}" style="display:inline-block;background:#0b1220;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:12px;">{t['ask']} →</a>
        </div>
      </td></tr>
    </table>
    <p style="font-size:12px;line-height:1.7;color:#94a3b8;padding:18px 6px 0;margin:0;">{t['theme']}: {esc(tip.theme)}<br>{t['manage']}<br>
      Justice AI assists legal research and is not a substitute for legal advice.</p>
  </div>
</body></html>"""

    def email_text(self, tip: DailyTip) -> str:
        return f"{tip.title}\n\n{tip.body}\n\n{('Remember: ' + tip.takeaway) if tip.takeaway else ''}\n\nSource: {self._source_line(tip)}\n{tip.source_url or ''}\n\nAsk Justice AI: {self._ask_link(tip)}"

    def whatsapp_text(self, tip: DailyTip, first_name: str) -> str:
        ur = tip.lang == "ur"
        d = tip.tip_date.strftime("%d %b %Y")
        source = self._source_line(tip)
        if ur:
            return (f"⚖️ *جسٹس اے آئی — آج کی قانونی نکتہ*\n_{d}_\n\n"
                    f"*{tip.title}*\n\n{tip.body}\n\n"
                    + (f"💡 *یاد رکھیں:* {tip.takeaway}\n\n" if tip.takeaway else "")
                    + (f"📚 *ماخذ:* {source}\n" if source else "")
                    + (f"{tip.source_url}\n" if tip.source_url else "")
                    + f"\n❓ *اگلا سوال:* {tip.question}\n👉 {self._ask_link(tip)}\n\n"
                    f"_روزانہ صبح 10 بجے۔ پروفائل میں بند کریں۔_")
        return (f"⚖️ *Justice AI — Daily legal tip*\n_{d}_\n\n"
                f"*{tip.title}*\n\n{tip.body}\n\n"
                + (f"💡 *Remember:* {tip.takeaway}\n\n" if tip.takeaway else "")
                + (f"📚 *Source:* {source}\n" if source else "")
                + (f"{tip.source_url}\n" if tip.source_url else "")
                + f"\n❓ *Ask next:* {tip.question}\n👉 {self._ask_link(tip)}\n\n"
                f"_Every morning at 10. Turn off in your profile._")

    # ── delivery ──
    def send_to_user(self, user: User, db: Session, day: Optional[date] = None, force: bool = False) -> dict:
        day = day or date.today()
        lang = user.tip_language if user.tip_language in ("en", "ur") else "en"
        tip = self.ensure_tip(day, lang, db)
        first = (user.full_name or "").split(" ")[0] or ("وکیل صاحب" if lang == "ur" else "Counsel")
        first = re.sub(r"^(Adv\.?|Advocate|Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Barrister)\s*$", "", first, flags=re.I) or first
        out = {"email": False, "whatsapp": False, "tip_id": tip.id}
        if (user.tip_email or force) and (user.notification_email or user.email):
            subject = f"{'⚖️ آج کی قانونی نکتہ' if lang == 'ur' else '⚖️ Daily legal tip'}: {tip.title}"
            out["email"] = notification_service.send_email(user.notification_email or user.email, subject, self.email_html(tip, first), self.email_text(tip))
        if (user.tip_whatsapp or force) and user.phone:
            out["whatsapp"] = self._send_whatsapp(user.phone, tip, first)
        if out["email"] or out["whatsapp"]:
            user.tip_last_sent_on = day
            tip.sent_count = (tip.sent_count or 0) + 1
            db.commit()
        return out

    def _send_whatsapp(self, phone: str, tip: DailyTip, first: str) -> bool:
        template = os.getenv("META_WA_TIP_TEMPLATE_NAME", "").strip()
        if template:
            # Approved template with 5 body parameters: title, body, takeaway, source, ask-link.
            return notification_service.send_whatsapp_template(
                phone, template, lang=os.getenv("META_WA_TIP_TEMPLATE_LANG", "ur" if tip.lang == "ur" else "en"),
                body_params=[tip.title, tip.body, tip.takeaway or "", self._source_line(tip) or tip.theme, self._ask_link(tip)])
        return notification_service.send_whatsapp_text(phone, self.whatsapp_text(tip, first))

    def send_to_all(self) -> dict:
        """The 10 am job: every active lawyer who has not had today's tip yet."""
        day = date.today()
        db = SessionLocal()
        sent = {"email": 0, "whatsapp": 0, "users": 0, "errors": 0}
        try:
            for lang in ("en", "ur"):
                try:
                    self.ensure_tip(day, lang, db)
                except Exception as exc:
                    print(f"🔴 Daily tip ({lang}) could not be generated: {exc}")
            users = (db.query(User).filter(User.is_active.is_(True), (User.tip_email.is_(True)) | (User.tip_whatsapp.is_(True)))
                     .filter((User.tip_last_sent_on.is_(None)) | (User.tip_last_sent_on < day)).all())
            for u in users:
                try:
                    r = self.send_to_user(u, db, day)
                    sent["email"] += int(r["email"]); sent["whatsapp"] += int(r["whatsapp"]); sent["users"] += 1
                except Exception as exc:
                    sent["errors"] += 1
                    print(f"🔴 Daily tip to {u.email} failed: {exc}")
            print(f"📨 Daily tip {day}: {sent}")
            return sent
        finally:
            db.close()


daily_tip_service = DailyTipService()
