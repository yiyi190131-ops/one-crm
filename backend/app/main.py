import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agent.graph import run_agent
from app.core.config import get_settings
from app.core.database import ensure_schema, get_db
from app.models import AgentRun, Conversation, ConversationTurn, FollowUpTask, VisitDraft, VisitRecord
from app.schemas import AgentRequest, BonusRequest, ConfirmVisitRequest, ConversationCreateRequest, TimelineEventRequest, TodoDecisionRequest
from app.skills.bonus_simulation import run_bonus_simulation_skill
from app.services.demo_data import get_customer, list_customers
from app.services.llm import compose_messages, llm_compose, llm_enabled, stream_chat
from app.services.tools import list_recommend_articles, read_detail_aids, detect_pii
from app.services.crm_context import customer_overrides

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_schema()
    yield


app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def as_iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def serialize_conversation(conversation: Conversation) -> dict:
    return {
        "id": conversation.id,
        "title": conversation.title,
        "updated_at": as_iso(conversation.updated_at),
        "customer_id": conversation.customer_id,
        "customer_name": conversation.customer_name,
    }


def serialize_turn(turn: ConversationTurn) -> dict:
    return {
        "id": turn.id,
        "role": turn.role,
        "kind": turn.kind or "message",
        "text": turn.text,
        "payload": json.loads(turn.payload_json or "{}"),
        "created_at": as_iso(turn.created_at),
        "route": turn.route,
        "skill_id": turn.skill_id,
        "skill_version": turn.skill_version,
        "trace": json.loads(turn.trace_json or "[]"),
        "sources": json.loads(turn.sources_json or "[]"),
        "suggested_action": json.loads(turn.action_json) if turn.action_json else None,
        "model_mode": turn.model_mode,
    }


def dialog_history(db: Session, conversation_id: str, limit: int = 8) -> str:
    """同一医生会话的近期发言，供模型衔接语气；事实仍以 grounding 为准。"""
    turns = db.scalars(
        select(ConversationTurn)
        .where(ConversationTurn.conversation_id == conversation_id, ConversationTurn.kind == "message")
        .order_by(ConversationTurn.created_at.desc())
        .limit(limit)
    ).all()
    lines: list[str] = []
    for turn in reversed(list(turns)):
        who = "代表" if turn.role == "user" else "助手"
        lines.append(f"{who}：{turn.text[:240]}")
    return "\n".join(lines)


def ensure_conversation(db: Session, conversation_id: str | None, user_id: str) -> Conversation | None:
    if not conversation_id:
        return None
    conversation = db.get(Conversation, conversation_id)
    if not conversation or conversation.user_id != user_id:
        raise HTTPException(status_code=404, detail="会话不存在或无权访问。")
    return conversation


def create_conversation_for(db: Session, user_id: str, customer_id: str) -> Conversation:
    customer = get_customer(customer_id)
    conversation = Conversation(
        id=str(uuid4()),
        user_id=user_id,
        customer_id=customer_id,
        customer_name=customer["name"],
        title=f"{customer['name']} · 服务记录",
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def create_unbound_conversation(db: Session, user_id: str) -> Conversation:
    conversation = Conversation(
        id=str(uuid4()),
        user_id=user_id,
        customer_id=None,
        customer_name=None,
        title="新对话",
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def get_or_create_conversation(db: Session, user_id: str, customer_id: str) -> Conversation:
    existing = db.scalar(
        select(Conversation)
        .where(Conversation.user_id == user_id, Conversation.customer_id == customer_id)
        .order_by(Conversation.updated_at.desc())
    )
    if existing:
        return existing
    return create_conversation_for(db, user_id, customer_id)


def bind_conversation_customer(conversation: Conversation, customer_id: str, customer_name: str) -> None:
    if conversation.customer_id and conversation.customer_id != customer_id:
        raise HTTPException(status_code=400, detail="当前会话已绑定其他医生，请改选该医生的服务记录。")
    if not conversation.customer_id:
        conversation.customer_id = customer_id
        conversation.customer_name = customer_name
        conversation.title = f"{customer_name} · 服务记录"


def save_turn(db: Session, conversation_id: str, role: str, text: str, *, kind: str = "message", payload: dict | None = None, **metadata: object) -> None:
    db.add(ConversationTurn(
        id=str(uuid4()), conversation_id=conversation_id, role=role, kind=kind, text=text,
        payload_json=json.dumps(payload or {}, ensure_ascii=False),
        route=metadata.get("route"), skill_id=metadata.get("skill_id"), skill_version=metadata.get("skill_version"),
        trace_json=json.dumps(metadata.get("trace", []), ensure_ascii=False),
        sources_json=json.dumps(metadata.get("sources", []), ensure_ascii=False),
        action_json=json.dumps(metadata["suggested_action"], ensure_ascii=False) if metadata.get("suggested_action") else None,
        model_mode=metadata.get("model_mode"),
    ))


def refreshed_customer(db: Session, conversation: Conversation) -> dict | None:
    if not conversation.customer_id:
        return None
    customer = get_customer(conversation.customer_id)
    turns = db.scalars(select(ConversationTurn).where(
        ConversationTurn.conversation_id == conversation.id,
        ConversationTurn.kind == "visit_confirmed").order_by(ConversationTurn.created_at.asc())).all()
    for turn in turns:
        event = json.loads(turn.payload_json or "{}")
        if not event.get("feedback"):
            continue
        customer["last_feedback"] = event["feedback"]
        customer["last_visit"] = as_iso(turn.created_at)
        customer["interactions"].append({"date": as_iso(turn.created_at), "type": "拜访记录", "detail": event["feedback"]})
        customer["interaction_excerpt"] = "；".join(item["detail"] for item in customer["interactions"][-5:])
        for change in event.get("ladder_updates", []):
            for item in customer.get("perception_ladder", []):
                if item["dimension"] == change["dimension"]:
                    item["level"] = change["to"]
        if event.get("ladder_updates"):
            customer["tier"] = " / ".join(f"{x['dimension']}：{x['level']}" for x in customer.get("perception_ladder", []))
    task_ids = [json.loads(t.payload_json or "{}").get("task_id") for t in turns]
    tasks = db.scalars(select(FollowUpTask).where(FollowUpTask.id.in_([x for x in task_ids if x]), FollowUpTask.status == "open")).all()
    if turns:
        customer["open_task"] = "；".join([customer["open_task"], *(t.title for t in tasks)])
    customer["saved_tasks"] = [{"id": t.id, "title": t.title, "status": t.status} for t in tasks]
    return customer


async def prepare_run(request: AgentRequest, db: Session) -> tuple[Conversation | None, dict | None, dict]:
    """执行 Agent 图并落地待确认草稿；不做最终回答的模型润色（交由端点层）。"""
    conversation = ensure_conversation(db, request.conversation_id, request.user_id)
    customer_id = request.customer_id or (conversation.customer_id if conversation else None)
    customer = get_customer(customer_id) if customer_id else None
    if conversation is None:
        if customer_id:
            conversation = get_or_create_conversation(db, request.user_id, customer_id)
        else:
            conversation = create_unbound_conversation(db, request.user_id)
        request.conversation_id = conversation.id
    elif customer_id and customer:
        bind_conversation_customer(conversation, customer_id, customer["name"])
    previous = db.scalar(select(VisitDraft).where(
        VisitDraft.conversation_id == conversation.id,
        VisitDraft.status == "awaiting_confirmation",
    ).order_by(VisitDraft.id.desc()))
    query = request.message
    raw_privacy = detect_pii(query)
    if previous and request.mode == "auto" and any(word in query for word in ("补充", "改成", "改为")):
        request.mode = "post"
    # A draft belongs to one visit, not one utterance. Corrections occur last.
    if request.mode == "post" and previous:
        query = json.loads(previous.payload_json or "{}").get("transcript", "") + "。\n" + query
    if request.mode == "post":
        for span in detect_pii(query)["spans"]:
            query = query.replace(span, "[已脱敏]")
    context = refreshed_customer(db, conversation)
    token = customer_overrides.set({customer_id: context} if customer_id and context else {})
    try:
        result = await run_agent(query, request.mode, customer_id)
    finally:
        customer_overrides.reset(token)
    if result.get("route") == "post_visit":
        result["privacy"] = raw_privacy
        for span in detect_pii(request.message)["spans"]:
            request.message = request.message.replace(span, "[已脱敏]")
    result["history"] = dialog_history(db, conversation.id) if conversation else ""
    action = result.get("suggested_action")
    if result.get("route") == "post_visit" and result.get("extracted") and action and customer:
        extracted = result["extracted"]
        if previous:
            previous.status = "superseded"
        draft = VisitDraft(
            id=str(uuid4()), conversation_id=request.conversation_id, customer_name=customer["name"],
            feedback=extracted["feedback"], next_visit=extracted["next_visit"], follow_up=extracted["follow_up"],
            confirmation_token=f"confirm-{uuid4().hex}",
            payload_json=json.dumps({"transcript": query, "extracted": extracted,
                "todo_decision": "ignore", "todo_suggestion": result.get("todo_suggestion")}, ensure_ascii=False),
        )
        db.add(draft)
        db.commit()
        action = {**action, "draft_id": draft.id, "confirmation_token": draft.confirmation_token}
        result["suggested_action"] = action
    return conversation, customer, result


def persist_run(db: Session, request: AgentRequest, conversation: Conversation | None, result: dict) -> dict:
    run_id = str(uuid4())
    action = result.get("suggested_action")
    if conversation:
        if conversation.title == "新对话":
            conversation.title = f"{conversation.customer_name} · 服务记录" if conversation.customer_name else request.message.strip()[:40]
        conversation.updated_at = datetime.utcnow()
        save_turn(db, conversation.id, "user", request.message)
        save_turn(
            db, conversation.id, "assistant", result["reply"],
            route=result["route"], skill_id=result.get("skill_id"), skill_version=result.get("skill_version"),
            trace=result["trace"], sources=result.get("sources", []), suggested_action=action, model_mode=result["model_mode"],
            payload={
                "extracted": result.get("extracted"),
                "privacy": result.get("privacy"),
                "off_label": result.get("off_label"),
                "todo_suggestion": result.get("todo_suggestion"),
                "citation": result.get("citation"),
            },
        )
        db.add(AgentRun(id=run_id, conversation_id=conversation.id, route=result["route"], skill_id=result.get("skill_id"), skill_version=result.get("skill_version"), model_mode=result["model_mode"], trace_json=json.dumps(result["trace"], ensure_ascii=False)))
        db.commit()
    result["run_id"] = run_id
    result["conversation_id"] = conversation.id if conversation else request.conversation_id
    return result


def public_result(result: dict) -> dict:
    """去掉仅供内部流转的 grounding/fallback/history 字段。"""
    return {k: v for k, v in result.items() if k not in ("grounding", "fallback", "history")}


async def finalize_reply(request: AgentRequest, result: dict) -> None:
    """非流式路径：用模型基于 grounding 生成最终回答（无 key 时回退 fallback）。"""
    grounding = result.get("grounding")
    if grounding:
        reply, model_mode = await llm_compose(request.message, grounding, result.get("fallback") or result["reply"], result.get("history") or "")
        result["reply"] = reply
        result["model_mode"] = model_mode


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "agent": "langgraph", "model_mode": settings.ai_provider, "llm": llm_enabled(), "skills": 5}


@app.post(f"{settings.api_prefix}/agent")
async def agent(request: AgentRequest, db: Session = Depends(get_db)) -> dict:
    conversation, _customer, result = await prepare_run(request, db)
    await finalize_reply(request, result)
    persist_run(db, request, conversation, result)
    return public_result(result)


def _chunk(text: str, size: int = 2) -> list[str]:
    return [text[i:i + size] for i in range(0, len(text), size)]


@app.post(f"{settings.api_prefix}/agent/stream")
async def agent_stream(request: AgentRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    def sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: " + json.dumps(data, ensure_ascii=False) + "\n\n"

    async def events():
        yield sse("status", {"label": "Planner", "detail": "正在识别任务和合规边界", "state": "active"})
        conversation, _customer, result = await prepare_run(request, db)
        for trace in result["trace"]:
            yield sse("trace", trace)
            await asyncio.sleep(0.06)

        grounding = result.get("grounding")
        fallback = result.get("fallback") or result["reply"]
        history = result.get("history") or ""
        if grounding and llm_enabled():
            accumulated = ""
            try:
                async for delta in stream_chat(compose_messages(request.message, grounding, history)):
                    accumulated += delta
                    yield sse("token", {"text": delta})
                if accumulated.strip():
                    result["reply"] = accumulated.strip()
                    result["model_mode"] = "deepseek"
                else:
                    raise RuntimeError("empty-stream")
            except Exception:  # 模型流失败：退回本地分段输出
                result["reply"] = fallback
                result["model_mode"] = "local-fallback"
                for chunk in _chunk(fallback):
                    yield sse("token", {"text": chunk})
                    await asyncio.sleep(0.05)
        else:
            text = result["reply"]
            for chunk in _chunk(text):
                yield sse("token", {"text": chunk})
                await asyncio.sleep(0.05)

        persist_run(db, request, conversation, result)
        yield sse("final", public_result(result))

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post(f"{settings.api_prefix}/conversations")
def create_conversation(request: ConversationCreateRequest, db: Session = Depends(get_db)) -> dict:
    conversation = create_conversation_for(db, request.user_id, request.customer_id)
    return serialize_conversation(conversation)


@app.get(f"{settings.api_prefix}/customers")
def customers(user_id: str = "mr-demo-001", db: Session = Depends(get_db)) -> list[dict]:
    result = []
    for customer in list_customers():
        conversation = db.scalar(select(Conversation).where(Conversation.user_id == user_id,
            Conversation.customer_id == customer["id"]).order_by(Conversation.updated_at.desc()))
        result.append(refreshed_customer(db, conversation) if conversation else customer)
    return result


@app.get(f"{settings.api_prefix}/detail-aids")
def detail_aids(customer_id: str = "liu-min") -> dict:
    """面对面拜访使用的已审批电子手卡（Detail Aids）。"""
    customer = get_customer(customer_id)
    return {"product": customer["product"], "customer_name": customer["name"], "aids": read_detail_aids(customer["product"])}


@app.get(f"{settings.api_prefix}/recommend-articles")
def recommend_articles_endpoint() -> list[dict]:
    return list_recommend_articles()


@app.get(f"{settings.api_prefix}/conversations")
def list_conversations(user_id: str = "mr-demo-001", db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.updated_at.desc()).limit(20)).all()
    items = []
    for row in rows:
        item = serialize_conversation(row)
        item["turn_count"] = db.scalar(select(func.count()).select_from(ConversationTurn).where(ConversationTurn.conversation_id == row.id)) or 0
        items.append(item)
    return items


@app.get(f"{settings.api_prefix}/conversations/{{conversation_id}}")
def get_conversation(conversation_id: str, user_id: str = "mr-demo-001", db: Session = Depends(get_db)) -> dict:
    conversation = ensure_conversation(db, conversation_id, user_id)
    assert conversation is not None
    turns = db.scalars(select(ConversationTurn).where(ConversationTurn.conversation_id == conversation.id).order_by(ConversationTurn.created_at.asc())).all()
    return {
        "id": conversation.id,
        "title": conversation.title,
        "updated_at": as_iso(conversation.updated_at),
        "customer_id": conversation.customer_id,
        "customer_name": conversation.customer_name,
        "turns": [serialize_turn(turn) for turn in turns],
    }


@app.post(f"{settings.api_prefix}/conversations/{{conversation_id}}/events")
def add_timeline_event(conversation_id: str, request: TimelineEventRequest, db: Session = Depends(get_db)) -> dict:
    """把面对面拜访等非 Agent 事件写入该医生的会话时间线；不写 CRM。"""
    conversation = ensure_conversation(db, conversation_id, request.user_id)
    assert conversation is not None
    for draft in db.scalars(select(VisitDraft).where(VisitDraft.conversation_id == conversation_id,
            VisitDraft.status == "awaiting_confirmation")).all():
        draft.status = "superseded"
    aids = [item.model_dump() for item in request.shown_aids]
    titles = "、".join(item.get("title", "") for item in aids[:2] if item.get("title")) or "未记录手卡"
    extra = f"等 {len(aids)} 张" if len(aids) > 2 else (f" · {len(aids)} 张" if aids else "")
    text = f"面对面拜访已结束：展示{titles}{extra}，时长 {request.seconds} 秒。"
    conversation.updated_at = datetime.utcnow()
    save_turn(db, conversation.id, "system", text, kind="visit_session", payload={"seconds": request.seconds, "shown_aids": aids})
    db.commit()
    return {"ok": True, "conversation_id": conversation.id, "kind": "visit_session", "text": text}


@app.get(f"{settings.api_prefix}/developer/runs")
def developer_runs(conversation_id: str | None = None, user_id: str = "mr-demo-001", db: Session = Depends(get_db)) -> list[dict]:
    statement = select(AgentRun).order_by(AgentRun.created_at.desc()).limit(30)
    if conversation_id:
        statement = select(AgentRun).where(AgentRun.conversation_id == conversation_id).order_by(AgentRun.created_at.desc()).limit(30)
    statement = statement.join(Conversation, AgentRun.conversation_id == Conversation.id).where(Conversation.user_id == user_id)
    rows = db.scalars(statement).all()
    return [{"id": row.id, "conversation_id": row.conversation_id, "route": row.route, "skill_id": row.skill_id, "skill_version": row.skill_version, "model_mode": row.model_mode, "trace": json.loads(row.trace_json), "created_at": as_iso(row.created_at)} for row in rows]


@app.post(f"{settings.api_prefix}/bonus/simulate")
def bonus_simulate(request: BonusRequest) -> dict:
    return run_bonus_simulation_skill(request.target, request.achieved)


def owned_draft(db: Session, draft_id: str | None, token: str, user_id: str) -> VisitDraft:
    draft = db.get(VisitDraft, draft_id) if draft_id else None
    if not draft or draft.confirmation_token != token:
        raise HTTPException(status_code=400, detail="草稿或确认令牌无效。")
    ensure_conversation(db, draft.conversation_id, user_id)
    if draft.status not in ("awaiting_confirmation", "confirmed"):
        raise HTTPException(status_code=409, detail="草稿已更新，请核对最新版本。")
    return draft


@app.post(f"{settings.api_prefix}/visits/confirm")
def confirm_visit(request: ConfirmVisitRequest, db: Session = Depends(get_db)) -> dict:
    draft = owned_draft(db, request.draft_id, request.confirmation_token, request.user_id)
    payload = json.loads(draft.payload_json or "{}")
    if draft.status == "confirmed":
        return payload["receipt"]
    # Stable IDs and a transactional status claim make retries idempotent.
    from sqlalchemy import update
    claimed = db.execute(update(VisitDraft).where(VisitDraft.id == draft.id,
        VisitDraft.status == "awaiting_confirmation").values(status="confirmed"))
    if claimed.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="提交正在处理，请刷新记录。")
    conversation = ensure_conversation(db, draft.conversation_id, request.user_id)
    assert conversation is not None
    customer = get_customer(conversation.customer_id)
    feedback = request.feedback.strip() or draft.feedback
    for span in detect_pii(feedback)["spans"]:
        feedback = feedback.replace(span, "[已脱敏]")
    next_visit = request.next_visit.strip() or "待确认"
    follow_up = (request.follow_up or draft.follow_up).strip()
    for span in detect_pii(follow_up)["spans"]:
        follow_up = follow_up.replace(span, "[已脱敏]")
    visit_id = "VIS-" + draft.id.replace("-", "")[:24]
    adopted = request.todo_decision == "adopt"
    task_id = "TSK-" + draft.id.replace("-", "")[:24] if adopted else None
    db.add(VisitRecord(id=visit_id, customer_name=customer["name"], product=customer["product"],
        feedback=feedback, next_visit=next_visit))
    if adopted:
        db.add(FollowUpTask(id=task_id, visit_id=visit_id, title=f"{next_visit} · {follow_up}"[:240]))
    receipt = {"ok": True, "visit_id": visit_id, "task_id": task_id,
        "message": "拜访记录已保存" + ("，跟进任务已创建。" if adopted else "，未创建跟进任务。")}
    payload.update({"receipt": receipt, "todo_decision": request.todo_decision})
    draft.payload_json = json.dumps(payload, ensure_ascii=False)
    save_turn(db, conversation.id, "system", receipt["message"], kind="visit_confirmed", payload={
        **receipt, "draft_id": draft.id, "next_visit": next_visit, "feedback": feedback,
        "follow_up": follow_up, "ladder_updates": payload.get("extracted", {}).get("ladder_updates", []) if feedback == draft.feedback else []})
    conversation.updated_at = datetime.utcnow()
    db.commit()
    return receipt


@app.post(f"{settings.api_prefix}/tasks/decision")
def task_decision(request: TodoDecisionRequest, db: Session = Depends(get_db)) -> dict:
    draft = owned_draft(db, request.draft_id, request.confirmation_token, request.user_id)
    if draft.status != "awaiting_confirmation":
        raise HTTPException(status_code=409, detail="拜访已提交。")
    payload = json.loads(draft.payload_json or "{}")
    payload["todo_decision"] = request.decision
    draft.payload_json = json.dumps(payload, ensure_ascii=False)
    for turn in db.scalars(select(ConversationTurn).where(ConversationTurn.conversation_id == draft.conversation_id,
            ConversationTurn.role == "assistant")).all():
        if json.loads(turn.action_json or "{}").get("draft_id") == draft.id:
            turn_payload = json.loads(turn.payload_json or "{}")
            turn_payload["todo_decision"] = request.decision
            turn.payload_json = json.dumps(turn_payload, ensure_ascii=False)
    db.commit()
    return {"ok": True, "adopted": request.decision == "adopt",
        "message": "选择已保存，将在最终确认拜访时生效。"}
