"""SDD Golden Set 的轻量回归 Harness。

在本地模式（无模型 key）下运行，路由与抽取走确定性规则，断言结果稳定。
"""
import asyncio
import json
from pathlib import Path

from app.agent.graph import run_agent


def _check_case(case: dict, result: dict) -> list[str]:
    errors: list[str] = []
    trace_states = [step["state"] for step in result["trace"]]

    if case.get("expect_route") and result["route"] != case["expect_route"]:
        errors.append(f"route={result['route']} 期望 {case['expect_route']}")
    if case.get("expect_skill") and result.get("skill_id") != case["expect_skill"]:
        errors.append(f"skill={result.get('skill_id')} 期望 {case['expect_skill']}")
    if "expect_citation" in case and case["expect_citation"] != (result["citation"] is not None):
        errors.append("citation 断言失败")
    if "expect_action" in case and case["expect_action"] != (result.get("suggested_action") or {}).get("type"):
        errors.append("action 断言失败")
    if case.get("expect_guarded") and "guarded" not in trace_states:
        errors.append("safety guard 断言失败")
    if case.get("expect_source") and not any(case["expect_source"] in source.get("title", "") for source in result.get("sources", [])):
        errors.append("selected customer source 断言失败")
    if case.get("expect_privacy") and not (result.get("privacy") or {}).get("flagged"):
        errors.append("privacy 断言失败：未检测到隐私")
    if case.get("expect_off_label") and not (result.get("off_label") or {}).get("flagged"):
        errors.append("off_label 断言失败：未拦截超适应症")
    if case.get("expect_next_visit"):
        next_visit = (result.get("extracted") or {}).get("next_visit", "")
        if case["expect_next_visit"] not in next_visit:
            errors.append(f"next_visit={next_visit} 未包含 {case['expect_next_visit']}")
    if case.get("expect_ladder"):
        want = case["expect_ladder"]
        updates = (result.get("extracted") or {}).get("ladder_updates", [])
        if not any(u.get("dimension") == want["dimension"] and u.get("to") == want["to"] for u in updates):
            errors.append(f"ladder 断言失败：未见 {want['dimension']}→{want['to']}")
    if case.get("expect_reply_contains") and case["expect_reply_contains"] not in (result.get("reply") or ""):
        errors.append(f"reply 未包含 {case['expect_reply_contains']}")
    if case.get("expect_reply_not_contains") and case["expect_reply_not_contains"] in (result.get("reply") or ""):
        errors.append(f"reply 不应包含 {case['expect_reply_not_contains']}")
    return errors


async def evaluate() -> int:
    cases = json.loads(Path(__file__).with_name("eval_cases.json").read_text())
    failed = 0
    for case in cases:
        result = await run_agent(case["query"], case["mode"], case.get("customer_id", "liu-min"))
        errors = _check_case(case, result)
        status = "PASS" if not errors else "FAIL"
        if errors:
            failed += 1
        print(f"{status} {case['id']}" + (f" :: {'; '.join(errors)}" if errors else ""))
    print(f"\n{len(cases) - failed}/{len(cases)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(evaluate()))
