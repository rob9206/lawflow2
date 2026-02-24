"""Transactional email helpers for account workflows."""

import logging

from api.config import config

logger = logging.getLogger(__name__)


def _build_url(path: str, token: str) -> str:
    base = config.APP_BASE_URL.rstrip("/")
    suffix = path.lstrip("/")
    return f"{base}/{suffix}?token={token}"


def _send_email(to_email: str, subject: str, html_body: str) -> None:
    if not config.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY is not set; skipping email to %s", to_email)
        return

    import resend  # type: ignore

    resend.api_key = config.RESEND_API_KEY
    resend.Emails.send(
        {
            "from": config.FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
    )


def _resolve_email(user_or_email) -> str:
    if isinstance(user_or_email, str):
        return user_or_email
    return getattr(user_or_email, "email", "")


def send_verification_email(user, token: str) -> None:
    email = _resolve_email(user)
    verify_url = _build_url("verify-email", token)
    _send_email(
        email,
        "Verify your LawFlow email",
        (
            "<p>Welcome to LawFlow.</p>"
            "<p>Please verify your email by clicking the link below:</p>"
            f'<p><a href="{verify_url}">Verify email</a></p>'
            "<p>If you did not request this, you can ignore this email.</p>"
        ),
    )


def send_password_reset_email(user, token: str) -> None:
    email = _resolve_email(user)
    reset_url = _build_url("reset-password", token)
    _send_email(
        email,
        "Reset your LawFlow password",
        (
            "<p>We received a password reset request.</p>"
            f'<p><a href="{reset_url}">Reset password</a></p>'
            "<p>If you did not request this, you can ignore this email.</p>"
        ),
    )


def send_email_change_email(user, token: str, new_email: str) -> None:
    confirm_url = _build_url("confirm-email-change", token)
    _send_email(
        new_email,
        "Confirm your LawFlow email change",
        (
            "<p>You requested to change your LawFlow account email.</p>"
            f'<p><a href="{confirm_url}">Confirm email change</a></p>'
            f"<p>Account: {user.email}</p>"
            "<p>If you did not request this, please ignore this email.</p>"
        ),
    )
