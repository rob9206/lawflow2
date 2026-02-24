"""Authentication and user profile routes."""

import logging
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
from flask import Blueprint, jsonify, request, send_from_directory
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from api.config import config
from api.errors import APIError, NotFoundError, UnauthorizedError, ValidationError
from api.middleware.auth import (
    decode_token,
    get_current_user,
    get_current_user_id,
    issue_auth_tokens,
    login_required,
)
from api.models.assessment import Assessment, AssessmentQuestion
from api.models.auth_token import AuthToken
from api.models.document import Document, KnowledgeChunk
from api.models.exam_blueprint import ExamBlueprint, ExamTopicWeight
from api.models.rewards import Achievement, PointLedger, RewardsProfile
from api.models.review import SpacedRepetitionCard
from api.models.session import SessionMessage, StudySession
from api.models.student import SubjectMastery, TopicMastery
from api.models.study_plan import PlanTask, StudyPlan
from api.models.user import User
from api.services.achievement_definitions import seed_achievements
from api.services.account_lifecycle import delete_user_account
from api.services.database import get_db
from api.services.email import (
    send_email_change_email,
    send_password_reset_email,
    send_verification_email,
)
from api.services.rate_limiter import limiter
from api.services.subject_taxonomy import seed_subject_taxonomy
from api.services.token_utils import (
    generate_raw_token,
    hash_token,
    tokens_match,
)

bp = Blueprint("auth", __name__, url_prefix="/api/auth")
logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ALLOWED_AVATAR_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
_AVATAR_FILENAME_RE = re.compile(r"^[a-zA-Z0-9-]+\.(?:jpg|jpeg|png|gif|webp)$", re.IGNORECASE)
_MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
_AVATAR_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "uploads" / "avatars"

_TOKEN_VERIFY_EMAIL = "verify_email"
_TOKEN_RESET_PASSWORD = "reset_password"
_TOKEN_CHANGE_EMAIL = "change_email"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def _validate_password(password: str) -> None:
    """Validate password meets security requirements.

    Rules:
    - At least 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 digit
    - At least 1 special character
    """
    pwd = password or ""

    if len(pwd) < 8:
        raise ValidationError("Password must be at least 8 characters")
    if not any(c.isupper() for c in pwd):
        raise ValidationError(
            "Password must contain at least one uppercase letter"
        )
    if not any(c.islower() for c in pwd):
        raise ValidationError(
            "Password must contain at least one lowercase letter"
        )
    if not any(c.isdigit() for c in pwd):
        raise ValidationError("Password must contain at least one digit")
    if not any(c in "!@#$%^&*-_=+[]{}|;:,.<>?" for c in pwd):
        raise ValidationError(
            "Password must contain at least one special character "
            "(!@#$%^&* etc.)"
        )


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def _claim_unowned_data(db, user_id: str) -> None:
    models = [
        SubjectMastery,
        TopicMastery,
        StudySession,
        SessionMessage,
        Assessment,
        AssessmentQuestion,
        StudyPlan,
        PlanTask,
        SpacedRepetitionCard,
        ExamBlueprint,
        ExamTopicWeight,
        Document,
        KnowledgeChunk,
        PointLedger,
        Achievement,
        RewardsProfile,
    ]
    for model in models:
        db.query(model).filter(model.user_id.is_(None)).update(
            {"user_id": user_id},
            synchronize_session=False,
        )


def _issue_account_token(
    db,
    *,
    user_id: str,
    purpose: str,
    new_email: str | None = None,
) -> str:
    raw = generate_raw_token()
    expiry = _utcnow() + timedelta(minutes=config.EMAIL_TOKEN_TTL_MINUTES)

    db.query(AuthToken).filter(
        AuthToken.user_id == user_id,
        AuthToken.purpose == purpose,
        AuthToken.used_at.is_(None),
    ).update({"used_at": _utcnow()}, synchronize_session=False)

    db.add(
        AuthToken(
            token_hash=hash_token(raw),
            purpose=purpose,
            user_id=user_id,
            new_email=new_email,
            expires_at=expiry,
        )
    )
    logger.info("auth_token_created user=%s purpose=%s", user_id, purpose)
    return raw


def _consume_account_token(db, raw_token: str, purpose: str) -> AuthToken:
    token_hash = hash_token(raw_token)
    token = db.query(AuthToken).filter(
        AuthToken.purpose == purpose,
        AuthToken.token_hash == token_hash,
        AuthToken.used_at.is_(None),
    ).first()
    if not token:
        logger.warning("auth_token_invalid purpose=%s", purpose)
        raise ValidationError("Invalid or expired token")
    if not tokens_match(raw_token, token.token_hash):
        logger.warning("auth_token_compare_failed purpose=%s", purpose)
        raise ValidationError("Invalid or expired token")
    if token.expires_at and token.expires_at <= _utcnow():
        logger.warning("auth_token_expired user=%s purpose=%s", token.user_id, purpose)
        raise ValidationError("Invalid or expired token")
    token.used_at = _utcnow()
    logger.info("auth_token_consumed user=%s purpose=%s", token.user_id, purpose)
    return token


@bp.route("/register", methods=["POST"])
def register():
    body = request.get_json(force=True)
    email = _normalize_email(body.get("email", ""))
    password = body.get("password", "")
    display_name = (body.get("display_name", "") or "").strip() or "Law Student"
    claim_existing_data = bool(body.get("claim_existing_data", True))

    if not _EMAIL_RE.match(email):
        raise ValidationError("Valid email is required")
    _validate_password(password)

    verification_token = ""
    with get_db() as db:
        if db.query(User).filter_by(email=email).first():
            raise ValidationError("An account with that email already exists")

        user = User(
            email=email,
            password_hash=_hash_password(password),
            display_name=display_name,
            tier="free",
            subscription_status="none",
        )
        db.add(user)
        db.flush()

        user_count = db.query(User).count()
        if claim_existing_data and user_count == 1:
            _claim_unowned_data(db, user.id)

        verification_token = _issue_account_token(
            db,
            user_id=user.id,
            purpose=_TOKEN_VERIFY_EMAIL,
        )

        # Build response while session is active (avoid detached instance)
        user_id = user.id
        user_dict = user.to_dict()

    # Seed mastery taxonomy for the new user in a separate transaction.
    try:
        seed_subject_taxonomy(user_id=user_id)
    except IntegrityError:
        # Legacy DB may still have old unique indexes.
        pass
    seed_achievements(user_id=user_id)

    try:
        send_verification_email(email, verification_token)
    except Exception:
        logger.exception("Failed to send verification email for user=%s", user_id)

    return jsonify(
        {
            "user": user_dict,
            **issue_auth_tokens(user_id),
        }
    ), 201


@bp.route("/login", methods=["POST"])
def login():
    body = request.get_json(force=True)
    email = _normalize_email(body.get("email", ""))
    password = body.get("password", "")
    if not email or not password:
        raise ValidationError("email and password are required")

    with get_db() as db:
        user = db.query(User).filter_by(email=email).first()
        if not user or not _check_password(password, user.password_hash):
            raise UnauthorizedError("Invalid email or password")
        if user.is_active is False:
            raise UnauthorizedError("Account is deactivated")
        try:
            seed_subject_taxonomy(user_id=user.id)
        except IntegrityError:
            pass
        seed_achievements(user_id=user.id)
        payload = {
            "user": user.to_dict(),
            **issue_auth_tokens(user.id),
        }
    return jsonify(payload)


@bp.route("/refresh", methods=["POST"])
def refresh():
    body = request.get_json(force=True)
    refresh_token = (body.get("refresh_token") or "").strip()
    if not refresh_token:
        raise ValidationError("refresh_token is required")

    payload = decode_token(refresh_token, expected_type="refresh")
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid token payload")

    with get_db() as db:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise UnauthorizedError("User not found")
        return jsonify(
            {
                "user": user.to_dict(),
                **issue_auth_tokens(user.id),
            }
        )


@bp.route("/me", methods=["GET"])
@login_required
def me():
    user = get_current_user()
    return jsonify(user.to_dict())


@bp.route("/update-profile", methods=["PUT"])
@login_required
def update_profile():
    user_id = get_current_user_id()
    body = request.get_json(force=True)
    display_name = body.get("display_name")
    avatar_url = body.get("avatar_url")
    bio = body.get("bio")

    with get_db() as db:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise UnauthorizedError("User not found")
        if display_name is not None:
            display_name = (display_name or "").strip()
            if not display_name:
                raise ValidationError("display_name cannot be empty")
            user.display_name = display_name
        if avatar_url is not None:
            user.avatar_url = (avatar_url or "").strip() or None
        if bio is not None:
            normalized_bio = (bio or "").strip()
            if len(normalized_bio) > 200:
                raise ValidationError("bio must be 200 characters or fewer")
            user.bio = normalized_bio
        db.flush()
        return jsonify(user.to_dict())


@bp.route("/upload-avatar", methods=["POST"])
@login_required
def upload_avatar():
    user_id = get_current_user_id()
    file = request.files.get("file")
    if not file or not file.filename:
        raise ValidationError("avatar file is required")

    safe_name = secure_filename(file.filename)
    ext = Path(safe_name).suffix.lower().lstrip(".")
    if ext not in _ALLOWED_AVATAR_EXTENSIONS:
        raise ValidationError("avatar must be jpg, jpeg, png, gif, or webp")

    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(0)
    if size > _MAX_AVATAR_SIZE_BYTES:
        raise ValidationError("avatar must be 2MB or smaller")

    _AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    for existing in _AVATAR_DIR.glob(f"{user_id}.*"):
        try:
            existing.unlink()
        except OSError:
            pass

    filename = f"{user_id}.{ext}"
    file.save(_AVATAR_DIR / filename)
    avatar_url = f"/api/auth/avatar/{filename}"

    with get_db() as db:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise UnauthorizedError("User not found")
        user.avatar_url = avatar_url
        db.flush()

    return jsonify({"avatar_url": avatar_url})


@bp.route("/avatar/<filename>", methods=["GET"])
def get_avatar(filename: str):
    if not _AVATAR_FILENAME_RE.match(filename):
        raise ValidationError("Invalid avatar filename")
    file_path = _AVATAR_DIR / filename
    if not file_path.exists():
        raise NotFoundError("Avatar not found")
    return send_from_directory(str(_AVATAR_DIR), filename)


@bp.route("/change-password", methods=["POST"])
@login_required
def change_password():
    user_id = get_current_user_id()
    body = request.get_json(force=True)
    current_password = body.get("current_password", "")
    new_password = body.get("new_password", "")
    if not current_password or not new_password:
        raise ValidationError("current_password and new_password are required")
    _validate_password(new_password)

    with get_db() as db:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise UnauthorizedError("User not found")
        if not _check_password(current_password, user.password_hash):
            raise UnauthorizedError("Current password is incorrect")
        user.password_hash = _hash_password(new_password)
        logger.info("password_changed user=%s", user_id)
        db.flush()
        return jsonify({"status": "ok"})


@bp.route("/send-verification", methods=["POST"])
@login_required
@limiter.limit("3/minute")
def send_verification():
    user_id = get_current_user_id()
    with get_db() as db:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise UnauthorizedError("User not found")
        token = _issue_account_token(
            db,
            user_id=user.id,
            purpose=_TOKEN_VERIFY_EMAIL,
        )
        send_verification_email(user, token)
    return jsonify({"status": "ok"})


@bp.route("/verify-email", methods=["POST"])
@limiter.limit("3/minute")
def verify_email():
    body = request.get_json(force=True)
    raw_token = (body.get("token") or "").strip()
    if not raw_token:
        raise ValidationError("token is required")

    with get_db() as db:
        token = _consume_account_token(db, raw_token, _TOKEN_VERIFY_EMAIL)
        user = db.query(User).filter_by(id=token.user_id).first()
        if not user:
            raise ValidationError("Invalid or expired token")
        user.email_verified = True
        db.flush()
        return jsonify({"status": "ok"})


@bp.route("/forgot-password", methods=["POST"])
@limiter.limit("5/minute")
def forgot_password():
    body = request.get_json(force=True)
    email = _normalize_email(body.get("email", ""))
    if not _EMAIL_RE.match(email):
        # Anti-enumeration: always same response.
        return jsonify(
            {
                "status": "ok",
                "message": (
                    "If an account exists, a reset link has been sent"
                ),
            }
        )

    with get_db() as db:
        user = db.query(User).filter_by(email=email).first()
        if user:
            token = _issue_account_token(
                db,
                user_id=user.id,
                purpose=_TOKEN_RESET_PASSWORD,
            )
            send_password_reset_email(user, token)

    return jsonify(
        {
            "status": "ok",
            "message": "If an account exists, a reset link has been sent",
        }
    )


@bp.route("/reset-password", methods=["POST"])
@limiter.limit("10/minute")
def reset_password():
    body = request.get_json(force=True)
    raw_token = (body.get("token") or "").strip()
    new_password = body.get("new_password", "")
    if not raw_token or not new_password:
        raise ValidationError("token and new_password are required")
    _validate_password(new_password)

    with get_db() as db:
        token = _consume_account_token(db, raw_token, _TOKEN_RESET_PASSWORD)
        user = db.query(User).filter_by(id=token.user_id).first()
        if not user:
            raise ValidationError("Invalid or expired token")
        user.password_hash = _hash_password(new_password)
        db.flush()
        logger.info("password_reset user=%s", user.id)
    return jsonify({"status": "ok"})


@bp.route("/change-email", methods=["POST"])
@login_required
def change_email():
    user_id = get_current_user_id()
    body = request.get_json(force=True)
    current_password = body.get("current_password", "")
    new_email = _normalize_email(body.get("new_email", ""))
    if not current_password or not new_email:
        raise ValidationError("current_password and new_email are required")
    if not _EMAIL_RE.match(new_email):
        raise ValidationError("Valid email is required")

    with get_db() as db:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise UnauthorizedError("User not found")
        if not _check_password(current_password, user.password_hash):
            raise UnauthorizedError("Current password is incorrect")
        if db.query(User).filter(User.email == new_email, User.id != user_id).first():
            raise ValidationError("An account with that email already exists")
        token = _issue_account_token(
            db,
            user_id=user.id,
            purpose=_TOKEN_CHANGE_EMAIL,
            new_email=new_email,
        )
        send_email_change_email(user, token, new_email)
    return jsonify({"status": "ok"})


@bp.route("/confirm-email-change", methods=["POST"])
@limiter.limit("10/minute")
def confirm_email_change():
    body = request.get_json(force=True)
    raw_token = (body.get("token") or "").strip()
    if not raw_token:
        raise ValidationError("token is required")

    with get_db() as db:
        token = _consume_account_token(db, raw_token, _TOKEN_CHANGE_EMAIL)
        if not token.new_email:
            raise ValidationError("Invalid or expired token")
        user = db.query(User).filter_by(id=token.user_id).first()
        if not user:
            raise ValidationError("Invalid or expired token")
        if db.query(User).filter(
            User.email == token.new_email,
            User.id != user.id,
        ).first():
            raise ValidationError("An account with that email already exists")
        user.email = _normalize_email(token.new_email)
        user.email_verified = True
        db.flush()
    return jsonify({"status": "ok"})


@bp.route("/delete-account", methods=["POST"])
@login_required
def delete_account():
    user_id = get_current_user_id()
    body = request.get_json(force=True)
    current_password = body.get("current_password", "")
    if not current_password:
        raise ValidationError("current_password is required")

    try:
        with get_db() as db:
            user = db.query(User).filter_by(id=user_id).first()
            if not user:
                raise UnauthorizedError("User not found")
            if not _check_password(current_password, user.password_hash):
                raise UnauthorizedError("Current password is incorrect")
            delete_user_account(db, user)
    except APIError:
        raise

    return jsonify({"status": "ok"})
