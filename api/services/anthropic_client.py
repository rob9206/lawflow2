"""Shared Anthropic client construction with robust key normalization."""

import logging
import os

import anthropic

from api.config import config

_QUOTE_CHARS = "\"'`\u201c\u201d\u2018\u2019"
logger = logging.getLogger(__name__)


def _normalize_api_key(raw: str | None) -> str:
    """Normalize common copy/paste artifacts around API keys."""
    key = (raw or "").strip()
    if not key:
        return ""

    if key.lower().startswith("bearer "):
        key = key[7:].strip()

    while len(key) >= 2 and key[0] in _QUOTE_CHARS and key[-1] in _QUOTE_CHARS:
        key = key[1:-1].strip()

    return key


def _looks_like_anthropic_key(key: str) -> bool:
    return key.startswith("sk-ant-") and len(key) >= 40


def resolve_anthropic_api_key(override_key: str | None = None) -> str:
    """Resolve Anthropic API key from config/env (server-only)."""
    explicit_key = _normalize_api_key(override_key)
    config_key = _normalize_api_key(config.ANTHROPIC_API_KEY)
    env_key = _normalize_api_key(os.getenv("ANTHROPIC_API_KEY", ""))
    explicit_valid = _looks_like_anthropic_key(explicit_key)
    config_valid = _looks_like_anthropic_key(config_key)
    env_valid = _looks_like_anthropic_key(env_key)

    if explicit_valid:
        selected_key = explicit_key
    elif not config_key and not env_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. "
            "Add your Anthropic API key to the .env file."
        )
    elif config_valid and not env_valid:
        selected_key = config_key
    elif env_valid and not config_valid:
        selected_key = env_key
    else:
        selected_key = config_key or env_key

    return selected_key


def create_anthropic_client(
    override_key: str | None = None,
) -> anthropic.Anthropic:
    key = resolve_anthropic_api_key(override_key)
    return anthropic.Anthropic(api_key=key)
