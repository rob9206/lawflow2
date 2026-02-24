"""Account lifecycle helpers (deletion, cleanup, Stripe cancellation)."""

import logging
from uuid import uuid4

import stripe
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.config import config
from api.errors import APIError, ValidationError
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

logger = logging.getLogger(__name__)


def _cancel_active_subscription(user: User) -> None:
    status = (user.subscription_status or "").lower()
    if not user.stripe_subscription_id or status not in {"active", "past_due"}:
        return

    if not config.STRIPE_SECRET_KEY:
        raise ValidationError("Stripe is not configured")

    stripe.api_key = config.STRIPE_SECRET_KEY
    idem_key = f"delete-account:{user.id}:{uuid4()}"
    try:
        stripe.Subscription.cancel(user.stripe_subscription_id, idempotency_key=idem_key)
    except Exception as exc:
        logger.exception("Stripe cancellation failed for user=%s", user.id)
        raise APIError("Unable to cancel subscription. Please retry.", 503) from exc


def delete_user_account(db: Session, user: User) -> None:
    """Delete a user and all related records in a single transaction."""
    _cancel_active_subscription(user)
    user_id = user.id

    db.query(AuthToken).filter(AuthToken.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(SessionMessage).filter(SessionMessage.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(StudySession).filter(StudySession.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(AssessmentQuestion).filter(AssessmentQuestion.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Assessment).filter(Assessment.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(KnowledgeChunk).filter(KnowledgeChunk.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Document).filter(Document.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(SubjectMastery).filter(SubjectMastery.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(TopicMastery).filter(TopicMastery.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(PlanTask).filter(PlanTask.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(StudyPlan).filter(StudyPlan.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(SpacedRepetitionCard).filter(
        SpacedRepetitionCard.user_id == user_id
    ).delete(synchronize_session=False)
    db.query(ExamTopicWeight).filter(ExamTopicWeight.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(ExamBlueprint).filter(ExamBlueprint.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(PointLedger).filter(PointLedger.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Achievement).filter(Achievement.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(RewardsProfile).filter(RewardsProfile.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(User).filter(User.id == user_id).delete(synchronize_session=False)

    # Safety pass for SQLite foreign key drift.
    if "sqlite" in config.DATABASE_URL:
        violations = db.execute(text("PRAGMA foreign_key_check")).fetchall()
        if violations:
            raise ValidationError("Account deletion integrity check failed")
