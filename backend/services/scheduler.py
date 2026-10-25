"""
Background scheduler — checks for upcoming hearings and sends email + WhatsApp reminders.
Runs every 6 hours. Sends reminders 1 day and 2 days before hearing dates.
"""

from datetime import date, timedelta
from sqlalchemy.orm import Session
from backend.database.db import SessionLocal
from backend.database.migrations.hearing import Hearing
from backend.database.migrations.user import User
from backend.services.notifications import notification_service


class SchedulerService:
    def check_upcoming_hearings(self):
        """Check for hearings 1 or 2 days away and send email + WhatsApp reminders."""
        print("🔔 Checking for upcoming hearings...")
        db: Session = SessionLocal()

        try:
            today = date.today()
            tomorrow = today + timedelta(days=1)
            day_after = today + timedelta(days=2)

            upcoming = (
                db.query(Hearing, User)
                .join(User, Hearing.user_id == User.id)
                .filter(
                    Hearing.hearing_date.in_([tomorrow, day_after]),
                    Hearing.status == "upcoming",
                )
                .all()
            )

            if not upcoming:
                print("  ℹ️ No upcoming hearings in the next 2 days.")
                return

            for hearing, user in upcoming:
                days_until = (hearing.hearing_date - today).days
                reminder_key = f"{days_until}day"

                if hearing.reminder_sent == reminder_key:
                    continue

                to_email = user.notification_email or user.email
                to_phone = user.phone

                if to_email:
                    notification_service.send_hearing_reminder(
                        to_email=to_email,
                        user_name=user.full_name,
                        case_title=hearing.case_title,
                        court=hearing.court or "Not specified",
                        hearing_date=hearing.hearing_date,
                        hearing_time=str(hearing.hearing_time) if hearing.hearing_time else None,
                        notes=hearing.notes,
                        days_until=days_until,
                    )

                if to_phone:
                    notification_service.send_whatsapp_reminder(
                        to_phone=to_phone,
                        user_name=user.full_name,
                        case_title=hearing.case_title,
                        court=hearing.court or "Not specified",
                        hearing_date=hearing.hearing_date,
                        hearing_time=str(hearing.hearing_time) if hearing.hearing_time else None,
                        days_until=days_until,
                    )

                hearing.reminder_sent = reminder_key
                db.commit()
                print(f"  ✅ Reminders sent for '{hearing.case_title}' ({reminder_key})")

        except Exception as error:
            print(f"  🔴 Scheduler error: {error}")
        finally:
            db.close()

        print("🔔 Hearing check complete.")


scheduler_service = SchedulerService()


def check_upcoming_hearings():
    scheduler_service.check_upcoming_hearings()
