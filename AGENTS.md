<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CRM Agent SDD Contract

在修改本项目之前，先阅读：

- `docs/sdd/01-product-spec.md`
- `docs/sdd/02-agent-contract.md`
- `docs/sdd/03-evaluation.md`
- `docs/sdd/04-skill-chains.md`

必须遵守：

1. 前端不能直接写 CRM；所有写入必须走 FastAPI 的确认接口。
2. 医学结论必须来自已批准的证据工具；无依据和超适应症请求进入 Guardrail。
3. 奖金金额只能由 `bonus_simulation` Skill 的确定性规则产生。
4. 改动路由、工具、规则或 Skill 时，新增或更新 Golden Set，并执行 `PYTHONPATH=backend backend/.venv/bin/python backend/harness/eval_runner.py`。
5. `AI_PROVIDER=local` 必须持续可运行；外部模型与 Tavily 只能是可选适配器，不能破坏无 Key 演示。
