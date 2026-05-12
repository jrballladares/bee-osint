from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    dashboard,
    graphs,
    news,
    notes,
    osint_sources,
    records,
    word_lists,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(osint_sources.router, prefix="/osint-sources", tags=["OSINT Sources"])
api_router.include_router(news.router, prefix="/news", tags=["News"])
api_router.include_router(notes.router, prefix="/notes", tags=["Notes"])
api_router.include_router(records.router, prefix="/records", tags=["Records"])
api_router.include_router(word_lists.router, prefix="/word-lists", tags=["Word Lists"])
api_router.include_router(graphs.router, prefix="/graphs", tags=["Graphs"])
api_router.include_router(
    graphs.router,
    prefix="/graph",
    tags=["Graph"],
    include_in_schema=False,
)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
