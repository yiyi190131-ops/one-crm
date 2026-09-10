"""访后记录 Skill：从口语记录抽取结构化草稿。

顺序：优先用大模型抽取观念阶梯/下次拜访/兴趣点，模型不可用时退回确定性规则；
隐私脱敏与超适应症拦截永远以确定性规则为准，不受模型影响；本 Skill 永不写库。
"""

from app.services.demo_data import (
    LADDER_LEVELS,
    PERCEPTION_DIMENSIONS,
    get_customer,
    recommend_articles,
)
from app.services.llm import llm_extract_visit
from app.services.tools import detect_off_label, detect_pii, extract_visit_record

SKILL_ID = "visit_record"
SKILL_VERSION = "2.0.0"


def _current_ladder(customer: dict) -> dict[str, str]:
    return {item["dimension"]: item["level"] for item in customer.get("perception_ladder", [])}


def _sanitize_updates(raw_updates: list[dict], current: dict[str, str]) -> list[dict]:
    """只保留合法维度与等级，并补上 from（当前等级）。"""
    updates: list[dict] = []
    seen: set[str] = set()
    for item in raw_updates or []:
        dimension = (item or {}).get("dimension")
        to = (item or {}).get("to")
        if dimension not in PERCEPTION_DIMENSIONS or to not in LADDER_LEVELS:
            continue
        if dimension in seen:
            continue
        seen.add(dimension)
        updates.append({"dimension": dimension, "from": current.get(dimension, "中立"), "to": to})
    return updates


def _pick_article(interested_topic: str | None) -> dict | None:
    if not interested_topic:
        return None
    from app.services.evidence import search_evidence
    citation = search_evidence(interested_topic)["citation"]
    return {"id": citation["id"], "title": citation["title"], "status": citation["status"]} if citation else None


def _feedback_summary(updates: list[dict], off_label: dict) -> str:
    if not updates:
        base = "已记录本次拜访反馈。"
    else:
        parts = [f"{u['dimension']}：{u['from']} → {u['to']}" for u in updates]
        base = "医生观念更新 —— " + "；".join(parts) + "。"
    if off_label.get("flagged"):
        base += f"（另检测到超适应症诉求“{off_label['term']}”，已按合规拦截，不进入医学结论。）"
    return base


def _redact(text: str) -> str:
    for span in detect_pii(text)["spans"]:
        text = text.replace(span, "[已脱敏]")
    return text


async def run_visit_record_skill(transcript: str, customer_id: str = "liu-min") -> dict:
    customer = get_customer(customer_id)
    current = _current_ladder(customer)

    # 1) 结构化抽取：优先大模型，失败退回规则。
    llm_result = await llm_extract_visit(transcript, PERCEPTION_DIMENSIONS, LADDER_LEVELS)
    extraction = llm_result or extract_visit_record(transcript)
    updates = _sanitize_updates(extraction.get("ladder_updates", []), current)
    next_visit = extraction.get("next_visit")
    interested_topic = extraction.get("interested_topic")

    # 2) 确定性红线：隐私脱敏 + 超适应症拦截（始终基于原始记录）。
    privacy = detect_pii(transcript)
    off_label = detect_off_label(transcript)

    # 3) 待办建议与推荐文章。
    article = _pick_article(interested_topic)
    todo_suggestion = {
        "date": next_visit or "待确认",
        "material": article["title"] if article else "待补充相关资料",
        "article_id": article["id"] if article else "",
        "type": "follow-up-visit",
    } if next_visit or interested_topic else None

    follow_up_bits = []
    if interested_topic:
        follow_up_bits.append(f"准备{interested_topic}")
    if next_visit:
        follow_up_bits.append(f"预约{next_visit}复访")
    follow_up = "，并".join(follow_up_bits) + "。" if follow_up_bits else "整理本次拜访要点并跟进医生关注问题。"

    extracted = {
        "feedback": _redact(transcript),
        "ladder": " / ".join(f"{u['dimension']} {u['to']}" for u in updates) or "未识别到明确变化",
        "ladder_updates": updates,
        "next_visit": next_visit or "待确认",
        "interested_topic": interested_topic,
        "follow_up": follow_up,
        "recommend_article": article,
    }

    return {
        "skill_id": SKILL_ID,
        "skill_version": SKILL_VERSION,
        "source_transcript": transcript,
        "extracted": extracted,
        "privacy": privacy,
        "off_label": off_label,
        "todo_suggestion": todo_suggestion,
        "write_back": {"allowed": False, "reason": "需要用户确认与 confirmation_token"},
        "sources": [],
    }
