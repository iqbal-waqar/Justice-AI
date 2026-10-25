"""
Notification service — sends hearing reminders via Gmail SMTP and WhatsApp (Twilio).
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

# ── Twilio Config ──────────────────────────────────────────────────
TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")


class NotificationService:
    def get_twilio_client(self):
        from twilio.rest import Client

        return Client(TWILIO_SID, TWILIO_TOKEN)

    def format_whatsapp_address(self, value: str) -> str:
        address = value.strip()
        if address.startswith("whatsapp:"):
            return address
        return f"whatsapp:{address}"

    def normalize_phone(self, to_phone: str) -> str:
        phone = to_phone.strip().replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            phone = "+92" + phone.lstrip("0")
        return phone

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
        """Send a WhatsApp hearing reminder via Twilio."""
        if not TWILIO_SID or not TWILIO_TOKEN or not TWILIO_WHATSAPP_FROM:
            print("⚠️ Twilio not configured — skipping WhatsApp notification")
            return False

        if not to_phone:
            return False

        phone = self.normalize_phone(to_phone)
        client = self.get_twilio_client()
        whatsapp_from = self.format_whatsapp_address(TWILIO_WHATSAPP_FROM)

        urgency = "🔴 TOMORROW" if days_until == 1 else f"🟡 In {days_until} days"
        date_str = hearing_date.strftime("%A, %B %d, %Y")
        time_str = hearing_time if hearing_time else "Not specified"

        message_body = f"""⚖️ *JusticeAI — Hearing Reminder*

{urgency}

📋 *Case:* {case_title}
🏛️ *Court:* {court or 'Not specified'}
📅 *Date:* {date_str}
🕐 *Time:* {time_str}

Dear {user_name}, please ensure all documents are prepared for your upcoming hearing.

_Sent by JusticeAI — Pakistan's Legal Intelligence Platform_"""

        try:
            msg = client.messages.create(
                from_=whatsapp_from,
                body=message_body,
                to=self.format_whatsapp_address(phone),
            )
            print(f"📱 WhatsApp reminder sent to {phone} (SID: {msg.sid}, status: {getattr(msg, 'status', 'unknown')})")
            return True
        except Exception as error:
            print(f"🔴 WhatsApp send failed to {phone}: {error}")
            return False

    def send_whatsapp_verification(self, to_phone: str, code: str):
        """Send a 6-digit verification code via WhatsApp."""
        if not TWILIO_SID or not TWILIO_TOKEN or not TWILIO_WHATSAPP_FROM:
            print("⚠️ Twilio not configured — skipping WhatsApp verification")
            return False

        client = self.get_twilio_client()
        whatsapp_from = self.format_whatsapp_address(TWILIO_WHATSAPP_FROM)

        message_body = f"""⚖️ *JusticeAI — Phone Verification*

Your verification code is:

🔐 *{code}*

This code expires in 5 minutes. Do not share it with anyone.

_JusticeAI — Pakistan's Legal Intelligence Platform_"""

        try:
            msg = client.messages.create(
                from_=whatsapp_from,
                body=message_body,
                to=self.format_whatsapp_address(to_phone),
            )
            print(f"📱 Verification code sent to {to_phone} (SID: {msg.sid}, status: {getattr(msg, 'status', 'unknown')})")
            return True
        except Exception as error:
            print(f"🔴 WhatsApp verification failed to {to_phone}: {error}")
            return False

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
