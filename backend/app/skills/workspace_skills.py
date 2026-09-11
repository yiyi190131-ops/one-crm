"""可版本化的工作台 Skill；所有数据均经只读工具取得。"""

from app.services.demo_data import MATERIAL_SOURCE, crm_interaction_source, institution_source
from app.services.tools import read_customer_context, read_institution_status, retrieve_approved_evidence


def run_customer_insight_skill(_: str, customer_id: str = "liu-min") -> dict:
    context = read_customer_context(customer_id)
    return {
        "skill_id": "customer_insight",
        "skill_version": "1.1.0",
        "context": context,
        "sources": [crm_interaction_source(context)],
        "summary": context["interaction_excerpt"],
        "interactions": context.get("interactions", []),
        "interaction_stats": context.get("interaction_stats", {}),
    }


def run_material_recommendation_skill(query: str, customer_id: str | None = "liu-min") -> dict:
    context = read_customer_context(customer_id) if customer_id else {}
    evidence = retrieve_approved_evidence(query, context.get("last_feedback", ""))
    return {
        "skill_id": "material_recommendation",
        "skill_version": "1.0.0",
        "context": context,
        "evidence": evidence,
        "sources": evidence["documents"],
        "summary": "；".join(d["title"] for d in evidence["documents"]) or "未找到相关有效演示材料，请补充主题或联系医学团队。",
    }


def run_institution_access_skill(_: str, customer_id: str = "liu-min") -> dict:
    context = read_customer_context(customer_id)
    status = read_institution_status(customer_id)
    return {
        "skill_id": "institution_access",
        "skill_version": "1.0.0",
        "institution": status,
        "sources": [institution_source(context)],
        "summary": f"目录状态{status['formulary']}，{status['coverage_trend']}，供应风险：{status['supply_risk']}。",
    }
