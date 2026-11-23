"""email verification code on users

Revision ID: c7d21a4e9b10
Revises: 300b575a1376
Create Date: 2026-11-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d21a4e9b10'
down_revision: Union[str, Sequence[str], None] = '300b575a1376'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Accounts that already exist are treated as verified, so nobody is locked out.
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.alter_column('users', 'email_verified', server_default=sa.false())
    op.add_column('users', sa.Column('email_code_hash', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('email_code_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('email_code_sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('email_code_attempts', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    for col in ('email_code_attempts', 'email_code_sent_at', 'email_code_expires_at', 'email_code_hash', 'email_verified'):
        op.drop_column('users', col)
