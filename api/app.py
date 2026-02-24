"""LawFlow Flask application factory."""

import logging
import os
from pathlib import Path

import bcrypt
import click
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from api.config import config
from api.errors import APIError
from api.services.rate_limiter import limiter

logger = logging.getLogger(__name__)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _seed_initial_admin() -> None:
    from api.models.user import User
    from api.services.database import get_db

    admin_email = (config.ADMIN_EMAIL or "").strip().lower()
    admin_password = config.ADMIN_PASSWORD or ""
    if not admin_email:
        return

    with get_db() as db:
        existing_admin = db.query(User).filter_by(is_admin=True).first()
        if existing_admin:
            if admin_password:
                logger.warning(
                    "ADMIN_PASSWORD is still set even though an admin exists. "
                    "Remove ADMIN_PASSWORD from environment variables."
                )
            return

        if not admin_password:
            logger.warning(
                "ADMIN_EMAIL is set but ADMIN_PASSWORD is missing; "
                "skipping admin bootstrap."
            )
            return

        user = db.query(User).filter_by(email=admin_email).first()
        if user:
            user.is_admin = True
            user.is_active = True
            user.email_verified = True
            logger.info("Promoted existing user to admin: %s", admin_email)
        else:
            db.add(
                User(
                    email=admin_email,
                    password_hash=_hash_password(admin_password),
                    display_name="Admin",
                    tier="pro",
                    subscription_status="active",
                    is_admin=True,
                    is_active=True,
                    email_verified=True,
                )
            )
            logger.info("Admin user created via bootstrap: %s", admin_email)

        logger.warning(
            "Remove ADMIN_PASSWORD from environment variables after bootstrap."
        )


def create_app(static_dir: str | None = None) -> Flask:
    config.validate()

    resolved_static_dir: str | None = None
    if static_dir:
        candidate = Path(static_dir).resolve()
        if candidate.exists():
            resolved_static_dir = str(candidate)

    app = Flask(
        __name__,
        static_folder=resolved_static_dir,
        static_url_path="" if resolved_static_dir else None,
    )
    app.config["SECRET_KEY"] = config.SECRET_KEY
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_UPLOAD_MB * 1024 * 1024

    if not config.ANTHROPIC_API_KEY:
        logger.warning(
            "ANTHROPIC_API_KEY is not set! Document processing will fail. "
            "Add your key to the .env file."
        )

    allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    extra_origins = os.getenv("ALLOWED_ORIGINS", "")
    if extra_origins:
        allowed_origins.extend(o.strip() for o in extra_origins.split(",") if o.strip())

    CORS(app, origins=allowed_origins,
         expose_headers=["X-Session-Id", "X-Tutor-Mode", "X-Topic"])
    limiter.init_app(app)

    from api.middleware.auth import get_current_user_id, login_required

    # Error handler
    @app.errorhandler(APIError)
    def handle_api_error(error):
        return jsonify({"error": error.message}), error.status_code

    @app.errorhandler(500)
    def handle_500(_err):
        logger.exception("Unhandled exception")
        return jsonify({"error": "Internal server error"}), 500

    # Health check
    @app.route("/api/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "app": "LawFlow",
            }
        )

    # Seed database on demand (subjects/topics); safe to call multiple times
    @app.route("/api/seed", methods=["POST"])
    @login_required
    def seed():
        from api.services.subject_taxonomy import seed_subject_taxonomy
        from api.services.achievement_definitions import seed_achievements
        user_id = get_current_user_id()
        seed_subject_taxonomy(user_id=user_id)
        seed_achievements(user_id=user_id)
        return jsonify({"status": "ok", "message": "Subject and topic taxonomy seeded."})

    # Register blueprints
    from api.routes.documents import bp as documents_bp
    from api.routes.auth import bp as auth_bp
    from api.routes.billing import bp as billing_bp
    from api.routes.tutor import bp as tutor_bp
    from api.routes.progress import bp as progress_bp
    from api.routes.knowledge import bp as knowledge_bp
    from api.routes.auto_teach import bp as auto_teach_bp
    from api.routes.review import bp as review_bp
    from api.routes.exam import bp as exam_bp
    from api.routes.profile import bp as profile_bp
    from api.routes.rewards import bp as rewards_bp
    from api.routes.admin import bp as admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(billing_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(tutor_bp)
    app.register_blueprint(progress_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(auto_teach_bp)
    app.register_blueprint(review_bp)
    app.register_blueprint(exam_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(rewards_bp)
    app.register_blueprint(admin_bp)

    @app.cli.command("rotate-admin-password")
    @click.option("--email", required=True, help="Admin email address")
    @click.password_option("--password", confirmation_prompt=True)
    def rotate_admin_password(email: str, password: str) -> None:
        from api.models.user import User
        from api.services.database import get_db

        target_email = (email or "").strip().lower()
        with get_db() as db:
            user = db.query(User).filter_by(email=target_email).first()
            if not user or not bool(user.is_admin):
                raise click.ClickException("Admin user not found")
            user.password_hash = _hash_password(password)
        click.echo(f"Updated password for admin {target_email}")

    if resolved_static_dir:
        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path: str):
            if path.startswith("api/"):
                return jsonify({"error": "Not found"}), 404

            file_path = Path(resolved_static_dir) / path
            if path and file_path.is_file():
                return send_from_directory(resolved_static_dir, path)
            return send_from_directory(resolved_static_dir, "index.html")

    # Initialize database tables.
    with app.app_context():
        from api.services.database import init_database
        init_database()
        _seed_initial_admin()

    return app


# Auto-detect built frontend so gunicorn serves the SPA in production.
_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
app = create_app(static_dir=str(_dist) if _dist.is_dir() else None)

if __name__ == "__main__":
    # Reloader disabled: module-level create_app() imports blueprints and
    # touches DB/cache files on every reimport, which the stat reloader
    # detects as changes → infinite restart loop.
    # For auto-reloading in dev, use the launch.json "api" config instead
    # (flask CLI handles factory-pattern reloading correctly).
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG,
            use_reloader=False)
