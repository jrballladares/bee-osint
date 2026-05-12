from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    # Project Info
    PROJECT_NAME: str = "bee-api"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "OSINT tool for news word_list, signal extraction, and NLP-based analysis."
    API_V1_STR: str = "/api/v1"

    # Server Configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    WORKERS_COUNT: int = 1
    API_RELOAD: bool = True

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False

    # Database
    DATABASE_URL: str

    # Security
    ALLOWED_ORIGINS: list[str] = ["*"]
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # External APIs
    GROQ_API_KEY: str | None = None

    # App specific
    FETCH_INTERVAL_MINUTES: int = 60

    # Swagger UI
    SWAGGER_UI_PARAMETERS: dict[str, Any] = {
        "docExpansion": "none",
        "defaultModelsExpandDepth": -1,
    }


settings = Settings()
