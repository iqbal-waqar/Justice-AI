"""
Notification service — sends hearing reminders via Gmail SMTP and
WhatsApp (Meta WhatsApp Cloud API).
"""

import smtplib
import os
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import date
from dotenv import load_dotenv


load_dotenv()


# ── SMTP Config ────────────────────────────────────────────────────
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))


class NotificationService:
    def normalize_phone(self, to_phone: str) -> str:
        phone = to_phone.strip().replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            phone = "+92" + phone.lstrip("0")
        return phone

    # ── Meta WhatsApp Cloud API ─────────────────────────────────────
    def send_whatsapp_template(self, to_phone: str, template_name: str,
                               lang: str = "en_US", body_params: list = None) -> bool:
        """Send an approved template message (delivers without the 24h window)."""
        token = os.getenv("META_WA_TOKEN", "").strip()
        phone_id = os.getenv("META_WA_PHONE_NUMBER_ID", "").strip()
        if not token or not phone_id or not to_phone:
            print("⚠️ Meta WhatsApp not configured — skipping template send")
            return False
        version = os.getenv("META_WA_API_VERSION", "v25.0").strip()
        phone = self.normalize_phone(to_phone).lstrip("+")
        template = {"name": template_name, "language": {"code": lang}}
        if body_params:
            template["components"] = [{
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in body_params],
            }]
        try:
            resp = requests.post(
                f"https://graph.facebook.com/{version}/{phone_id}/messages",
                json={"messaging_product": "whatsapp", "to": phone,
                      "type": "template", "template": template},
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            if resp.status_code == 200:
                print(f"📱 WhatsApp template '{template_name}' sent to +{phone}")
                return True
            print(f"🔴 Template send failed to +{phone}: HTTP {resp.status_code} {resp.text[:300]}")
            return False
        except Exception as error:
            print(f"🔴 Template send failed to +{phone}: {error}")
            return False

    # Test numbers can send free-form text only inside the 24h service
    # window (recipient must have messaged the number once); template
    # messages (e.g. hello_world) deliver to verified recipients anytime.
    def send_whatsapp_text(self, to_phone: str, body: str) -> bool:
        token = os.getenv("META_WA_TOKEN", "").strip()
        phone_id = os.getenv("META_WA_PHONE_NUMBER_ID", "").strip()
        if not token or not phone_id:
            print("⚠️ Meta WhatsApp not configured — skipping WhatsApp notification")
            return False
        if not to_phone:
            return False

        version = os.getenv("META_WA_API_VERSION", "v25.0").strip()
        phone = self.normalize_phone(to_phone).lstrip("+")
        url = f"https://graph.facebook.com/{version}/{phone_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"preview_url": False, "body": body},
        }
        try:
            resp = requests.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            if resp.status_code == 200:
                msg_id = (resp.json().get("messages") or [{}])[0].get("id", "?")
                print(f"📱 WhatsApp sent to +{phone} (id: {msg_id})")
                return True
            print(f"🔴 WhatsApp send failed to +{phone}: HTTP {resp.status_code} {resp.text[:300]}")
            return False
        except Exception as error:
            print(f"🔴 WhatsApp send failed to +{phone}: {error}")
            return False

    def send_whatsapp_reminder(
        self,
        to_phone: str,
        user_name: str,
        case_title: str,
        court: str,
        hearing_date: date,
        hearing_time: str = None,
        days_until: int = 1,
    ):
        """Send a WhatsApp hearing reminder via Meta Cloud API.

        If META_WA_TEMPLATE_NAME is set, send as an approved template — templates
        deliver WITHOUT the 24h service window, so reminders never drop silently.
        The template body must take 5 params: urgency, case, court, date, time.
        Otherwise send free-form text (requires an open 24h window).
        """
        urgency = "🔴 TOMORROW" if days_until == 1 else f"🟡 In {days_until} days"
        date_str = hearing_date.strftime("%A, %B %d, %Y")
        time_str = hearing_time if hearing_time else "Not specified"

        template_name = os.getenv("META_WA_TEMPLATE_NAME", "").strip()
        if template_name:
            return self.send_whatsapp_template(
                to_phone,
                template_name,
                lang=os.getenv("META_WA_TEMPLATE_LANG", "en"),
                body_params=[urgency, case_title, court or "Not specified", date_str, time_str],
            )

        message_body = f"""⚖️ *JusticeAI — Hearing Reminder*

{urgency}

📋 *Case:* {case_title}
🏛️ *Court:* {court or 'Not specified'}
📅 *Date:* {date_str}
🕐 *Time:* {time_str}

Dear {user_name}, please ensure all documents are prepared for your upcoming hearing.

_Sent by JusticeAI — Pakistan's Legal Intelligence Platform_"""

        return self.send_whatsapp_text(to_phone, message_body)

    def send_whatsapp_verification(self, to_phone: str, code: str):
        """Send a 6-digit verification code via WhatsApp."""
        message_body = f"""⚖️ *JusticeAI — Phone Verification*

Your verification code is:

🔐 *{code}*

This code expires in 5 minutes. Do not share it with anyone.

_JusticeAI — Pakistan's Legal Intelligence Platform_"""

        return self.send_whatsapp_text(to_phone, message_body)

    def send_hearing_reminder(
        self,
        to_email: str,
        user_name: str,
        case_title: str,
        court: str,
        hearing_date: date,
        hearing_time: str = None,
        notes: str = None,
        days_until: int = 1,
    ):
        """Send a beautiful HTML hearing reminder email."""
        if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
            print("⚠️ SMTP not configured — skipping email notification")
            return False

        subject = f"⚖️ Hearing Reminder: {case_title} — {'Tomorrow' if days_until == 1 else f'In {days_until} days'}"

        time_str = hearing_time if hearing_time else "Not specified"
        date_str = hearing_date.strftime("%A, %B %d, %Y")
        urgency_color = "#ef4444" if days_until == 1 else "#f59e0b"
        urgency_label = "TOMORROW" if days_until == 1 else f"IN {days_until} DAYS"

        html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
            <div style="max-width:600px;margin:0 auto;padding:24px;">
                <!-- Header -->
                <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:20px 20px 0 0;padding:32px;text-align:center;">
                    <div style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);width:52px;height:52px;border-radius:14px;line-height:52px;margin-bottom:12px;">
                        <span style="font-size:24px;">⚖️</span>
                    </div>
                    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:800;">JusticeAI</h1>
                    <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;">Hearing Reminder</p>
                </div>

                <!-- Body -->
                <div style="background:#fff;padding:32px;border-radius:0 0 20px 20px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                    <!-- Urgency Badge -->
                    <div style="text-align:center;margin-bottom:24px;">
                        <span style="display:inline-block;background:{urgency_color};color:#fff;padding:6px 20px;border-radius:50px;font-size:13px;font-weight:700;letter-spacing:1px;">
                            🔔 {urgency_label}
                        </span>
                    </div>

                    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 24px;">
                        Dear <strong>{user_name}</strong>,<br><br>
                        This is a reminder about your upcoming court hearing:
                    </p>

                    <!-- Hearing Details Card -->
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:24px;">
                        <table style="width:100%;border-collapse:collapse;">
                            <tr>
                                <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                                    <span style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">📋 Case</span><br>
                                    <span style="color:#0f172a;font-size:15px;font-weight:700;">{case_title}</span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                                    <span style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">🏛️ Court</span><br>
                                    <span style="color:#0f172a;font-size:15px;font-weight:600;">{court or 'Not specified'}</span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
                                    <span style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">📅 Date</span><br>
                                    <span style="color:#0f172a;font-size:15px;font-weight:700;">{date_str}</span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:10px 0;">
                                    <span style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">🕐 Time</span><br>
                                    <span style="color:#0f172a;font-size:15px;font-weight:600;">{time_str}</span>
                                </td>
                            </tr>
                        </table>
                    </div>

                    {f'<div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:24px;"><p style="margin:0;color:#854d0e;font-size:13px;"><strong>📝 Notes:</strong> {notes}</p></div>' if notes else ''}

                    <!-- CTA -->
                    <div style="text-align:center;margin-top:8px;">
                        <p style="color:#64748b;font-size:13px;margin:0;">Please ensure all documents are prepared for the hearing.</p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="text-align:center;padding:20px;">
                    <p style="color:#94a3b8;font-size:11px;margin:0;">
                        Sent by JusticeAI — Pakistan's Legal Intelligence Platform<br>
                        This is an automated reminder. Please do not reply.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["From"] = f"JusticeAI ⚖️ <{SMTP_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))

        try:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
                server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
            print(f"✅ Hearing reminder sent to {to_email} for '{case_title}'")
            return True
        except Exception as error:
            print(f"🔴 Failed to send email to {to_email}: {error}")
            return False

    # ── Account emails (verification code, welcome) ──────────────────────
    def email_configured(self) -> bool:
        return bool(SMTP_EMAIL and SMTP_APP_PASSWORD)

    def send_email(self, to_email: str, subject: str, html: str, text: str = "") -> bool:
        """Send one HTML email through the configured SMTP account."""
        if not self.email_configured():
            print("⚠️ SMTP not configured — email not sent")
            return False
        msg = MIMEMultipart("alternative")
        msg["From"] = f"Justice AI <{SMTP_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        if text:
            msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        try:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
                server.starttls()
                server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
                server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
            return True
        except Exception as error:
            print(f"🔴 Failed to send email to {to_email}: {error}")
            return False

    @staticmethod
    def _account_email(heading: str, body_html: str) -> str:
        """Shared light layout for account emails (navy header rule, serif heading)."""
        return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1c2a40;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:600;color:#0b1220;padding:0 4px 18px;">
      Justice <span style="color:#845f1f;">AI</span>
    </div>
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:3px solid #121d2f;border-radius:14px;padding:32px;">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:600;color:#0b1220;margin:0 0 14px;">{heading}</h1>
      {body_html}
    </div>
    <p style="font-size:12px;line-height:1.6;color:#94a3b8;padding:18px 4px 0;margin:0;">
      Justice AI is a legal research and practice-management tool for Pakistani lawyers. It assists research and is not a substitute for legal advice.
    </p>
  </div>
</body></html>"""

    def send_verification_email(self, to_email: str, name: str, code: str, minutes: int = 10) -> bool:
        first = (name or "").strip().split(" ")[0] or "there"
        body = f"""
      <p style="font-size:15px;line-height:1.65;color:#334155;margin:0 0 22px;">Hello {first}, use this code to confirm your email address and finish creating your Justice AI account.</p>
      <div style="background:#f4f6f9;border:1px solid #e8ecf2;border-radius:12px;padding:20px;text-align:center;margin:0 0 22px;">
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#0b1220;font-family:'Courier New',monospace;">{code}</div>
      </div>
      <p style="font-size:14px;line-height:1.65;color:#64748b;margin:0;">The code expires in {minutes} minutes. If you did not sign up for Justice AI, you can ignore this email.</p>"""
        return self.send_email(
            to_email, f"{code} is your Justice AI verification code",
            self._account_email("Confirm your email", body),
            text=f"Your Justice AI verification code is {code}. It expires in {minutes} minutes.",
        )

    def send_client_code_email(self, to_email: str, code: str, minutes: int = 10) -> bool:
        """One-time sign-in code for the client portal (no account, no password)."""
        body = f"""
      <p style="font-size:15px;line-height:1.65;color:#334155;margin:0 0 22px;">Use this code to sign in and see the case your lawyer shared with you on Justice AI.</p>
      <div style="background:#f4f6f9;border:1px solid #e8ecf2;border-radius:12px;padding:20px;text-align:center;margin:0 0 22px;">
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#0b1220;font-family:'Courier New',monospace;">{code}</div>
      </div>
      <p style="font-size:13.5px;line-height:1.6;color:#64748b;margin:0;">The code works for {minutes} minutes. If you did not ask for it, you can ignore this email.</p>"""
        return self.send_email(to_email, f"{code} is your Justice AI sign-in code",
                               self._account_email("Your sign-in code", body),
                               f"Your Justice AI sign-in code is {code}. It works for {minutes} minutes.")

    def send_case_shared_email(self, to_email: str, client_name: str, case_title: str, lawyer_name: str, firm_name: str) -> bool:
        """Tells a client that a lawyer shared a case with them, with the portal link."""
        app_url = os.getenv("APP_URL", "http://localhost:3000").rstrip("/")
        body = f"""
      <p style="font-size:15px;line-height:1.65;color:#334155;margin:0 0 16px;">Dear {client_name or "client"},</p>
      <p style="font-size:15px;line-height:1.65;color:#334155;margin:0 0 22px;"><strong style="color:#0b1220;">{lawyer_name}</strong>{f" of {firm_name}" if firm_name else ""} has shared the case <strong style="color:#0b1220;">{case_title}</strong> with you. You can now see its hearing dates, fees and receipts whenever you like.</p>
      <p style="margin:0 0 22px;"><a href="{app_url}/client" style="display:inline-block;background:#121d2f;color:#ffffff;text-decoration:none;font-weight:600;font-size:14.5px;padding:12px 22px;border-radius:10px;">Open my case</a></p>
      <p style="font-size:13.5px;line-height:1.6;color:#64748b;margin:0;">Sign in with this email address — we will send you a one-time code. No password is needed.</p>"""
        return self.send_email(to_email, f"{lawyer_name} shared a case with you on Justice AI",
                               self._account_email("A case has been shared with you", body),
                               f"{lawyer_name} shared the case '{case_title}' with you. Open {app_url}/client and sign in with this email address.")

    def send_welcome_email(self, to_email: str, name: str) -> bool:
        first = (name or "").strip().split(" ")[0] or "there"
        app_url = os.getenv("APP_URL", "http://localhost:3000").rstrip("/")
        rows = "".join(
            f'<tr><td style="padding:9px 0;font-size:14.5px;line-height:1.55;color:#334155;border-top:1px solid #f1f5f9;">'
            f'<strong style="color:#0b1220;">{title}</strong><br>{text}</td></tr>'
            for title, text in (
                ("Legal research", "Ask a question in English, Urdu or Roman Urdu and get an answer that cites real judgments, each linked to the court record."),
                ("Document vault", "Keep petitions, orders and evidence under the right client and case, encrypted and visible only to your firm."),
                ("Billing", "Record fees, expenses and payments with a second approver, and export statements as PDF."),
                ("Case diary", "Add your hearings and get WhatsApp and email reminders before each date."),
            )
        )
        body = f"""
      <p style="font-size:15px;line-height:1.65;color:#334155;margin:0 0 18px;">Hello {first}, your account is ready. Here is what you can do in your workspace:</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">{rows}</table>
      <a href="{app_url}/chat" style="display:inline-block;background:#121d2f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;">Ask your first question</a>
      <p style="font-size:13.5px;line-height:1.65;color:#64748b;margin:22px 0 0;">Always read the cited judgment before relying on it in court.</p>"""
        return self.send_email(
            to_email, "Welcome to Justice AI",
            self._account_email("Welcome to Justice AI", body),
            text=f"Hello {first}, your Justice AI account is ready. Open your workspace: {app_url}/chat",
        )


notification_service = NotificationService()


def send_whatsapp_reminder(
    to_phone: str,
    user_name: str,
    case_title: str,
    court: str,
    hearing_date: date,
    hearing_time: str = None,
    days_until: int = 1,
):
    return notification_service.send_whatsapp_reminder(
        to_phone=to_phone,
        user_name=user_name,
        case_title=case_title,
        court=court,
        hearing_date=hearing_date,
        hearing_time=hearing_time,
        days_until=days_until,
    )


def send_whatsapp_verification(to_phone: str, code: str):
    return notification_service.send_whatsapp_verification(to_phone=to_phone, code=code)


def send_hearing_reminder(
    to_email: str,
    user_name: str,
    case_title: str,
    court: str,
    hearing_date: date,
    hearing_time: str = None,
    notes: str = None,
    days_until: int = 1,
):
    return notification_service.send_hearing_reminder(
        to_email=to_email,
        user_name=user_name,
        case_title=case_title,
        court=court,
        hearing_date=hearing_date,
        hearing_time=hearing_time,
        notes=notes,
        days_until=days_until,
    )
