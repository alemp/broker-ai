"""APScheduler callback: refresh adequacy snapshots for all organizations."""

from __future__ import annotations

from ai_copilot_api.db.session import new_session
from ai_copilot_api.domain.adequacy_batch import refresh_all_organizations_adequacy


def run_scheduled_adequacy_refresh() -> None:
    db = new_session()
    try:
        refresh_all_organizations_adequacy(db)
    finally:
        db.close()
