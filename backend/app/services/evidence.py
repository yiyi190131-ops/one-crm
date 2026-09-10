"""Small searchable demo corpus. Keyword ranking, NOT vector RAG or real medical evidence."""
from datetime import date

DOCUMENTS = [
    {"id": "demo-safety", "title": "演示材料：长期安全性沟通提纲", "tags": ["安全", "血栓", "JAK", "长期"],
     "excerpt": "模拟学术沟通提纲：记录医生对长期安全性的具体疑问，核对资料研究人群、随访时间和局限性。不提供真实药物比较结论。"},
    {"id": "demo-control", "title": "演示材料：长期疾病管理沟通提纲", "tags": ["维稳", "控制", "管理", "依从", "复发"],
     "excerpt": "模拟沟通提纲：了解医生关注的疾病管理难点，记录需补充的研究问题与后续沟通事项。"},
    {"id": "demo-youth", "title": "演示材料：青少年研究资料需求清单", "tags": ["青少年", "儿童", "生长", "发育"],
     "excerpt": "模拟资料需求清单：核对年龄范围、研究设计、观察指标及证据局限；实际适用范围以真实获批资料为准。"},
    {"id": "demo-expired", "title": "演示旧版：长期安全性", "tags": ["安全"], "excerpt": "旧版，不得返回。", "valid_to": "2020-01-01"},
    {"id": "demo-unapproved", "title": "未审批演示材料", "tags": ["安全"], "excerpt": "未审批，不得返回。", "approved": False},
]

def search_evidence(query: str, context: str = "") -> dict:
    text = query.lower()
    generic = any(x in text for x in ("准备", "推荐", "合适", "拜访", "材料", "资料"))
    matches = []
    for doc in DOCUMENTS:
        if not doc.get("approved", True) or doc.get("valid_to", "2099-12-31") < date.today().isoformat():
            continue
        score = sum(3 for tag in doc["tags"] if tag.lower() in text)
        if generic and not any(tag.lower() in text for d in DOCUMENTS for tag in d["tags"]):
            score += sum(1 for tag in doc["tags"] if tag.lower() in context.lower())
        if score:
            matches.append((score, {"id": doc["id"], "kind": "approved-evidence", "title": doc["title"],
                "version": "DEMO-1.0", "status": "演示审批通过 · 虚构材料", "location": "演示资料库 / 沟通提纲", "excerpt": doc["excerpt"]}))
    matches.sort(key=lambda pair: (-pair[0], pair[1]["id"]))
    docs = [item for _, item in matches[:3]]
    return {"query": query, "hit_count": len(docs), "citation": docs[0] if docs else None, "documents": docs}
