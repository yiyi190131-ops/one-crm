# SDD-04｜可注册 Skill 任务链

## 设计原则

Skill 用来固化高频、参数明确、风险边界稳定的流程。LangGraph 负责路由与编排；Skill 负责内部步骤和可版本化契约；模型只能理解、补槽和解释，不能跨过规则或写接口。

## `pre_visit_preparation@1.0.0`

```text
输入：query + 页面客户上下文
  → read_customer_context（含观念阶梯基线）
  → retrieve_approved_evidence（版本/审批过滤）
  → read_detail_aids（面对面拜访电子手卡）
  → 可选 read_institution_status
  → 输出：客户摘要、证据、访前重点、可演示手卡
```

- 写入：无。
- 失败：资料无有效审批版本时不输出医学建议。
- 衔接：手卡屏把“已展示材料 + 展示时长”写入该医生的会话时间线，随访后记录一起进入草稿；确认写回后再追加一条已写入事件。

## `visit_record@1.0.0`

```text
输入：语音转写/文本记录
  → extract_visit_record（模型抽取 + 规则兜底）：观念阶梯变化、下次拜访、兴趣点
  → detect_pii（患者姓名/住址）→ 命中即高亮并从写回中脱敏
  → detect_off_label（超适应症）→ 命中即内联拦截，不给医学结论
  → 输出结构化草稿（ladder_updates / privacy / off_label / todo_suggestion）
  → 等待 confirmation_token
  → /visits/confirm 写回（含结构化 ladder 与跟进事项）
```

- 写入前置：用户明确点击确认、令牌通过、参数快照完整。
- 高风险红线：隐私与超适应症为确定性判定，模型不得覆盖；金额仍只来自 `bonus_simulation`。
- 失败：槽位缺失时回到澄清，不写回。

## 工作台只读 Skill

### `customer_insight@1.0.0`

```text
输入：客户洞察问题
  → read_customer_context
  → 读取互动时间线与未完成待办
  → 输出：客户阶段、近期互动、下一步建议
```

### `material_recommendation@1.0.0`

```text
输入：资料/材料需求
  → read_customer_context
  → retrieve_approved_evidence
  → 输出：只含审批通过版本的材料清单与引用
```

### `institution_access@1.0.0`

```text
输入：机构准入/进药/供应问题
  → read_institution_status
  → 输出：目录、覆盖和供应风险，不生成医学结论
```

## `bonus_simulation@1.0.0`

```text
输入：target、achieved
  → 匹配政策版本
  → calculate_bonus（确定性规则）
  → 输出 amount、rate、multiplier、policy
```

- 禁止：LLM 根据政策文本心算或补齐缺失参数。

## 2026-09 闭环更新（替代上述旧的多轮／确认描述）

- 同一拜访的追加输入合并为累计文本，最新生成的草稿使旧草稿失效。
- 新的 visit_session 开始新的拜访，旧的未确认草稿失效；不带入上次拜访文本。
- 最终确认展示完整反馈、下次时间与跟进事项，允许修改；未识别的信息不得填造。
- tasks/decision 只持久化采纳/忽略选择，不创建 CRM 任务。
- visits/confirm 校验访客、草稿与令牌，事务内保存记录；只有采纳才创建任务。
- 同一已确认草稿重试返回同一 receipt；不再支持通用 demo-confirmation-token。
- 已确认时间线与持久化任务回流到同一访客、同一医生的查询工具。
- 人工改写反馈后，不自动沿用旧文本推断的观念变化。
- 演示材料采用小型关键词检索，过滤未审批／过期条目，有明确无命中结果；
  这不是向量 RAG。Skills 为版本化 Python 任务模块，不是 SKILL.md 运行时。
