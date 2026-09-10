"""DeepSeek 适配层：让真模型驱动意图理解、口语抽取与回答组织。

设计原则：
- 配置 AI_PROVIDER=deepseek 且提供 key 时，模型真正参与对话；否则一律本地降级，Demo 仍可运行。
- 模型只负责"理解 / 抽取 / 组织表达"，事实、引用、金额、红线判定仍由确定性工具决定，模型输出会被后端校验后再使用。
"""

import json
from typing import AsyncIterator

import httpx

from app.core.config import get_settings


def llm_enabled() -> bool:
    settings = get_settings()
    return settings.ai_provider == "deepseek" and bool(settings.deepseek_api_key)


def _endpoint() -> str:
    settings = get_settings()
    return f"{settings.deepseek_base_url.rstrip('/')}/chat/completions"


def _headers() -> dict:
    settings = get_settings()
    return {"Authorization": f"Bearer {settings.deepseek_api_key}"}


async def _chat(messages: list[dict], *, temperature: float = 0.3, max_tokens: int = 600, force_json: bool = False) -> str | None:
    """一次性对话调用；失败或未启用时返回 None，由调用方决定本地兜底。"""
    if not llm_enabled():
        return None
    settings = get_settings()
    payload: dict = {
        "model": settings.deepseek_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if force_json:
        payload["response_format"] = {"type": "json_object"}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(_endpoint(), headers=_headers(), json=payload)
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None


async def stream_chat(messages: list[dict], *, temperature: float = 0.5, max_tokens: int = 700) -> AsyncIterator[str]:
    """流式对话；逐段产出模型增量文本。

    若未启用或首个请求失败会抛出异常，调用方据此退回本地分段输出。
    """
    if not llm_enabled():
        raise RuntimeError("deepseek-disabled")
    settings = get_settings()
    payload = {
        "model": settings.deepseek_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=40) as client:
        async with client.stream("POST", _endpoint(), headers=_headers(), json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content")
                except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                    continue
                if delta:
                    yield delta


# ---------------------------------------------------------------------------
# 高层能力：意图分类 / 口语抽取 / 回答组织。
# ---------------------------------------------------------------------------

_ROUTES = ["pre_visit", "post_visit", "customer_insight", "material_recommendation", "institution_access", "capability_guide", "guardrail"]


async def llm_classify_intent(query: str) -> str | None:
    """用模型判定路由；不可用或结果非法时返回 None（交由关键词兜底）。"""
    system = (
        "你是医药代表 CRM Agent 的意图路由器。只输出 JSON：{\"route\": <route>}。"
        "route 取值仅限：pre_visit(访前准备)、post_visit(访后记录)、customer_insight(客户互动洞察)、"
        "material_recommendation(材料/文章推荐)、institution_access(机构进药/准入/供应)、"
        "capability_guide(询问你能做什么)、guardrail(超适应症或高风险医学问题，如银屑病等非批准适应症)。"
    )
    content = await _chat(
        [{"role": "system", "content": system}, {"role": "user", "content": query}],
        temperature=0,
        max_tokens=40,
        force_json=True,
    )
    if not content:
        return None
    try:
        route = json.loads(content).get("route")
    except (json.JSONDecodeError, AttributeError):
        return None
    return route if route in _ROUTES else None


async def llm_extract_visit(transcript: str, dimensions: list[str], levels: list[str]) -> dict | None:
    """让模型从口语记录里抽取结构化字段；结果由调用方再做白名单校验。"""
    system = (
        "你是医药代表拜访记录抽取器。从代表口述里抽取医生观念变化，只输出 JSON："
        "{\"ladder_updates\":[{\"dimension\":<维度>,\"to\":<等级>}],\"next_visit\":<字符串或null>,\"interested_topic\":<字符串或null>}。"
        f"维度只能取：{dimensions}；等级只能取：{levels}（由低到高）。"
        "只在口述明确表达了某维度态度时才输出该维度；没有则不输出。不要臆造事实。"
    )
    content = await _chat(
        [{"role": "system", "content": system}, {"role": "user", "content": transcript}],
        temperature=0,
        max_tokens=300,
        force_json=True,
    )
    if not content:
        return None
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


_COMPOSE_SYSTEM = (
    "你是合规的医药 CRM 助手。请用简洁、自然、口语化的中文回答代表的问题，"
    "但只能基于我提供的『已取回数据』组织表达：不得新增任何医学事实、数值、适应症、风险、承诺或外部知识；"
    "引用、金额、机构数据只能来自已取回数据。回答控制在 60-220 字，纯文本。"
)


def compose_messages(user_query: str, grounding: str, history: str = "") -> list[dict]:
    """供流式接口复用的 compose 提示词。"""
    prior = f"\n\n此前同一医生会话：\n{history}\n" if history else ""
    return [
        {"role": "system", "content": _COMPOSE_SYSTEM},
        {"role": "user", "content": f"代表问题：{user_query}{prior}\n已取回数据：\n{grounding}\n\n请据此自然作答；可承接此前对话，但不得引入已取回数据之外的事实。"},
    ]


async def llm_compose(user_query: str, grounding: str, fallback: str, history: str = "") -> tuple[str, str]:
    """基于工具已取回数据组织自然回答；不可用时返回本地 fallback。"""
    content = await _chat(compose_messages(user_query, grounding, history), temperature=0.5, max_tokens=500)
    if content and len(content) >= 20:
        return content, "deepseek"
    return fallback, "local"


# 兼容旧调用名：仅做草稿改写/组织表达。
async def optional_llm_rewrite(system: str, user: str, fallback: str) -> tuple[str, str]:
    return await llm_compose(user, fallback, fallback)
