"""
InvoiceFlow AI - Scheduled Reminder Worker
Executes scheduled reminder checks for due/overdue invoices across organizations.
Can be run via cron (e.g. daily at 08:00 UTC) or as a periodic background daemon.
"""

import sys
import time
import argparse
import logging
from app.core.database import SessionLocal
from app.services.reminder_service import process_scheduled_reminders

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("reminder_worker")


def run_once(org_id: str = None):
    logger.info("Starting scheduled reminder run...")
    db = SessionLocal()
    try:
        summary = process_scheduled_reminders(db=db, organization_id=org_id)
        logger.info(
            f"Reminder run complete: Evaluated={summary['total_evaluated']}, "
            f"Sent={summary['sent']}, Skipped={summary['skipped']}, Failed={summary['failed']}"
        )
        return summary
    except Exception as exc:
        logger.error(f"Error during reminder execution: {exc}", exc_info=True)
        raise
    finally:
        db.close()


def run_daemon(interval_seconds: int = 3600):
    logger.info(f"Starting reminder daemon with interval {interval_seconds}s...")
    while True:
        try:
            run_once()
        except Exception as e:
            logger.error(f"Worker iteration error: {e}")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="InvoiceFlow AI Reminder Worker")
    parser.add_argument("--daemon", action="store_true", help="Run in continuous daemon mode")
    parser.add_argument("--interval", type=int, default=3600, help="Daemon sleep interval in seconds")
    parser.add_argument("--org-id", type=str, default=None, help="Filter by specific organization UUID")
    args = parser.parse_args()

    if args.daemon:
        run_daemon(interval_seconds=args.interval)
    else:
        run_once(org_id=args.org_id)
