"""
config.py — Application settings via pydantic-settings.

Settings are read from environment variables or a .env file.
In phase 1, sensible defaults cover the single-user local setup.
In phase 2, swap DATABASE_URL to PostgreSQL and set a real SECRET_KEY.
"""

import os
import sys
from pathlib import Path

from pydantic_settings import BaseSettings

APP_VERSION = "0.2.0"
GITHUB_REPO = "gagegerdingUIC/cleanroom-tracker"


def _get_base_dir() -> Path:
    """Return the directory for user data (DB, storage).

    Bundled exe: %APPDATA%/CleanroomTracker/ (persists across updates).
    Dev mode: current working directory.
    """
    if getattr(sys, "frozen", False):
        appdata = os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")
        data_dir = Path(appdata) / "CleanroomTracker"
        data_dir.mkdir(parents=True, exist_ok=True)
        return data_dir
    return Path.cwd()


def _get_bundle_dir() -> Path:
    """Return the directory containing bundled data files.

    Bundled exe: PyInstaller's _MEIPASS (same as exe dir for --onedir).
    Dev mode: the backend/ directory.
    """
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent.parent


_base = _get_base_dir()
_bundle = _get_bundle_dir()


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = f"sqlite:///{(_base / 'cleanroom.db').as_posix()}"
    SQL_ECHO: bool = False  # Set True to log all SQL (useful for debugging)

    # File storage
    STORAGE_BASE_PATH: str = str(_base / "data")  # Local path; S3 URI in phase 2

    # Auth (dormant in phase 1)
    SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    # Application
    APP_NAME: str = "Cleanroom Process Tracker"
    DEBUG: bool = True

    # Bundled frontend (read-only, not user-configurable)
    FRONTEND_DIR: str = str(_bundle / "frontend_dist")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
