from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Lumen Field CRM Agent API"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./crm_agent_demo.db"
    ai_provider: str = "local"
    deepseek_api_key: str | None = None
    deepseek_model: str = "deepseek-v4-flash"
    deepseek_base_url: str = "https://api.deepseek.com"
    tavily_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
