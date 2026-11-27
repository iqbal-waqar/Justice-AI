"""daily legal tip: tips table and per-user delivery settings

Revision ID: a8c4e2f7b9d1
Revises: f7a3d9c4e1b2
Create Date: 2026-11-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8c4e2f7b9d1'
down_revision: Union[str, Sequence[str], None] = 'f7a3d9c4e1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'daily_tips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tip_date', sa.Date(), nullable=False),
        sa.Column('lang', sa.String(length=2), nullable=False),
        sa.Column('theme', sa.String(length=120), nullable=False),
        sa.Column('title', sa.String(length=160), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('takeaway', sa.String(length=300), nullable=True),
        sa.Column('question', sa.String(length=300), nullable=False),
        sa.Column('source_title', sa.String(length=300), nullable=True),
        sa.Column('source_citation', sa.String(length=200), nullable=True),
        sa.Column('source_court', sa.String(length=120), nullable=True),
        sa.Column('source_year', sa.String(length=10), nullable=True),
        sa.Column('source_url', sa.String(length=600), nullable=True),
        sa.Column('source_doc_type', sa.String(length=40), nullable=True),
        sa.Column('sent_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tip_date', 'lang', name='uq_daily_tip_date_lang'),
    )
    op.create_index(op.f('ix_daily_tips_id'), 'daily_tips', ['id'], unique=False)
    op.create_index(op.f('ix_daily_tips_tip_date'), 'daily_tips', ['tip_date'], unique=False)

    op.add_column('users', sa.Column('tip_email', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('users', sa.Column('tip_whatsapp', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('users', sa.Column('tip_language', sa.String(length=2), server_default='en', nullable=False))
    op.add_column('users', sa.Column('tip_last_sent_on', sa.Date(), nullable=True))


def downgrade() -> None:
    for col in ('tip_last_sent_on', 'tip_language', 'tip_whatsapp', 'tip_email'):
        op.drop_column('users', col)
    op.drop_index(op.f('ix_daily_tips_tip_date'), table_name='daily_tips')
    op.drop_index(op.f('ix_daily_tips_id'), table_name='daily_tips')
    op.drop_table('daily_tips')
