"""phase4 payments receivables and email

Revision ID: 2da831fc599b
Revises: 1fc96d5f366e
Create Date: 2026-10-11 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2da831fc599b'
down_revision: Union[str, None] = '1fc96d5f366e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update payments table in batch mode for SQLite/PostgreSQL compatibility
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('currency', sa.String(length=3), server_default='USD', nullable=False))
        batch_op.add_column(sa.Column('payment_status', sa.String(length=20), server_default='completed', nullable=False))
        batch_op.add_column(sa.Column('is_manual', sa.Boolean(), server_default='1', nullable=False))
        batch_op.add_column(sa.Column('created_by_user_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('reversal_reason', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('reversed_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('reversed_by_user_id', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('idempotency_key', sa.String(length=128), nullable=True))
        batch_op.create_index('ix_payments_org_status', ['organization_id', 'payment_status'], unique=False)
        batch_op.create_index('ix_payments_inv_status', ['invoice_id', 'payment_status'], unique=False)
        batch_op.create_index('ix_payments_idempotency_key', ['idempotency_key'], unique=True)

    # 2. Create email_logs table
    op.create_table(
        'email_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('organization_id', sa.String(length=36), nullable=False),
        sa.Column('invoice_id', sa.String(length=36), nullable=True),
        sa.Column('client_id', sa.String(length=36), nullable=True),
        sa.Column('notification_type', sa.String(length=50), server_default='invoice_send', nullable=False),
        sa.Column('recipient_email', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('delivery_status', sa.String(length=50), server_default='queued', nullable=False),
        sa.Column('provider_message_id', sa.String(length=255), nullable=True),
        sa.Column('attempt_count', sa.Integer(), server_default='1', nullable=False),
        sa.Column('last_attempt_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('idempotency_key', sa.String(length=128), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('email_logs', schema=None) as batch_op:
        batch_op.create_index('ix_email_logs_org_status', ['organization_id', 'delivery_status'], unique=False)
        batch_op.create_index('ix_email_logs_org_invoice', ['organization_id', 'invoice_id'], unique=False)
        batch_op.create_index('ix_email_logs_idempotency_key', ['idempotency_key'], unique=True)


def downgrade() -> None:
    op.drop_table('email_logs')
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_index('ix_payments_idempotency_key')
        batch_op.drop_index('ix_payments_inv_status')
        batch_op.drop_index('ix_payments_org_status')
        batch_op.drop_column('idempotency_key')
        batch_op.drop_column('reversed_by_user_id')
        batch_op.drop_column('reversed_at')
        batch_op.drop_column('reversal_reason')
        batch_op.drop_column('created_by_user_id')
        batch_op.drop_column('is_manual')
        batch_op.drop_column('payment_status')
        batch_op.drop_column('currency')
