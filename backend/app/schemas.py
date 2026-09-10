from typing import Literal

from pydantic import BaseModel, Field


class AgentRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    mode: Literal["auto", "pre", "post"] = "auto"
    customer_id: str = "lin-zhiyuan"
    user_id: str = "mr-demo-001"
    conversation_id: str | None = None


class TraceStep(BaseModel):
    label: str
    detail: str
    state: Literal["done", "active", "guarded"]


class Citation(BaseModel):
    title: str
    version: str
    status: str
    location: str
    excerpt: str


class SourceCard(Citation):
    id: str = "approved-evidence"
    kind: Literal["crm", "business", "approved-material", "approved-evidence"] = "approved-evidence"


class LadderUpdate(BaseModel):
    dimension: str
    from_: str = Field(alias="from")
    to: str

    model_config = {"populate_by_name": True}


class RecommendArticle(BaseModel):
    id: str
    title: str
    tag: str | None = None
    note: str | None = None
    status: str | None = None


class ExtractedVisit(BaseModel):
    feedback: str
    ladder: str
    ladder_updates: list[LadderUpdate] = []
    next_visit: str
    interested_topic: str | None = None
    follow_up: str
    recommend_article: RecommendArticle | None = None


class PrivacyFinding(BaseModel):
    flagged: bool = False
    spans: list[str] = []
    reason: str = ""


class OffLabelFinding(BaseModel):
    flagged: bool = False
    term: str | None = None
    notice: str = ""


class TodoSuggestion(BaseModel):
    date: str
    material: str
    article_id: str | None = None
    type: str = "follow-up-visit"


class DetailAid(BaseModel):
    id: str
    title: str
    subtitle: str | None = None
    points: list[str] = []
    tags: list[str] = []
    status: str | None = None


class SuggestedAction(BaseModel):
    type: Literal["create-task", "confirm-submit"]
    title: str
    description: str
    draft_id: str | None = None
    confirmation_token: str | None = None


class AgentResponse(BaseModel):
    reply: str
    trace: list[TraceStep]
    citation: Citation | None = None
    sources: list[SourceCard] = []
    extracted: ExtractedVisit | None = None
    suggested_action: SuggestedAction | None = None
    privacy: PrivacyFinding | None = None
    off_label: OffLabelFinding | None = None
    todo_suggestion: TodoSuggestion | None = None
    model_mode: str
    route: str
    skill_id: str | None = None
    skill_version: str | None = None
    run_id: str | None = None
    conversation_id: str | None = None


class ConfirmVisitRequest(BaseModel):
    user_id: str = "mr-demo-001"
    todo_decision: Literal["adopt", "ignore"] = "ignore"
    confirmation_token: str = Field(min_length=8)
    action: Literal["create-follow-up"]
    feedback: str
    next_visit: str
    draft_id: str | None = None
    customer_name: str | None = None
    conversation_id: str | None = None
    ladder: list[LadderUpdate] = []
    follow_up: str | None = None


class TodoDecisionRequest(BaseModel):
    user_id: str = "mr-demo-001"
    draft_id: str
    confirmation_token: str
    decision: Literal["adopt", "ignore"]
    date: str
    material: str
    customer_name: str | None = None


class ConversationCreateRequest(BaseModel):
    user_id: str = "mr-demo-001"
    customer_id: str = Field(min_length=1)


class TimelineEventRequest(BaseModel):
    kind: Literal["visit_session"] = "visit_session"
    user_id: str = "mr-demo-001"
    seconds: int = 0
    shown_aids: list[DetailAid] = []


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    kind: Literal["message", "visit_session", "visit_confirmed"] = "message"
    text: str
    payload: dict = Field(default_factory=dict)
    created_at: str
    route: str | None = None
    skill_id: str | None = None
    skill_version: str | None = None
    trace: list[TraceStep] = []
    sources: list[SourceCard] = []
    suggested_action: SuggestedAction | None = None
    model_mode: str | None = None


class ConversationSummary(BaseModel):
    id: str
    title: str
    updated_at: str
    customer_id: str | None = None
    customer_name: str | None = None


class DeveloperRun(BaseModel):
    id: str
    conversation_id: str | None = None
    route: str
    skill_id: str | None = None
    skill_version: str | None = None
    model_mode: str
    trace: list[TraceStep]
    created_at: str


class BonusRequest(BaseModel):
    target: float = Field(gt=0)
    achieved: float = Field(ge=0)
