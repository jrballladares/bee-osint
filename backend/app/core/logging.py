import logging
import sys
from types import FrameType

from loguru import logger

from app.core.config import settings


class InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame: FrameType | None = logging.currentframe()
        depth = 2

        while frame is not None and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level,
            record.getMessage(),
        )


def setup_logging() -> None:
    intercept_handler = InterceptHandler()

    # Root logger
    logging.root.handlers = [intercept_handler]
    logging.root.setLevel(settings.LOG_LEVEL)

    # Uvicorn + FastAPI (igual que el primero)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        _logger = logging.getLogger(name)
        _logger.handlers = [intercept_handler]
        _logger.propagate = False

    logger.remove()

    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )

    def add_request_id(record: dict) -> None:
        record["extra"].setdefault("request_id", "-")

    logger.configure(patcher=add_request_id)

    if settings.LOG_JSON:
        logger.add(
            sys.stdout,
            format="{extra[request_id]} {message}",
            level=settings.LOG_LEVEL,
            serialize=True,
            backtrace=False,
            diagnose=False,
        )
    else:
        logger.add(
            sys.stdout,
            format=log_format,
            level=settings.LOG_LEVEL,
            backtrace=False,
            diagnose=False,
            colorize=True,
        )

    logger.info("Logging configured successfully.")
