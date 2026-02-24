"""Helpers for secure single-use tokens."""

import hashlib
import hmac
import secrets


def generate_raw_token() -> str:
    """Generate a URL-safe opaque token."""
    return secrets.token_urlsafe(32)


def hash_token(raw_token: str) -> str:
    """Hash token before storing it in the database."""
    return hashlib.sha256((raw_token or "").encode("utf-8")).hexdigest()


def tokens_match(raw_token: str, stored_hash: str) -> bool:
    """Constant-time compare between raw token and stored hash."""
    return hmac.compare_digest(hash_token(raw_token), stored_hash or "")
