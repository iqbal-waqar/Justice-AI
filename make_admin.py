"""Grant or revoke the admin role (admin-only endpoints: /ingest, /ingest/stats,
/cache/stats, /cache/clear). Run on the server — there is deliberately no API for this.

    python make_admin.py user@example.com            # grant admin
    python make_admin.py user@example.com --revoke   # back to lawyer
    python make_admin.py --list                      # show current admins
"""
import argparse

from dotenv import load_dotenv
load_dotenv()

from backend.database.db import SessionLocal
from backend.database.migrations.user import User


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("email", nargs="?")
    ap.add_argument("--revoke", action="store_true")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        if args.list:
            admins = db.query(User).filter(User.role == "admin").all()
            print("\n".join(f"  {u.email} ({u.full_name})" for u in admins) or "  (no admins)")
            return
        if not args.email:
            ap.error("email is required")
        user = db.query(User).filter(User.email == args.email.strip().lower()).first() \
            or db.query(User).filter(User.email == args.email.strip()).first()
        if not user:
            raise SystemExit(f"❌ No user with email {args.email!r} — they must sign up first.")
        user.role = "lawyer" if args.revoke else "admin"
        db.commit()
        # Role is read from the DB on every request, so this takes effect immediately.
        print(f"✅ {user.email} is now '{user.role}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
