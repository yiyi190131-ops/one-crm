# Lumen Field · 医药代表 CRM Agent

可自由输入的个人演示原型：查询医生 → 检索材料 → 查看材料 → 多轮整理拜访记录 → 核对保存 → 再次查询记录和跟进任务。

## 启动

要求 Node.js 20.9+、Python 3.12+。首次运行：

```bash
npm ci
python -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

终端一（在项目根目录）：

```bash
AI_PROVIDER=local PYTHONPATH=backend backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

终端二：

```bash
npm run dev
```

浏览器打开 http://localhost:3000 。默认走同源 `/api` 代理；后端地址可通过服务端 `BACKEND_URL` 配置，无需让访客连接自己电脑的 localhost。

## 线上演示

不要把 Render 地址当作演示入口：免费实例休眠后再打开会先出现 Render 启动页，应用改不掉这张页。仓库里的 Docker 镜像现在只跑 FastAPI，冷启动比「Next + Python」整包快很多，但休眠唤醒仍然要等。

推荐拆开部署：

1. **前端用 Vercel 域名**（面试/演示只发这个链接）。在 Vercel 设置 `BACKEND_URL` 为 FastAPI 地址，例如 `https://<your-service>.onrender.com`。浏览器仍访问同源 `/api`，由 Next 反代到后端。
2. **后端只跑 FastAPI**（`API_ONLY=1`，uvicorn 监听 Render 的 `PORT`），用 SQLite 持久化会话。可选设置 `FRONTEND_URL` 为 Vercel 域名，误开 API 域名会跳转到前端。
3. 打开 Vercel 页面会立刻看到拜访助手；`/api/wake` 在后台敲 `/health`，不再用客户列表请求堵住首屏。
4. **免费保活**：仓库已带 `render.yaml`（Render Blueprint，API-only）和 GitHub Actions `keep-alive`（每 10 分钟请求 `/api/wake`）。在仓库 Secrets 设 `WAKE_URL=https://<vercel域名>/api/wake`。Vercel Hobby 自带 Cron 可能每天仅一次，以 Actions 为准。
5. 若必须 100% 去掉冷启动，将 Render 改为付费常驻；演示入口仍然只用 Vercel。

## 推荐体验

1. 选择一位医生，问“最近互动记录和待办是什么？”
2. 问“推荐长期安全资料”，再问“推荐青少年研究资料”，比较不同检索结果。
3. 点击某份材料的“打开此材料进行演示”，阅读后提交，进入访后记录。
4. 输入“医生不认可长期安全性，仍有顾虑。”，再补充“下周五上午复访，需要青少年资料。”
5. 选择采纳或忽略待办，点击提交拜访，核对并修改完整反馈、时间和跟进事项。
6. 确认保存后再问“上次拜访聊了什么，有哪些待办？”；刷新后记录仍可查询。

## 本次更新

- 多轮输入累计合并；新草稿替代旧草稿，新拜访重新开始。
- 采纳／忽略先保存选择，最终确认时才写入记录及可选任务；提交重试返回同一结果。
- 已保存记录、观念变化和任务回到当前访客的医生查询上下文。
- 小型演示材料库实际关键词检索，按主题返回结果，过滤旧版与未审批条目，无命中不补造引用。
- 修复“不认可”误判为“认可”、无抽取结果默认显示正面变化等问题。
- 当前材料内容可打开，展示记录与所选材料对应；确认表单可编辑。
- 浏览器随机访客标识隔离会话，写入验证所有者；同源 API 代理。
- 首页轻量说明与可选示例，仍允许用户自由提问。

## 实现范围

Next.js 16 / React 19；FastAPI / LangGraph / SQLAlchemy / SQLite。
默认 local 模式：分类与抽取使用规则，模型不可用也可验证数据库闭环。
可选 DeepSeek：用于意图分类、结构化抽取、组织回复；失败回退规则。
当前是固定任务编排与版本化 Python Skills，不是动态 ReAct 循环或 SKILL.md 运行时；资料库是关键词检索，不是向量 RAG。
客户、材料与审批标记均为虚构演示数据，不可作为真实医学证据；未连接企业 CRM。
访客标识仅用于演示隔离，不替代正式身份认证。原始 `/prototype` 路径为旧静态视觉参考，面试体验使用首页 `/`。

## 可选模型

在 `backend/.env` 中按 `.env.example` 配置，然后从 backend 目录启动后端（或通过终端环境变量传入）。不要将真实 Key 放入前端或对外代码包。

```bash
cd backend
PYTHONPATH=. .venv/bin/python -m uvicorn app.main:app --port 8000
```

本轮未使用外部 API Key，验证结论覆盖 local 模式，不代表已验证 DeepSeek 的线上响应质量。

## 验证

```bash
AI_PROVIDER=local PYTHONPATH=backend backend/.venv/bin/python backend/harness/eval_runner.py
PYTHONPATH=backend backend/.venv/bin/python backend/harness/test_visit_flow.py
npm run lint
npm run build
```

完整浏览器点击与外部模型效果仍需在实际运行环境验收。线上演示请使用 Vercel 域名，不要把 Render 启动页当作产品入口。
