from typing import Literal, TypedDict
import re

from langgraph.graph import END, START, StateGraph

from app.services.demo_data import CUSTOMERS
from app.services.llm import llm_classify_intent
from app.services.tavily import optional_tavily_search
from app.skills.pre_visit import run_pre_visit_skill
from app.skills.visit_record import run_visit_record_skill
from app.skills.workspace_skills import (
    run_customer_insight_skill,
    run_institution_access_skill,
    run_material_recommendation_skill,
)

Route = Literal[
    "pre_visit",
    "post_visit",
    "customer_insight",
    "material_recommendation",
    "institution_access",
    "capability_guide",
    "need_customer",
    "customer_not_found",
    "customer_roster",
    "clarify",
    "guardrail",
]
_CUSTOMER_ROUTES = {"pre_visit", "post_visit", "customer_insight", "institution_access"}

DEFAULT_CUSTOMER = "liu-min"
_HELP_PHRASES = ("你能做什么", "可以做什么", "有什么功能", "能帮我什么", "如何使用", "帮助")
_DOMAIN_HINTS = (
    "访前", "访后", "拜访", "医生", "主任", "客户", "达必妥", "达必拓", "度普利尤",
    "材料", "资料", "文献", "文章", "互动", "待办", "洞察", "进药", "进院", "机构", "准入",
    "开场", "观念", "手卡", "准备", "安全", "适应症", "医院", "科室", "记录", "反馈", "阶梯",
)
_CLARIFY_HINTS = (
    "帮我", "看看", "怎么样", "如何", "怎么办", "那个", "这个", "再说", "继续", "然后",
    "讲讲", "说下", "了解", "想问", "请问", "有点", "不太清", "什么意思", "再确认", "嗯",
)
_OFFTOPIC_HARD = ("天气", "下雨", "股票", "彩票", "笑话", "外卖", "打车", "足球", "篮球", "游戏")
_ROSTER_HINTS = (
    "哪些医生", "哪些客户", "医生名单", "客户名单", "医生列表", "客户列表",
    "所有医生", "全部医生", "都有谁", "医生有哪些", "客户有哪些", "有哪些医生",
)
_GUIDE_PHRASES: dict[str, Route] = {
    "医生信息查询": "customer_insight",
    "拜访历史回顾": "customer_insight",
    "智能拜访建议": "pre_visit",
    "进院状态查询": "institution_access",
}
_GUIDE_BODY = (
    "我可以帮你完成五类工作：\n"
    "1. 客户洞察：查看近期互动、观念和待办；\n"
    "2. 访前准备：生成拜访重点与已审批资料；\n"
    "3. 材料推荐：按医生需求匹配可用材料；\n"
    "4. 机构准入：查询进药、覆盖和供应风险；\n"
    "5. 访后记录：从语音或文本生成草稿，确认后再写入 CRM。\n\n"
    "你可以直接说，例如“查一下刘敏主任最近的互动记录”。"
)
_CLARIFY_BODY = (
    "我还没完全理解你的意思，我们先对齐一下。你更想做哪一件？\n"
    "1. 查医生近期互动、观念或待办\n"
    "2. 做访前准备 / 找已审批材料\n"
    "3. 记一条访后反馈\n"
    "4. 看院内进药或供应情况\n\n"
    "直接回一句具体需求就行，例如“查一下刘敏主任最近互动”。"
)
_NAME_BLOCK = {
    "该", "这", "那", "某", "贵", "本", "您", "你", "他", "她", "我", "们", "的", "和", "与",
    "其", "各", "有", "无", "请", "帮", "查", "找", "问", "看", "说", "听", "让", "给",
    "皮肤科", "儿科", "内科", "外科", "科室", "医院", "协会", "医师", "代表", "客户", "目标",
    "随访", "主治", "副主", "主任医",
    "哪些", "所有", "全部", "各位", "几位", "哪位", "其他", "别的",
}


class AgentState(TypedDict, total=False):
    query: str
    mode: Literal["auto", "pre", "post"]
    customer_id: str
    route: Route
    plan: list[str]
    trace: list[dict]
    skill_result: dict
    reply: str
    extracted: dict
    suggested_action: dict
    privacy: dict
    off_label: dict
    todo_suggestion: dict | None
    model_mode: str
    sources: list[dict]
    citation: dict | None
    skill_id: str
    skill_version: str
    grounding: str
    fallback: str


def append_trace(state: AgentState, label: str, detail: str, status: str = "done") -> list[dict]:
    return [*state.get("trace", []), {"label": label, "detail": detail, "state": status}]


_PLANS: dict[str, list[str]] = {
    "guardrail": ["合规预检"],
    "capability_guide": ["说明当前可用业务能力"],
    "clarify": ["澄清代表意图"],
    "need_customer": ["确认拜访对象"],
    "customer_not_found": ["核对客户名单"],
    "post_visit": ["抽取访后关键信息", "隐私与字段校验", "生成待确认 CRM 草稿"],
    "material_recommendation": ["读取客户上下文", "检索已审批材料", "输出可用材料建议"],
    "institution_access": ["读取机构准入状态", "核对运营与供应风险", "汇总业务建议"],
    "customer_insight": ["读取客户 360°", "整理互动与待办", "生成拜访洞察"],
    "pre_visit": ["读取 CRM 上下文", "检索已审批证据", "生成访前准备"],
}


def _customer_aliases() -> list[str]:
    aliases: list[str] = []
    for item in CUSTOMERS.values():
        raw = item["name"].replace(" ", "")
        aliases.append(raw)
        for suffix in ("主任", "医生", "大夫", "教授"):
            if raw.endswith(suffix) and len(raw) > len(suffix):
                aliases.append(raw[: -len(suffix)])
    return sorted(set(aliases), key=len, reverse=True)


def _customer_names() -> list[str]:
    return _customer_aliases()


def _known_customer_hit(query: str) -> bool:
    return any(alias in query for alias in _customer_aliases())


def _unknown_doctor_label(query: str) -> str | None:
    """若口述里像在点名某位医生，但演示客户名单未命中，返回该称呼。"""
    if _known_customer_hit(query):
        return None
    stripped = query
    for prefix in ("查一下", "查找", "查询", "找一下", "拜访一下", "看看", "看一下"):
        stripped = stripped.replace(prefix, "")
    if stripped.startswith("拜访") and not stripped.startswith("拜访反馈"):
        stripped = stripped[2:]
    for match in re.finditer(r"([\u4e00-\u9fff]{1,4})(医生|主任|大夫|教授)", stripped):
        person, title = match.group(1), match.group(2)
        if person in _NAME_BLOCK or any(token in person for token in ("皮肤科", "儿科", "内科", "外科", "科室", "医院", "一下", "上次")):
            continue
        if person.startswith(("一", "下", "的", "了", "和", "还", "缺")):
            continue
        return f"{person}{title}"
    return None


def _asked_help(query: str) -> bool:
    return any(phrase in query for phrase in _HELP_PHRASES)


def _wants_roster(query: str) -> bool:
    """问的是演示名单本身，不是某位已点名的医生。"""
    if _known_customer_hit(query):
        return False
    return any(phrase in query for phrase in _ROSTER_HINTS)


def _is_offtopic(query: str) -> bool:
    """仅「完全无关」才视为超范围；含糊但可能跟拜访有关的走澄清。"""
    if _asked_help(query):
        return False
    if _known_customer_hit(query) or _unknown_doctor_label(query):
        return False
    if any(word in query for word in _OFFTOPIC_HARD):
        return True
    if re.fullmatch(r"\d+", query or ""):
        return True
    if any(word in query for word in _DOMAIN_HINTS):
        return False
    if any(word in query for word in _CLARIFY_HINTS):
        return False
    # 短中文业务口语优先澄清，不直接判超范围
    if any("\u4e00" <= ch <= "\u9fff" for ch in query) and len(query) <= 24:
        return False
    return True


def _keyword_route(query: str, mode: str) -> Route:
    if mode == "post":
        return "post_visit"
    if "银屑病" in query or "超适应症" in query:
        return "guardrail"
    if _asked_help(query):
        return "capability_guide"
    if _wants_roster(query):
        return "customer_roster"
    for phrase, route in _GUIDE_PHRASES.items():
        if phrase in query:
            return route
    # 点到未收录医生时，优先提示未找到，避免落到「超出能力范围」。
    if _unknown_doctor_label(query):
        return "customer_not_found"
    if any(word in query for word in ("访后", "拜访反馈", "记录本次", "记录医生反馈")):
        return "post_visit"
    if any(word in query for word in ("互动", "洞察", "最近", "历史", "客户360", "上次", "待办", "观念阶梯")):
        return "customer_insight"
    if any(phrase in query for phrase in ("是什么", "什么是", "介绍一下", "简介")):
        return "material_recommendation"
    if any(word in query for word in ("材料", "资料", "文献", "文章")):
        return "material_recommendation"
    if any(name in query for name in ("达必妥", "达必拓", "度普利尤")) and not any(
        phrase in query for phrase in ("准备", "拜访", "访前", "开场", "待办")
    ):
        return "material_recommendation"
    if any(word in query for word in ("机构", "进药", "进院", "准入", "院内", "供应", "运营")):
        return "institution_access"
    if any(phrase in query for phrase in ("访前", "帮我准备", "拜访重点", "续方拜访", "开场")):
        return "pre_visit"
    if _known_customer_hit(query):
        return "pre_visit"
    # 完全无关 → 能力说明；其余含糊表达 → 先澄清，不直接说超出能力。
    if _is_offtopic(query):
        return "capability_guide"
    return "clarify"


async def planner(state: AgentState) -> AgentState:
    query = state["query"].replace(" ", "").replace("达必拓", "达必妥")
    keyword_route = _keyword_route(query, state["mode"])
    route: Route = keyword_route

    # 未命中明确关键词时，允许模型细分；结果仍须在白名单内。
    if (
        keyword_route in {"capability_guide", "clarify"}
        and state["mode"] != "post"
        and not _asked_help(query)
        and not _is_offtopic(query)
    ):
        llm_route = await llm_classify_intent(state["query"])
        if llm_route in {
            "pre_visit",
            "post_visit",
            "customer_insight",
            "material_recommendation",
            "institution_access",
            "clarify",
            "capability_guide",
            "guardrail",
        }:
            route = llm_route  # type: ignore[assignment]

    # 模型若仍判成能力说明，但并非完全无关/求助，改为澄清追问。
    if route == "capability_guide" and not _asked_help(query) and not _is_offtopic(query):
        route = "clarify"

    if not (state.get("customer_id") or "").strip() and route in _CUSTOMER_ROUTES:
        route = "need_customer"

    detail = f"已选择 {route} 路径"
    return {"route": route, "plan": _PLANS.get(route, []), "trace": append_trace(state, "Planner", detail)}


def planner_edge(state: AgentState) -> str:
    return state["route"]


async def guardrail(state: AgentState) -> AgentState:
    return {
        "reply": "这个问题不在达必妥®当前已批准的适应症范围内。我不能据此给出医学结论，建议联系医学团队获取正式支持。",
        "trace": append_trace(state, "合规预检", "发现超适应症风险 · 已拦截", "guarded"),
        "model_mode": "local",
        "sources": [],
        "citation": None,
    }


async def capability_guide(state: AgentState) -> AgentState:
    query = state["query"].replace(" ", "")
    prefix = "" if _asked_help(query) else "这个问题跟拜访工作关系不大，我暂时帮不上。我目前只能处理拜访相关的事。\n\n"
    return {
        "reply": prefix + _GUIDE_BODY,
        "trace": append_trace(state, "能力说明", "未调用业务数据或医学资料工具", "done"),
        "model_mode": "local",
        "sources": [],
        "citation": None,
        "skill_id": "capability_guide",
        "skill_version": "1.1.0",
    }


async def clarify(state: AgentState) -> AgentState:
    return {
        "reply": _CLARIFY_BODY,
        "trace": append_trace(state, "意图澄清", "表达不够明确，先追问对齐", "done"),
        "model_mode": "local",
        "sources": [],
        "citation": None,
        "skill_id": "clarify",
        "skill_version": "1.0.0",
    }


def _roster_lines() -> list[str]:
    lines = []
    for item in CUSTOMERS.values():
        grade = item.get("grade") or "—"
        lines.append(f"{item['name']}，{item['hospital']}{item['department']}，{grade}")
    return lines


async def customer_roster(state: AgentState) -> AgentState:
    lines = _roster_lines()
    names = "、".join(item["name"] for item in CUSTOMERS.values())
    grounding = "当前演示客户名单（只能使用这些医生，不要增删）：\n" + "\n".join(lines)
    fallback = f"当前演示里有 {len(lines)} 位医生：{names}。你点一位姓名，我就可以查互动、做访前准备或记访后。"
    return {
        "reply": fallback,
        "fallback": fallback,
        "grounding": grounding,
        "trace": append_trace(state, "客户名单", f"已列出 {len(lines)} 位演示医生", "done"),
        "model_mode": "local",
        "sources": [],
        "citation": None,
        "skill_id": "customer_roster",
        "skill_version": "1.0.0",
    }


async def need_customer(state: AgentState) -> AgentState:
    return {
        "reply": "先告诉我是哪位医生，把姓名发给我就行。确认后我再帮你查互动、做访前准备或记访后记录。",
        "trace": append_trace(state, "待选医生", "当前问题依赖客户上下文，尚未选定医生", "done"),
        "model_mode": "local",
        "sources": [],
        "citation": None,
        "skill_id": "need_customer",
        "skill_version": "1.0.0",
    }


async def customer_not_found(state: AgentState) -> AgentState:
    label = _unknown_doctor_label(state["query"].replace(" ", "")) or "该医生"
    options = "、".join(item["name"] for item in list(CUSTOMERS.values())[:5])
    return {
        "reply": (
            f"未找到「{label}」。当前演示客户名单里没有这位医生。"
            f"你可以换一位继续，例如：{options}等。"
        ),
        "trace": append_trace(state, "客户核对", f"名单未命中：{label}", "done"),
        "model_mode": "local",
        "sources": [],
        "citation": None,
        "skill_id": "customer_not_found",
        "skill_version": "1.0.0",
    }


async def execute_pre_visit(state: AgentState) -> AgentState:
    result = run_pre_visit_skill(state["query"], state.get("customer_id", DEFAULT_CUSTOMER))
    trace = append_trace(state, "CRM 上下文工具", "已读取客户、互动与待办")
    trace = [*trace, {"label": "已审批资料工具", "detail": "已完成有效版本与审批状态过滤", "state": "done"}]
    if "联网" in state["query"] or "外部资料" in state["query"]:
        web = await optional_tavily_search(state["query"])
        trace = [*trace, {"label": "公网背景检索", "detail": "仅作背景补充，不进入医学结论", "state": "done" if web.get("enabled") else "guarded"}]
    return {"skill_result": result, "trace": trace, "sources": result["sources"], "citation": result["citation"], "skill_id": result["skill_id"], "skill_version": result["skill_version"]}


async def execute_customer_insight(state: AgentState) -> AgentState:
    result = run_customer_insight_skill(state["query"], state.get("customer_id", DEFAULT_CUSTOMER))
    trace = append_trace(state, "客户 360° 工具", "已读取互动记录、观念与待办")
    return {"skill_result": result, "trace": trace, "sources": result["sources"], "citation": None, "skill_id": result["skill_id"], "skill_version": result["skill_version"]}


async def execute_material_recommendation(state: AgentState) -> AgentState:
    result = run_material_recommendation_skill(state["query"], state.get("customer_id", DEFAULT_CUSTOMER))
    trace = append_trace(state, "客户上下文工具", "已获取学术需求与上次反馈")
    trace = [*trace, {"label": "材料库检索", "detail": "只返回医学与合规审批通过的资料", "state": "done"}]
    return {"skill_result": result, "trace": trace, "sources": result["sources"], "citation": result["evidence"]["citation"], "skill_id": result["skill_id"], "skill_version": result["skill_version"]}


async def execute_institution_access(state: AgentState) -> AgentState:
    result = run_institution_access_skill(state["query"], state.get("customer_id", DEFAULT_CUSTOMER))
    trace = append_trace(state, "机构准入工具", "已读取目录、覆盖趋势与供应风险")
    return {"skill_result": result, "trace": trace, "sources": result["sources"], "citation": None, "skill_id": result["skill_id"], "skill_version": result["skill_version"]}


async def execute_post_visit(state: AgentState) -> AgentState:
    result = await run_visit_record_skill(state["query"], state.get("customer_id", DEFAULT_CUSTOMER))
    trace = append_trace(state, "访后信息抽取", "已识别反馈、观念变化、预约与资料需求")
    privacy = result["privacy"]
    if privacy.get("flagged"):
        trace = [*trace, {"label": "隐私与合规过滤", "detail": privacy["reason"], "state": "guarded"}]
    else:
        trace = [*trace, {"label": "隐私与合规过滤", "detail": "仅保留 CRM 写入所需业务字段", "state": "done"}]
    off_label = result["off_label"]
    if off_label.get("flagged"):
        trace = [*trace, {"label": "超适应症拦截", "detail": off_label["notice"], "state": "guarded"}]
    return {
        "skill_result": result,
        "extracted": result["extracted"],
        "privacy": privacy,
        "off_label": off_label,
        "todo_suggestion": result.get("todo_suggestion"),
        "trace": trace,
        "sources": [],
        "citation": None,
        "skill_id": result["skill_id"],
        "skill_version": result["skill_version"],
    }


def _grounding(route: str, result: dict) -> str:
    """把工具已取回的数据整理成 grounding 文本，供模型组织表达（不引入新事实）。"""
    if route == "post_visit":
        extracted = result["extracted"]
        lines = [f"观念阶梯变化：{extracted['ladder'] or '无明显变化'}", f"下次拜访：{extracted['next_visit']}", f"待办草稿：{extracted['follow_up']}"]
        if result["off_label"].get("flagged"):
            lines.append(f"合规提示：{result['off_label']['notice']}")
        if result["privacy"].get("flagged"):
            lines.append("隐私提示：记录中含患者隐私，已忽略相关信息。")
        return "\n".join(lines)
    if route == "customer_insight":
        customer = result["context"]
        grade = customer.get("grade") or "—"
        excerpt = customer.get("interaction_excerpt") or result.get("summary") or "暂无摘要"
        return (
            f"客户姓名：{customer['name']}\n"
            f"观念阶梯：{customer['tier']}\n"
            f"客户等级：{grade}\n"
            f"近期摘要：{excerpt}\n"
            f"未完成待办：{customer['open_task']}\n"
            f"补充摘要：{result['summary']}"
        )
    if route == "material_recommendation":
        docs = result.get("evidence", {}).get("documents") or result.get("sources") or []
        if not docs:
            return "未找到相关已审批资料，可换一个主题继续问。"
        return "已审批资料：\n" + "\n".join(f"《{doc['title']}》：{doc.get('excerpt', '')}" for doc in docs[:3])
    if route == "institution_access":
        status = result["institution"]
        return f"机构目录状态：{status['formulary']}，{status['coverage_trend']}，供应风险：{status['supply_risk']}。此为机构运营数据，不构成医学建议。"
    customer = result["customer_context"]
    return (
        f"客户：{customer['name']}\n"
        f"上次反馈：{customer['last_feedback']}\n"
        f"未完成待办：{customer['open_task']}\n"
        f"可用演示材料：{'；'.join(d['title'] for d in result['evidence']['documents']) or '未找到匹配材料，请补充主题'}。"
    )


def _fallback_reply(route: str, result: dict) -> str:
    if route == "post_visit":
        return (
            f"好的，我已从这段反馈里整理出观念变化和下次拜访信息，并生成待确认草稿："
            f"{result['extracted']['follow_up']} "
            f"你核对无误后再提交，我不会自动写入 CRM。"
        )
    if route == "customer_insight":
        customer = result["context"]
        excerpt = customer.get("interaction_excerpt") or ""
        summary = result.get("summary") or ""
        focus = excerpt or summary
        grade = customer.get("grade")
        grade_bit = f"（{grade}）" if grade else ""
        focus_bit = f"近期情况：{focus} " if focus else ""
        return (
            f"{customer['name']}目前处于「{customer['tier']}」阶段{grade_bit}。"
            f"{focus_bit}"
            f"建议优先推进待办「{customer['open_task']}」。"
            f"若要看明细，也可以继续问互动次数或上次反馈。"
        )
    if route == "material_recommendation":
        docs = result.get("evidence", {}).get("documents") or []
        if not docs:
            return "这轮没有检索到匹配的已审批资料。你可以换个主题，或说明医生最关心的顾虑点，我再帮你找。"
        lead = docs[0]
        return (
            f"我先给你一份已审批资料《{lead['title']}》。"
            f"{lead.get('excerpt', result['summary'])} "
            f"需要的话我可以再按青少年/安全性等主题继续筛。"
        )
    if route == "institution_access":
        status = result["institution"]
        return (
            f"该院目录状态是「{status['formulary']}」，{status['coverage_trend']}，"
            f"供应风险为「{status['supply_risk']}」。这是机构运营数据，不构成医学建议。"
            f"若要结合某位医生推进准入沟通，可以继续告诉我重点。"
        )
    customer = result["customer_context"]
    has_docs = bool(result["evidence"]["documents"])
    return (
        f"已为{customer['name']}备好访前重点：先回应其既有顾虑「{customer['last_feedback']}」，"
        f"再推进待办「{customer['open_task']}」。"
        f"{'相关已审批材料在下方，可直接开启面对面拜访。' if has_docs else '这轮未匹配到足够材料，你可以补充主题后再问我。'}"
    )

async def synthesizer(state: AgentState) -> AgentState:
    """整理 grounding 与 fallback，真正的模型调用放到端点层，保证单次调用并支持真流式。"""
    route = state["route"]
    result = state["skill_result"]
    action = None
    if route == "post_visit":
        action = {"type": "confirm-submit", "title": "确认写入 CRM", "description": result["extracted"]["follow_up"]}

    fallback = _fallback_reply(route, result)
    grounding = _grounding(route, result)
    return {
        "reply": fallback,
        "model_mode": "local",
        "grounding": grounding,
        "fallback": fallback,
        "suggested_action": action,
        "trace": append_trace(state, "Synthesizer", "已在已取回数据边界内生成答复", "done"),
    }


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("planner", planner)
    graph.add_node("guardrail", guardrail)
    graph.add_node("capability_guide", capability_guide)
    graph.add_node("clarify", clarify)
    graph.add_node("need_customer", need_customer)
    graph.add_node("customer_roster", customer_roster)
    graph.add_node("customer_not_found", customer_not_found)
    graph.add_node("pre_visit", execute_pre_visit)
    graph.add_node("customer_insight", execute_customer_insight)
    graph.add_node("material_recommendation", execute_material_recommendation)
    graph.add_node("institution_access", execute_institution_access)
    graph.add_node("post_visit", execute_post_visit)
    graph.add_node("synthesizer", synthesizer)
    graph.add_edge(START, "planner")
    graph.add_conditional_edges("planner", planner_edge, {
        "pre_visit": "pre_visit",
        "post_visit": "post_visit",
        "customer_insight": "customer_insight",
        "material_recommendation": "material_recommendation",
        "institution_access": "institution_access",
        "capability_guide": "capability_guide",
        "clarify": "clarify",
        "need_customer": "need_customer",
        "customer_roster": "customer_roster",
        "customer_not_found": "customer_not_found",
        "guardrail": "guardrail",
    })
    for node in ("pre_visit", "customer_insight", "material_recommendation", "institution_access", "post_visit"):
        graph.add_edge(node, "synthesizer")
    graph.add_edge("synthesizer", END)
    graph.add_edge("guardrail", END)
    graph.add_edge("capability_guide", END)
    graph.add_edge("clarify", END)
    graph.add_edge("need_customer", END)
    graph.add_edge("customer_roster", END)
    graph.add_edge("customer_not_found", END)
    return graph.compile()


agent_graph = build_graph()


async def run_agent(query: str, mode: Literal["auto", "pre", "post"] = "auto", customer_id: str | None = DEFAULT_CUSTOMER) -> dict:
    result = await agent_graph.ainvoke({"query": query, "mode": mode, "customer_id": customer_id or "", "trace": []})
    return {
        "reply": result["reply"],
        "trace": result["trace"],
        "citation": result.get("citation"),
        "sources": result.get("sources", []),
        "extracted": result.get("extracted"),
        "suggested_action": result.get("suggested_action"),
        "privacy": result.get("privacy"),
        "off_label": result.get("off_label"),
        "todo_suggestion": result.get("todo_suggestion"),
        "model_mode": result.get("model_mode", "local"),
        "route": result["route"],
        "skill_id": result.get("skill_id"),
        "skill_version": result.get("skill_version"),
        "grounding": result.get("grounding"),
        "fallback": result.get("fallback"),
    }
