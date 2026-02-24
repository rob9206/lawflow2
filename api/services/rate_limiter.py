"""Flask-Limiter setup helpers."""

from flask_limiter import Limiter  # type: ignore[import-not-found]
from flask_limiter.util import get_remote_address  # type: ignore[import-not-found]

from api.config import config


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    storage_uri=config.LIMITER_STORAGE_URI or "memory://",
)
