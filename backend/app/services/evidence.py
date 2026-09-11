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
    {"id": "demo-expired", "title": "演示旧版：长期安全性", "tags": ["安全"], "excerpt": "旧版，不得返回。", "valid_to": "2020-01-01"},
    {"id": "demo-unapproved", "title": "未审批演示材料", "tags": ["安全"], "excerpt": "未审批，不得返回。", "approved": False},
]

def search_evidence(query: str, context: str = "") -> dict:
    text = query.replace("达必拓", "达必妥").lower()
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
