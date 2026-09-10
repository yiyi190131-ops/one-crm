"""只读业务工具与确定性红线校验。

这些函数是 Agent 的"事实来源"：CRM 上下文、已审批证据、机构状态、手卡，
以及访后场景里的确定性规则（观念阶梯抽取兜底、隐私脱敏、超适应症拦截、奖金计算）。
无论是否接入大模型，这些红线都以规则为准，模型不得覆盖。
"""

import re

from app.services.demo_data import (
    CITATION,
    PERCEPTION_DIMENSIONS,
    detail_aids_for,
    get_customer,
    recommend_articles,
)


def read_customer_context(customer_id: str = "liu-min") -> dict:
    return get_customer(customer_id)


def retrieve_approved_evidence(query: str, context: str = "") -> dict:
    from app.services.evidence import search_evidence
    return search_evidence(query, context)


def read_institution_status(customer_id: str = "liu-min") -> dict:
    return get_customer(customer_id)["institution"]


def read_detail_aids(product: str = "达必妥") -> list[dict]:
    """返回当前产品的已审批电子手卡（Detail Aids）。"""
    return detail_aids_for(product)


def list_recommend_articles() -> list[dict]:
    return recommend_articles()


def calculate_bonus(target: float, achieved: float) -> dict:
    rate = achieved / target
    multiplier = 1.35 if rate >= 1.15 else 1 if rate >= 1 else 0.65 if rate >= 0.8 else 0
    return {
        "target": target,
        "achieved": achieved,
        "rate": round(rate * 100),
        "multiplier": multiplier,
        "amount": round(6800 * multiplier),
        "policy": "2026 H2 MR 绩效激励政策 · V1.4",
    }


# ---------------------------------------------------------------------------
# 访后确定性红线：观念阶梯抽取兜底、隐私脱敏、超适应症拦截。
# ---------------------------------------------------------------------------

# 每个观念阶梯维度的口语关键词与情感判定线索。
_DIMENSION_HINTS: dict[str, dict[str, list[str]]] = {
    "长期安全": {
        "keywords": ["长期安全", "安全性", "长期数据", "安全", "长期"],
        "positive": ["认可", "充分", "放心", "肯定", "比较认可", "数据充分"],
        "concern": ["疑虑", "担心", "顾虑", "不认可", "不放心", "存疑"],
        "strong": ["推荐", "首选", "会用", "愿意用"],
    },
    "维稳": {
        "keywords": ["维稳", "稳控", "稳定", "控制", "维持"],
        "positive": ["认可", "满意", "不错", "有效"],
        "concern": ["疑虑", "担心", "顾虑", "不认可", "存疑", "更多临床证据", "临床证据"],
        "strong": ["推荐", "首选", "会用"],
    },
}


def _judge_level(sentence: str, hints: dict[str, list[str]]) -> str | None:
    has_concern = any(word in sentence for word in hints["concern"])
    has_positive = any(word in sentence for word in hints["positive"])
    has_strong = any(word in sentence for word in hints["strong"])
    if has_concern:
        return "中立"
    if has_strong:
        return "认可且推荐"
    if has_positive:
        return "认可"
    return None


def extract_visit_record(transcript: str) -> dict:
    """从访后口语记录里做确定性抽取（大模型不可用时的兜底）。

    返回观念阶梯变化、下次拜访、感兴趣资料等结构化字段。
    """
    text = transcript or ""
    ladder_updates: list[dict] = []
    for dimension in PERCEPTION_DIMENSIONS:
        hints = _DIMENSION_HINTS.get(dimension)
        if not hints:
            continue
        # 只在提到该维度关键词的句子附近判定情感，避免串味。
        clauses = re.split(r"[。；;\n]", text)
        relevant = [c for c in clauses if any(kw in c for kw in hints["keywords"])]
        window = relevant[-1] if relevant else ""
        level = _judge_level(window, hints) if window else None
        if level:
            ladder_updates.append({"dimension": dimension, "to": level})

    next_visit = _extract_next_visit(text)
    interested_topic = _extract_interested_topic(text)
    return {
        "ladder_updates": ladder_updates,
        "next_visit": next_visit,
        "interested_topic": interested_topic,
    }


_NEXT_VISIT_RE = re.compile(
    r"(下周[一二三四五六日天]|下次|下回|下星期[一二三四五六日天])[^。，,\n]{0,6}(上午|下午|早上|晚上)?"
)


def _extract_next_visit(text: str) -> str | None:
    matches = list(_NEXT_VISIT_RE.finditer(text))
    match = matches[-1] if matches else None
    if not match:
        return None
    return match.group(0).strip("，。 ")


_INTEREST_HINTS = [
    ("青少年", "青少年/儿童患者适用性与长期治疗研究"),
    ("儿童", "青少年/儿童患者适用性与长期治疗研究"),
    ("生长发育", "长期治疗对生长发育影响的真实世界研究"),
    ("发病机制", "发病机制相关学术资料"),
    ("真实世界", "真实世界研究数据"),
]


def _extract_interested_topic(text: str) -> str | None:
    for keyword, topic in _INTEREST_HINTS:
        if keyword in text:
            return topic
    return None


# 患者隐私识别：姓名 + 地址（门牌）。命中即高亮并从写回中剔除。
_ADDRESS_RE = re.compile(r"[\u4e00-\u9fa5]{2,}(?:省|市|区|县)?[\u4e00-\u9fa5]{1,8}(?:路|街|道|弄|巷|号楼|小区)[0-9０-９]*号?")
_PATIENT_NAME_RE = re.compile(r"(?:患者|病人|老干部|随访(?:的)?(?:患者|病人)?)[^。，,\n]{0,6}?叫([\u4e00-\u9fa5]{2,3})")


def detect_pii(transcript: str) -> dict:
    """检测潜在患者隐私（姓名 + 住址），返回需高亮忽略的片段。"""
    text = transcript or ""
    spans: list[str] = []
    for match in _ADDRESS_RE.finditer(text):
        spans.append(match.group(0))
    for match in _PATIENT_NAME_RE.finditer(text):
        spans.append(match.group(1))
    # 去重并保留原文顺序。
    seen: set[str] = set()
    unique = [s for s in spans if not (s in seen or seen.add(s))]
    return {
        "flagged": bool(unique),
        "spans": unique,
        "reason": "检测到潜在患者隐私信息（姓名/住址），已标记高亮并从写回中忽略。" if unique else "",
    }


# 超适应症（off-label）拦截：达必妥当前演示适应症为 AD，其余为超范围。
_OFF_LABEL_TERMS = ["银屑病", "白癜风", "超适应症", "超范围"]


def detect_off_label(transcript: str) -> dict:
    """检测访后记录里出现的超适应症诉求。"""
    text = transcript or ""
    for term in _OFF_LABEL_TERMS:
        if term in text:
            return {
                "flagged": True,
                "term": term,
                "notice": f"“{term}”不在当前已批准适应症范围内，我不能据此给出医学结论，建议联系医学团队。",
            }
    return {"flagged": False, "term": None, "notice": ""}
