"""add notify_phone to hearings

Revision ID: a1c3f0e77b21
Revises: 5b935399f8ef
Create Date: 2026-10-30
"""
from alembic import op
import sqlalchemy as sa

revision = "a1c3f0e77b21"
down_revision = "5b935399f8ef"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hearings", sa.Column("notify_phone", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("hearings", "notify_phone")
