"""Administrative account management endpoints."""

import logging

from flask import Blueprint, jsonify, request
from sqlalchemy.orm import Session

from api.errors import NotFoundError, ValidationError
from api.middleware.auth import (
    admin_required,
    get_current_user_id,
    login_required,
)
from api.models.user import User
from api.services.account_lifecycle import delete_user_account
from api.services.database import get_db

bp = Blueprint("admin", __name__, url_prefix="/api/admin")
logger = logging.getLogger(__name__)


@bp.route("/users", methods=["GET"])
@login_required
@admin_required
def list_users():
    page = max(request.args.get("page", 1, type=int), 1)
    page_size = min(max(request.args.get("page_size", 20, type=int), 1), 100)
    q = (request.args.get("q", "") or "").strip().lower()

    with get_db() as db_ctx:
        db: Session = db_ctx
        query = db.query(User)
        if q:
            like = f"%{q}%"
            query = query.filter(
                (User.email.ilike(like)) | (User.display_name.ilike(like))
            )
        total = query.count()
        users = (
            query.order_by(User.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return jsonify(
            {
                "items": [u.to_dict() for u in users],
                "page": page,
                "page_size": page_size,
                "total": total,
            }
        )


@bp.route("/users/<user_id>", methods=["GET"])
@login_required
@admin_required
def get_user(user_id: str):
    with get_db() as db_ctx:
        db: Session = db_ctx
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise NotFoundError("User not found")
        return jsonify(user.to_dict())


@bp.route("/users/<user_id>", methods=["PUT"])
@login_required
@admin_required
def update_user(user_id: str):
    admin_id = get_current_user_id()
    body = request.get_json(force=True)
    allowed_tiers = {"free", "pro"}

    with get_db() as db_ctx:
        db: Session = db_ctx
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise NotFoundError("User not found")

        if "tier" in body:
            tier = (body.get("tier") or "").strip().lower()
            if tier not in allowed_tiers:
                raise ValidationError("tier must be one of: free, pro")
            user.tier = tier
        if "is_active" in body:
            user.is_active = bool(body.get("is_active"))
        if "is_admin" in body:
            user.is_admin = bool(body.get("is_admin"))

        db.flush()
        logger.info(
            (
                "admin_user_update admin=%s target=%s tier=%s "
                "is_active=%s is_admin=%s"
            ),
            admin_id,
            user.id,
            user.tier,
            user.is_active,
            user.is_admin,
        )
        return jsonify(user.to_dict())


@bp.route("/users/<user_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_user(user_id: str):
    admin_id = get_current_user_id()
    with get_db() as db_ctx:
        db: Session = db_ctx
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            raise NotFoundError("User not found")
        delete_user_account(db, user)
        logger.info("admin_user_delete admin=%s target=%s", admin_id, user_id)
    return jsonify({"status": "ok"})


@bp.route("/stats", methods=["GET"])
@login_required
@admin_required
def stats():
    with get_db() as db_ctx:
        db: Session = db_ctx
        total_users = db.query(User).count()
        pro_users = db.query(User).filter(User.tier == "pro").count()
        active_users = db.query(User).filter(User.is_active.is_(True)).count()
        unverified_users = db.query(User).filter(
            User.email_verified.is_(False)
        ).count()
        admin_users = db.query(User).filter(User.is_admin.is_(True)).count()
    return jsonify(
        {
            "total_users": total_users,
            "pro_users": pro_users,
            "active_users": active_users,
            "unverified_users": unverified_users,
            "admin_users": admin_users,
        }
    )
