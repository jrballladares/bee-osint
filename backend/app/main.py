from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

import bcrypt

if not hasattr(bcrypt, "__about__"):

    class BcryptAbout:
        __version__ = bcrypt.__version__

    bcrypt.__about__ = BcryptAbout()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.handlers import register_exception_handlers
from app.core.logging import setup_logging
from app.core.middleware.logging import LoggingMiddleware
from app.core.middleware.request_id import RequestIdMiddleware
from app.infrastructure.scheduler import create_scheduler


def ensure_upload_directories() -> None:
    Path("static/uploads/records").mkdir(parents=True, exist_ok=True)
    Path("static/uploads/notes").mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    ensure_upload_directories()

    scheduler = create_scheduler()
    scheduler.start()
    logger.info(
        "Scheduler initialized. News scraping job interval: {} minute(s).",
        settings.FETCH_INTERVAL_MINUTES,
    )

    yield

    scheduler.shutdown()
    logger.info("Scheduler shutdown complete.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    swagger_ui_parameters=settings.SWAGGER_UI_PARAMETERS,
    lifespan=lifespan,
)

app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(api_router, prefix=settings.API_V1_STR)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": settings.VERSION}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.HOST, port=settings.PORT)
