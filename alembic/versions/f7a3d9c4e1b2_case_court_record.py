"""case court record (auto-fill from court websites)

Revision ID: f7a3d9c4e1b2
Revises: e5f1c2a9b7d3
Create Date: 2026-11-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7a3d9c4e1b2'
down_revision: Union[str, Sequence[str], None] = 'e5f1c2a9b7d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = (
    sa.Column('district', sa.String(length=60), nullable=True),
    sa.Column('court_type', sa.String(length=100), nullable=True),
    sa.Column('judge', sa.String(length=300), nullable=True),
    sa.Column('category', sa.String(length=200), nullable=True),
    sa.Column('stage', sa.String(length=200), nullable=True),
    sa.Column('filed_on', sa.Date(), nullable=True),
    sa.Column('next_hearing', sa.Date(), nullable=True),
    sa.Column('fir_number', sa.String(length=40), nullable=True),
    sa.Column('fir_year', sa.String(length=4), nullable=True),
    sa.Column('police_station', sa.String(length=120), nullable=True),
    sa.Column('source', sa.String(length=40), nullable=True),
    sa.Column('source_url', sa.String(length=500), nullable=True),
    sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('assigned_to', sa.Integer(), nullable=True),
)


def upgrade() -> None:
    for col in COLUMNS:
        op.add_column('matters', col)
    op.create_foreign_key('fk_matters_assigned_to', 'matters', 'users', ['assigned_to'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_matters_assigned_to', 'matters', type_='foreignkey')
    for col in reversed(COLUMNS):
        op.drop_column('matters', col.name)
