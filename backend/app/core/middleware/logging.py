import time

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = getattr(request.state, "request_id", "unknown")
        method = request.method
        path = request.url.path

        # Log request start
        with logger.contextualize(request_id=request_id):
            logger.info(f"Incoming request: {method} {path}")

            start_time = time.perf_counter()
            try:
                response = await call_next(request)
            except Exception as exc:
                process_time = (time.perf_counter() - start_time) * 1000
                logger.error(
                    f"Request failed: {method} {path} | duration={process_time:.2f}ms | error={exc}"
                )
                raise

            process_time = (time.perf_counter() - start_time) * 1000
            status_code = response.status_code

            logger.info(
                f"Request completed: {method} {path} | "
                f"status={status_code} | duration={process_time:.2f}ms"
            )

            return response
