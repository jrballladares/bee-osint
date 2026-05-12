from groq import Groq
from loguru import logger

from app.core.config import settings


class LLMClient:
    """Groq LLM client wrapper with lazy initialization."""

    def __init__(self) -> None:
        self._client: Groq | None = None
        self._initialized: bool = False

    @property
    def client(self) -> Groq | None:
        """Lazy-load and return the Groq client instance."""
        if self._initialized:
            return self._client

        self._initialized = True

        api_key = settings.GROQ_API_KEY
        if not api_key:
            logger.warning("GROQ_API_KEY not configured - LLM disabled")
            return None

        try:
            self._client = Groq(api_key=api_key, max_retries=0)
            logger.info("Groq client initialized with SDK retries disabled")
        except Exception as exc:
            logger.error(f"Groq initialization failed: {exc}")
            self._client = None

        return self._client

    def is_available(self) -> bool:
        """Check whether the LLM client is usable."""
        return self.client is not None

    def __bool__(self) -> bool:
        """Allow: if llm_client:"""
        return self.is_available()


# Global singleton
llm_client = LLMClient()
