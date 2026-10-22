"""Runtime settings, read from environment variables."""

import os
from dataclasses import dataclass, field


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = "qorgan API"
    # Secret used to sign access tokens. Override in every non-local environment.
    jwt_secret: str = field(default_factory=lambda: os.getenv("QORGAN_JWT_SECRET", "dev-only-insecure-secret-change-me-0123456789"))
    jwt_ttl_hours: int = int(os.getenv("QORGAN_JWT_TTL_HOURS", "72"))
    cors_origins: tuple[str, ...] = tuple(
        o.strip()
        for o in os.getenv("QORGAN_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    )
    # Dev convenience: return SMS codes in API responses instead of sending them.
    expose_dev_codes: bool = _bool("QORGAN_EXPOSE_DEV_CODES", True)
    # Simulate an outage of the AI assistant (shows the "AI unavailable" state).
    ai_offline: bool = _bool("QORGAN_AI_OFFLINE", False)
    # Seed demo users on startup.
    seed_demo_data: bool = _bool("QORGAN_SEED_DEMO", True)
    # Credit data older than this is shown as stale.
    stale_after_days: int = 30
    max_report_bytes: int = 10 * 1024 * 1024
    # TODO: Database — add the connection string here, e.g.
    #   database_url: str = os.getenv("QORGAN_DATABASE_URL", "postgresql+psycopg://qorgan:qorgan@localhost/qorgan")


settings = Settings()
