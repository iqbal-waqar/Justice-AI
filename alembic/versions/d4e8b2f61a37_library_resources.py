"""library resources

Revision ID: d4e8b2f61a37
Revises: c7d21a4e9b10
Create Date: 2026-11-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e8b2f61a37'
down_revision: Union[str, Sequence[str], None] = 'c7d21a4e9b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'library_resources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('firm_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=40), nullable=False),
        sa.Column('tags', sa.Text(), nullable=True),
        sa.Column('language', sa.String(length=20), nullable=True),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('stored_name', sa.String(length=80), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('page_count', sa.Integer(), nullable=True),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['firm_id'], ['firms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stored_name'),
    )
    op.create_index(op.f('ix_library_resources_id'), 'library_resources', ['id'], unique=False)
    op.create_index(op.f('ix_library_resources_firm_id'), 'library_resources', ['firm_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_library_resources_firm_id'), table_name='library_resources')
    op.drop_index(op.f('ix_library_resources_id'), table_name='library_resources')
    op.drop_table('library_resources')
