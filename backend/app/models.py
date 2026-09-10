from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VisitRecord(Base):
    __tablename__ = "visit_records"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    product: Mapped[str] = mapped_column(String(120))
    feedback: Mapped[str] = mapped_column(Text)
    next_visit: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FollowUpTask(Base):
    __tablename__ = "follow_up_tasks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    visit_id: Mapped[str] = mapped_column(ForeignKey("visit_records.id"))
    title: Mapped[str] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(32), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(80), index=True)
    customer_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    customer_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    title: Mapped[str] = mapped_column(String(160), default="新对话")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ConversationTurn(Base):
    __tablename__ = "conversation_turns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    kind: Mapped[str] = mapped_column(String(32), default="message")
    text: Mapped[str] = mapped_column(Text)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    route: Mapped[str | None] = mapped_column(String(48), nullable=True)
    skill_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    skill_version: Mapped[str | None] = mapped_column(String(24), nullable=True)
    trace_json: Mapped[str] = mapped_column(Text, default="[]")
    sources_json: Mapped[str] = mapped_column(Text, default="[]")
    action_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_mode: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_id: Mapped[str | None] = mapped_column(ForeignKey("conversations.id"), nullable=True, index=True)
    route: Mapped[str] = mapped_column(String(48))
    skill_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    skill_version: Mapped[str | None] = mapped_column(String(24), nullable=True)
    model_mode: Mapped[str] = mapped_column(String(40))
    trace_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VisitDraft(Base):
    __tablename__ = "visit_drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_id: Mapped[str | None] = mapped_column(ForeignKey("conversations.id"), nullable=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    feedback: Mapped[str] = mapped_column(Text)
    next_visit: Mapped[str] = mapped_column(String(120))
    follow_up: Mapped[str] = mapped_column(Text)
    confirmation_token: Mapped[str] = mapped_column(String(64))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(32), default="awaiting_confirmation")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
