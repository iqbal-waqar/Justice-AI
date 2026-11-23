"""client portal and lawyer directory

Revision ID: e5f1c2a9b7d3
Revises: d4e8b2f61a37
Create Date: 2026-11-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f1c2a9b7d3'
down_revision: Union[str, Sequence[str], None] = 'd4e8b2f61a37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Lawyer's public profile for "Find a lawyer"
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('practice_areas', sa.String(length=300), nullable=True))
    op.add_column('users', sa.Column('experience_years', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('courts', sa.String(length=300), nullable=True))
    op.add_column('users', sa.Column('languages', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('directory_listed', sa.Boolean(), server_default='false', nullable=False))

    # A hearing may belong to a case
    op.add_column('hearings', sa.Column('matter_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_hearings_matter', 'hearings', 'matters', ['matter_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_hearings_matter_id'), 'hearings', ['matter_id'], unique=False)

    op.create_table(
        'case_shares',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('firm_id', sa.Integer(), nullable=False),
        sa.Column('matter_id', sa.Integer(), nullable=False),
        sa.Column('client_email', sa.String(length=255), nullable=False),
        sa.Column('shared_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['firm_id'], ['firms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['matter_id'], ['matters.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shared_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('matter_id', 'client_email', name='uq_case_share_matter_email'),
    )
    op.create_index(op.f('ix_case_shares_id'), 'case_shares', ['id'], unique=False)
    op.create_index(op.f('ix_case_shares_firm_id'), 'case_shares', ['firm_id'], unique=False)
    op.create_index(op.f('ix_case_shares_matter_id'), 'case_shares', ['matter_id'], unique=False)
    op.create_index(op.f('ix_case_shares_client_email'), 'case_shares', ['client_email'], unique=False)

    op.create_table(
        'client_logins',
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('code_hash', sa.String(length=64), nullable=True),
        sa.Column('code_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('code_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('code_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('email'),
    )


def downgrade() -> None:
    op.drop_table('client_logins')
    op.drop_index(op.f('ix_case_shares_client_email'), table_name='case_shares')
    op.drop_index(op.f('ix_case_shares_matter_id'), table_name='case_shares')
    op.drop_index(op.f('ix_case_shares_firm_id'), table_name='case_shares')
    op.drop_index(op.f('ix_case_shares_id'), table_name='case_shares')
    op.drop_table('case_shares')
    op.drop_index(op.f('ix_hearings_matter_id'), table_name='hearings')
    op.drop_constraint('fk_hearings_matter', 'hearings', type_='foreignkey')
    op.drop_column('hearings', 'matter_id')
    for col in ('directory_listed', 'languages', 'courts', 'experience_years', 'practice_areas', 'bio'):
        op.drop_column('users', col)
