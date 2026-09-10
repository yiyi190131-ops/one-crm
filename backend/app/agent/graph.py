from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.services.llm import llm_classify_intent
from app.services.tavily import optional_tavily_search
from app.skills.pre_visit import run_pre_visit_skill
from app.skills.visit_record import run_visit_record_skill
from app.skills.workspace_skills import (
    run_customer_insight_skill,
    run_institution_access_skill,
    run_material_recommendation_skill,
)

Route = Literal["pre_visit", "post_visit", "customer_insight", "material_recommendation", "institution_access", "capability_guide", "guardrail"]

DEFAULT_CUSTOMER = "liu-min"


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
    "post_visit": ["抽取访后关键信息", "隐私与字段校验", "生成待确认 CRM 草稿"],
    "material_recommendation": ["读取客户上下文", "检索已审批材料", "输出可用材料建议"],
    "institution_access": ["读取机构准入状态", "核对运营与供应风险", "汇总业务建议"],
    "customer_insight": ["读取客户 360°", "整理互动与待办", "生成拜访洞察"],
    "pre_visit": ["读取 CRM 上下文", "检索已审批证据", "生成访前准备"],
}


def _keyword_route(query: str, mode: str) -> Route:
    if mode == "post":
        return "post_visit"
    if "银屑病" in query or "超适应症" in query:
        return "guardrail"
    if any(phrase in query for phrase in ("你能做什么", "可以做什么", "有什么功能", "能帮我什么", "如何使用", "帮助")):
        return "capability_guide"
    if any(word in query for word in ("访后", "拜访反馈", "记录本次", "记录医生反馈")):
        return "post_visit"
    if any(word in query for word in ("材料", "资料", "文献", "文章")):
        return "material_recommendation"
    if any(word in query for word in ("机构", "进药", "准入", "院内", "供应", "运营")):
        return "institution_access"
    if any(word in query for word in ("互动", "洞察", "最近", "历史", "客户360", "上次", "待办", "观念阶梯")):
        return "customer_insight"
    return "pre_visit"


async def planner(state: AgentState) -> AgentState:
    query = state["query"].replace(" ", "")
    keyword_route = _keyword_route(query, state["mode"])
    route: Route = keyword_route

    # 超适应症为 P0 安全项：关键词命中即硬拦截，不交给模型翻案。
    if keyword_route != "guardrail" and state["mode"] != "post":
        llm_route = await llm_classify_intent(state["query"])
        if llm_route:
            route = llm_route  # type: ignore[assignment]

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
    return {
        "reply": "我可以帮你完成五类工作：\n1. 客户洞察：查看近期互动、观念和待办；\n2. 访前准备：生成拜访重点与已审批资料；\n3. 材料推荐：按医生需求匹配可用材料；\n4. 机构准入：查询进药、覆盖和供应风险；\n5. 访后记录：从语音或文本生成草稿，确认后再写入 CRM。\n\n你可以直接说，例如“查一下刘敏主任最近的互动记录”。",
        "trace": append_trace(state, "能力说明", "未调用业务数据或医学资料工具", "done"),
        "model_mode": "local",
        "sources": [],
        "citation": None,
        "skill_id": "capability_guide",
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
        return f"客户：{customer['name']}，阶段：{customer['tier']}。近期互动：{result['summary']} 未完成待办：{customer['open_task']}"
    if route == "material_recommendation":
        return f"可用材料摘要：{result['summary']}。以下均为虚构演示材料，不构成医学依据。"
    if route == "institution_access":
        status = result["institution"]
        return f"机构目录状态：{status['formulary']}，{status['coverage_trend']}，供应风险：{status['supply_risk']}。此为机构运营数据，不构成医学建议。"
    customer = result["customer_context"]
    return f"客户：{customer['name']}。上次反馈：{customer['last_feedback']} 未完成待办：{customer['open_task']} 可用演示材料：{'；'.join(d['title'] for d in result['evidence']['documents']) or '未找到匹配材料，请补充主题'}。"


def _fallback_reply(route: str, result: dict) -> str:
    if route == "post_visit":
        return f"我已从本次记录中抽取出观念变化和下次拜访信息，并生成一份待确认的 CRM 草稿：{result['extracted']['follow_up']} 请核对后再提交。"
    if route == "customer_insight":
        customer = result["context"]
        return f"{customer['name']}当前处于{customer['tier']}阶段。最近互动：{result['summary']} 建议本次先回应其已表达的资料需求，并推进待办“{customer['open_task']}”。"
    if route == "material_recommendation":
        return result["summary"] + "（演示资料库，不构成真实医学依据。）"
    if route == "institution_access":
        status = result["institution"]
        return f"该院目录状态{status['formulary']}，{status['coverage_trend']}，供应风险为“{status['supply_risk']}”。该结论来自机构运营数据，不构成医学建议。"
    customer = result["customer_context"]
    return f"已为{customer['name']}完成访前准备：先回应医生的既有顾虑“{customer['last_feedback']}”，再推进待办“{customer['open_task']}”；{'相关演示材料已列在下方。' if result['evidence']['documents'] else '未找到相关有效材料，请补充主题。'}"


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
    graph.add_node("pre_visit", execute_pre_visit)
    graph.add_node("customer_insight", execute_customer_insight)
    graph.add_node("material_recommendation", execute_material_recommendation)
    graph.add_node("institution_access", execute_institution_access)
    graph.add_node("post_visit", execute_post_visit)
    graph.add_node("synthesizer", synthesizer)
    graph.add_edge(START, "planner")
    graph.add_conditional_edges("planner", planner_edge, {"pre_visit": "pre_visit", "post_visit": "post_visit", "customer_insight": "customer_insight", "material_recommendation": "material_recommendation", "institution_access": "institution_access", "capability_guide": "capability_guide", "guardrail": "guardrail"})
    for node in ("pre_visit", "customer_insight", "material_recommendation", "institution_access", "post_visit"):
        graph.add_edge(node, "synthesizer")
    graph.add_edge("synthesizer", END)
    graph.add_edge("guardrail", END)
    graph.add_edge("capability_guide", END)
    return graph.compile()


agent_graph = build_graph()


async def run_agent(query: str, mode: Literal["auto", "pre", "post"] = "auto", customer_id: str = DEFAULT_CUSTOMER) -> dict:
    result = await agent_graph.ainvoke({"query": query, "mode": mode, "customer_id": customer_id, "trace": []})
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
