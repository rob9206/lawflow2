"""Authentication and user profile routes."""

import re
from pathlib import Path

import bcrypt
from flask import Blueprint, jsonify, request, send_from_directory
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from api.errors import NotFoundError, UnauthorizedError, ValidationError
from api.middleware.auth import (
    decode_token,
    get_current_user,
    get_current_user_id,
    issue_auth_tokens,
    login_required,
)
from api.models.assessment import Assessment, AssessmentQuestion
from api.models.document import Document, KnowledgeChunk
from api.models.exam_blueprint import ExamBlueprint, ExamTopicWeight
from api.models.rewards import Achievement, PointLedger, RewardsProfile
from api.models.review import SpacedRepetitionCard
from api.models.session import SessionMessage, StudySession
from api.models.student import SubjectMastery, TopicMastery
from api.models.study_plan import PlanTask, StudyPlan
from api.models.user import User
from api.services.achievement_definitions import seed_achievements
from api.services.database import get_db
from api.services.subject_taxonomy import seed_subject_taxonomy

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ALLOWED_AVATAR_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
_AVATAR_FILENAME_RE = re.compile(r"^[a-zA-Z0-9-]+\.(?:jpg|jpeg|png|gif|webp)$", re.IGNORECASE)
_MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
_AVATAR_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "uploads" / "avatars"


def _normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def _validate_password(password: str) -> None:
    if len(password or "") < 8:
        raise ValidationError("Password must be at least 8 characters")


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
        db.flush()
        return jsonify({"status": "ok"})
