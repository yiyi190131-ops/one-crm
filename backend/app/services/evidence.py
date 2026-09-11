"""Small searchable demo corpus. Keyword ranking, NOT vector RAG or real medical evidence."""
from datetime import date

DOCUMENTS = [
    {"id": "demo-product", "title": "演示材料：达必妥®产品沟通提纲", "tags": ["达必妥", "达必拓", "度普利尤单抗", "产品", "适应症"],
     "excerpt": "达必妥®（度普利尤单抗）可用于特应性皮炎等已批准适应症的拜访介绍。具体适应症、用法和安全性，请以最新说明书和医学已审批资料为准。本条为演示材料，不是真实医学结论。"},
    {"id": "demo-safety", "title": "演示材料：长期安全性沟通提纲", "tags": ["安全", "血栓", "JAK", "长期"],
     "excerpt": "拜访时记下医生对长期安全的具体担心，并对照资料里的研究人群、随访时间和局限说明。本条为演示材料，不能拿来做真实药物对比。"},
    {"id": "demo-control", "title": "演示材料：长期疾病管理沟通提纲", "tags": ["维稳", "控制", "管理", "依从", "复发"],
     "excerpt": "拜访时了解医生在疾病长期管理上的难点，记下还需要补充的研究问题和下次沟通事项。本条为演示材料。"},
    {"id": "demo-youth", "title": "演示材料：青少年研究资料需求清单", "tags": ["青少年", "儿童", "生长", "发育"],
     "excerpt": "推荐前先核对资料覆盖的年龄、研究设计、观察指标和证据局限。实际能讲什么，以真实获批资料为准。本条为演示材料。"},
    {"id": "demo-education", "title": "演示材料：患者教育与院内准入沟通提纲", "tags": ["患者教育", "教育", "准入", "院内", "目录", "患者"],
     "excerpt": "拜访时确认院内目录准入进度，并核对该院可用的已审批患者教育材料。具体话术与材料版本以医学已审批资料为准。本条为演示材料，不是真实医学结论。"},
    {"id": "demo-expired", "title": "演示旧版：长期安全性", "tags": ["安全"], "excerpt": "旧版，不得返回。", "valid_to": "2020-01-01"},
    {"id": "demo-unapproved", "title": "未审批演示材料", "tags": ["安全"], "excerpt": "未审批，不得返回。", "approved": False},
]

_GENERIC_WORDS = ("准备", "推荐", "合适", "拜访", "材料", "资料", "访前", "重点", "其他", "有什么", "有哪些", "帮我")
_NOISE_WORDS = ("主任", "医生", "吗", "呢", "的", "一下", "请", "查询", "相关", "有效", "今天", "续方", "还", "能", "可以", "有")


def customer_search_context(customer: dict | None) -> str:
    if not customer:
        return ""
    return " ".join(
        part for part in (
            customer.get("last_feedback", ""),
            customer.get("last_material", ""),
            customer.get("open_task", ""),
            customer.get("product", ""),
        )
        if part
    )


def _live_docs() -> list[dict]:
    today = date.today().isoformat()
    return [doc for doc in DOCUMENTS if doc.get("approved", True) and doc.get("valid_to", "2099-12-31") >= today]


def _customer_name_tokens() -> list[str]:
    from app.services.demo_data import CUSTOMERS
    names: list[str] = []
    for item in CUSTOMERS.values():
        raw = item["name"].replace(" ", "")
        names.append(raw)
        for suffix in ("主任", "医生"):
            if raw.endswith(suffix):
                names.append(raw[: -len(suffix)])
    return names


def _residue(text: str) -> str:
    cleaned = text
    for name in sorted(_customer_name_tokens(), key=len, reverse=True):
        cleaned = cleaned.replace(name, "")
    for word in (*_GENERIC_WORDS, *_NOISE_WORDS):
        cleaned = cleaned.replace(word, "")
    return "".join(ch for ch in cleaned if ch.isalnum() or "\u4e00" <= ch <= "\u9fff")


def _card(doc: dict) -> dict:
    return {
        "id": doc["id"], "kind": "approved-evidence", "title": doc["title"], "version": "DEMO-1.0",
        "status": "演示审批通过 · 虚构材料", "location": "演示资料库 / 沟通提纲", "excerpt": doc["excerpt"],
    }


def search_evidence(query: str, context: str = "") -> dict:
    text = query.replace("达必拓", "达必妥").lower()
    haystack = context.lower()
    live = _live_docs()
    residue = _residue(text)
    matches = []
    for doc in live:
        score = sum(3 for tag in doc["tags"] if tag.lower() in text)
        if not residue:
            score += sum(1 for tag in doc["tags"] if tag.lower() in haystack)
        if score:
            matches.append((score, _card(doc)))
    if not matches and not residue:
        product = next((doc for doc in live if doc["id"] == "demo-product"), None)
        if product:
            matches.append((1, _card(product)))
    matches.sort(key=lambda pair: (-pair[0], pair[1]["id"]))
    docs = [item for _, item in matches[:3]]
    return {"query": query, "hit_count": len(docs), "citation": docs[0] if docs else None, "documents": docs}
