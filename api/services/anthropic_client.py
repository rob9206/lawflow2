"""Shared Anthropic client construction with robust key normalization."""

import logging
import os

import anthropic
from flask import has_request_context, request

from api.config import config

_QUOTE_CHARS = "\"'`“”‘’"
logger = logging.getLogger(__name__)


def _normalize_api_key(raw: str | None) -> str:
    """Normalize common copy/paste artifacts around API keys."""
    key = (raw or "").strip()
    if not key:
        return ""

    # Some shells/tools store keys as "Bearer <token>".
    if key.lower().startswith("bearer "):
        key = key[7:].strip()

    # Trim surrounding quote characters if present.
    while len(key) >= 2 and key[0] in _QUOTE_CHARS and key[-1] in _QUOTE_CHARS:
        key = key[1:-1].strip()

    return key


def _looks_like_anthropic_key(key: str) -> bool:
    return key.startswith("sk-ant-") and len(key) >= 40


def _request_header_api_key() -> str:
    """Read optional per-request key override from frontend."""
    if not has_request_context():
        return ""
    return _normalize_api_key(request.headers.get("X-Anthropic-Api-Key", ""))


def resolve_anthropic_api_key(override_key: str | None = None) -> str:
    """Resolve Anthropic API key from config/env with sanity checks."""
    explicit_key = _normalize_api_key(override_key)
    header_key = _request_header_api_key()
    config_key = _normalize_api_key(config.ANTHROPIC_API_KEY)
    env_key = _normalize_api_key(os.getenv("ANTHROPIC_API_KEY", ""))
    explicit_valid = _looks_like_anthropic_key(explicit_key)
    header_valid = _looks_like_anthropic_key(header_key)
    config_valid = _looks_like_anthropic_key(config_key)
    env_valid = _looks_like_anthropic_key(env_key)
    selected_source = ""

    if explicit_valid:
        selected_source = "explicit_override"
        selected_key = explicit_key
    elif header_valid:
        selected_source = "header"
        selected_key = header_key
    elif not config_key and not env_key:
        logger.debug(
            "No Anthropic key candidates available (header_present=%s, config_present=%s, env_present=%s)",
            bool(header_key),
            bool(config_key),
            bool(env_key),
        )
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. "
            "Add your Anthropic API key to the .env file."
        )
    elif config_valid and not env_valid:
        selected_source = "config"
        selected_key = config_key
    elif env_valid and not config_valid:
        selected_source = "env"
        selected_key = env_key
    else:
        # Preserve existing precedence when both are similarly valid/invalid.
        selected_source = "config" if config_key else "env"
        selected_key = config_key or env_key

    logger.debug(
        "Resolved Anthropic key source (source=%s, explicit_valid=%s, header_valid=%s, config_valid=%s, env_valid=%s)",
        selected_source,
        explicit_valid,
        header_valid,
        config_valid,
        env_valid,
    )
    return selected_key


def create_anthropic_client(override_key: str | None = None) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=resolve_anthropic_api_key(override_key))
