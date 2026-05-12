"""drop news sentiment

Revision ID: drop_news_sentiment
Revises: 603b2ecc06a8
Create Date: 2026-05-07 23:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "drop_news_sentiment"
down_revision: str | None = "603b2ecc06a8"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute('DROP INDEX IF EXISTS "ix_news_sentiment"')
    op.execute('ALTER TABLE "news" DROP COLUMN IF EXISTS "sentiment"')


def downgrade() -> None:
    op.add_column("news", sa.Column("sentiment", sa.String(), nullable=True))
    op.create_index("ix_news_sentiment", "news", ["sentiment"], unique=False)
