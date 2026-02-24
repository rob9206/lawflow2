"""Shared Anthropic Claude API client."""

from api.services.anthropic_client import create_anthropic_client


def get_claude_client():
    """Return a configured Anthropic client.

    Delegates to anthropic_client.create_anthropic_client which handles
    key normalization (stripping quotes, Bearer prefix, etc.) and
    resolution from config/env.
    """
    return create_anthropic_client()
