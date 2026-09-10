import httpx

from app.core.config import get_settings


async def optional_tavily_search(query: str) -> dict:
    """An opt-in public-web tool; never used for approved medical conclusions."""
    settings = get_settings()
    if not settings.tavily_api_key:
        return {"enabled": False, "reason": "TAVILY_API_KEY 未配置"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={"api_key": settings.tavily_api_key, "query": query, "search_depth": "basic", "max_results": 3},
            )
            response.raise_for_status()
            return {"enabled": True, "results": response.json().get("results", [])}
    except httpx.HTTPError:
        return {"enabled": False, "reason": "Tavily 服务暂不可用"}
