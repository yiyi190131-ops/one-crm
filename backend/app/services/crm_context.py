from contextvars import ContextVar
from copy import deepcopy

customer_overrides: ContextVar[dict] = ContextVar("customer_overrides", default={})

def overlay_customer(customer: dict) -> dict:
    return deepcopy(customer_overrides.get().get(customer["id"], customer))
