import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from database import SessionLocal, User
from integrations import send_slack_briefing

logger = logging.getLogger("convometrics.scheduler")

scheduler = BackgroundScheduler()


def weekly_briefing_job():
    logger.info("Starting weekly briefing job...")
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for user in users:
            try:
                send_slack_briefing(user, db)
            except Exception as e:
                logger.error(f"Briefing failed for {user.email}: {e}")
        logger.info(f"Weekly briefing job complete. Processed {len(users)} users.")
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(
        weekly_briefing_job,
        CronTrigger(day_of_week="mon", hour=9, minute=0),
        id="weekly_briefing",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started — weekly briefing runs Monday 09:00 UTC")


def shutdown_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
