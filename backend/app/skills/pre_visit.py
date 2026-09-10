from app.services.demo_data import CITATION, MATERIAL_SOURCE, crm_interaction_source
from app.services.tools import (
    read_customer_context,
    read_detail_aids,
    read_institution_status,
    retrieve_approved_evidence,
)

SKILL_ID = "pre_visit_preparation"
SKILL_VERSION = "2.0.0"


def run_pre_visit_skill(query: str, customer_id: str = "liu-min") -> dict:
    """从 CRM 与已审批知识工具生成受控的访前简报，并带出面对面拜访要用的手卡。"""
    customer_context = read_customer_context(customer_id)
    evidence = retrieve_approved_evidence(query, customer_context["last_feedback"])
    institution = read_institution_status(customer_id) if any(word in query for word in ("机构", "进药", "院内")) else None
    return {
        "skill_id": SKILL_ID,
        "skill_version": SKILL_VERSION,
        "customer_context": customer_context,
        "evidence": evidence,
        "institution": institution,
        "detail_aids": read_detail_aids(customer_context.get("product", "达必妥")),
        "citation": None if institution else evidence["citation"],
        "sources": [crm_interaction_source(customer_context), *evidence["documents"]] if not institution else [crm_interaction_source(customer_context)],
        "requires_confirmation": False,
    }
