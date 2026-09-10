from app.services.tools import calculate_bonus

SKILL_ID = "bonus_simulation"
SKILL_VERSION = "1.0.0"


def run_bonus_simulation_skill(target: float, achieved: float) -> dict:
    result = calculate_bonus(target, achieved)
    return {
        "skill_id": SKILL_ID,
        "skill_version": SKILL_VERSION,
        "requires_confirmation": False,
        **result,
    }
