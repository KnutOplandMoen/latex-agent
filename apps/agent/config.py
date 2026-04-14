"""Environment configuration loaded once at startup."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(_env_path)

DATABASE_URL: str = os.environ.get("DATABASE_URL", "postgresql://latex_ide:latex_ide_dev@localhost:5432/latex_ide")

CLERK_SECRET_KEY: str = os.environ.get("CLERK_SECRET_KEY", "")
CLERK_PUBLISHABLE_KEY: str = os.environ.get("CLERK_PUBLISHABLE_KEY", "")

ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
TAVILY_API_KEY: str = os.environ.get("TAVILY_API_KEY", "")

AGENT_PORT: int = int(os.environ.get("AGENT_PORT", "3002"))
CORS_ORIGIN: str = os.environ.get("CORS_ORIGIN", "http://localhost:3000")
API_INTERNAL_URL: str = os.environ.get("API_INTERNAL_URL", "http://localhost:3001")

NODE_ENV: str = os.environ.get("NODE_ENV", "development")
IS_PRODUCTION: bool = NODE_ENV == "production"

DEV_MODE: bool = not CLERK_SECRET_KEY and not IS_PRODUCTION
