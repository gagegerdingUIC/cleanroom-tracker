"""
config.py — Application settings via pydantic-settings.

Settings are read from environment variables or a .env file.
In phase 1, sensible defaults cover the single-user local setup.
In phase 2, swap DATABASE_URL to PostgreSQL and set a real SECRET_KEY.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./cleanroom.db"
    SQL_ECHO: bool = False  # Set True to log all SQL (useful for debugging)

    # File storage
    STORAGE_BASE_PATH: str = "./data"  # Local path; S3 URI in phase 2

    # Auth (dormant in phase 1)
    SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    # Application
    APP_NAME: str = "Cleanroom Process Tracker"
    DEBUG: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
