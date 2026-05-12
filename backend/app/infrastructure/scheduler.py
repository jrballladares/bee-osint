from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger

from app.core.config import settings
from app.infrastructure.database import SessionLocal
from app.services.news_service import NewsService


async def news_scraping_job() -> None:
    logger.info("Starting scheduled news scraping job...")
    db = SessionLocal()
    try:
        service = NewsService(db)
        await service.fetch_and_store_news()
        logger.info("Scheduled news scraping job completed successfully.")
    except Exception:
        logger.exception("Error during scheduled news scraping job.")
    finally:
        db.close()


def create_scheduler() -> AsyncIOScheduler:
    interval_minutes = max(1, settings.FETCH_INTERVAL_MINUTES)
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        news_scraping_job,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="news_scraping_job",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
        next_run_time=datetime.now(),
    )
    return scheduler
