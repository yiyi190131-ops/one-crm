"use client";
// 工作台屏（阶段 1 迁移）：外壳/顶栏/消息流/输入区用设计系统重建；
// 抽屉与医生选择等浮层沿用既有样式类，后续阶段再收敛。
import type {
  ConversationSummary,
  Customer,
  DeveloperRun,
  HomeTurn,
  PendingTask,
  SuggestedAction,
  TraceStep,
} from "@/lib/types";
import { TopBar } from "@/components/layout/TopBar";
import { Screen } from "@/components/layout/Screen";
import { Composer } from "@/components/chat/Composer";
import { MessageThread } from "@/components/chat/MessageThread";
import { Bubble } from "@/components/chat/Bubble";
import { StatusLine } from "@/components/chat/StatusLine";

function ProcessDisclosure({
  trace,
  skillId,
  skillVersion,
  modelMode,
}: {
  trace: TraceStep[];
  skillId?: string | null;
  skillVersion?: string | null;
  modelMode?: string;
}) {
  const active = trace.some((step) => step.state === "active");
  if (!trace.length && !skillId) return null;
  return (
    <details className="process-disclosure" open={active}>
      <summary>
        <span>{active ? "正在处理" : "查看处理过程"}</span>
        <em>{active ? "处理中" : "⌄"}</em>
      </summary>
      <div className="run-trace">
        {trace.map((step, index) => (
          <span key={`${step.label}-${index}`} className={step.state}>
            <i />
            {step.label}
          </span>
        ))}
      </div>
      {skillId && (
        <small className="skill-badge">
          {skillId}@{skillVersion} · {modelMode}
        </small>
      )}
    </details>
  );
}

function CustomerPicker({
  task,
  customers,
  loading,
  error,
  onChoose,
  onCancel,
  onRetry,
}: {
  task: PendingTask;
  customers: Customer[];
  loading: boolean;
  error: string | null;
  onChoose: (customer: Customer) => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="customer-picker-overlay" role="dialog" aria-modal="true" aria-label="选择服务医生">
      <section className="customer-picker">
        <button className="customer-picker-close" aria-label="关闭医生选择" onClick={onCancel}>
          ×
        </button>
        <p>开始{task.label}前</p>
        <h2>请选择本次服务的医生</h2>
        <span>选择后，Agent 将只读取该医生授权范围内的 CRM 与机构数据。</span>
        <div>
          {customers.length ? (
            customers.map((customer) => (
              <button key={customer.id} className="customer-option" onClick={() => onChoose(customer)}>
                <i>{customer.name.slice(0, 1)}</i>
                <section>
                  <b>{customer.name}</b>
                  <small>
                    {customer.title} · {customer.hospital}
                  </small>
                  <em>{customer.tier}</em>
                </section>
                <strong>›</strong>
              </button>
            ))
          ) : loading ? (
            <p className="customer-loading">正在加载客户列表…</p>
          ) : (
            <div className="customer-load-error">
              <p>{error ?? "暂未获取到可服务的医生。"}</p>
              <button onClick={onRetry}>重新加载列表</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export type WorkspaceProps = {
  turns: HomeTurn[];
  loading: boolean;
  listening: boolean;
  voiceError: string | null;
  notice: string | null;
  input: string;
  onInput: (value: string) => void;
  onAsk: (text?: string) => void;
  onVoice: () => void;
  onStop: () => void;
  onCopy: (text: string) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onLoadConversation: (id: string) => void;
  developerOpen: boolean;
  developerRuns: DeveloperRun[];
  onToggleDeveloper: () => void;
  onConfirmAction: (turnId: string, action: SuggestedAction) => void;
  customers: Customer[];
  customerLoading: boolean;
  customerLoadError: string | null;
  onRetryCustomers: () => void;
  selectedCustomer: Customer | null;
  pendingTask: PendingTask | null;
  homeMode: "auto" | "post";
  onStartTask: (task: PendingTask) => void;
  onChooseCustomer: (customer: Customer) => void;
  onCancelCustomerPicker: () => void;
};

const PROMPTS: Array<[string, string, string, PendingTask["kind"]]> = [
  ["⌁", "访前准备", "请生成本次访前准备", "pre"],
  ["⌕", "客户洞察", "该医生最近有哪些互动记录？", "ask"],
  ["▣", "访后记录", "", "post"],
  ["▤", "材料推荐", "有其他合适的拜访材料吗？", "ask"],
  ["⌂", "机构准入", "该医生所在机构的进药状态和安全运营如何？", "ask"],
];

function TimelineCard({ turn }: { turn: HomeTurn }) {
  const aids = turn.payload?.shown_aids ?? [];
  if (turn.kind === "visit_session") {
    return (
      <article className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] px-[var(--s4)] py-[var(--s3)] text-[13px] leading-[1.55] text-[var(--ink)]">
        <p className="m-0 text-[11px] font-medium tracking-wide text-[var(--brand)]">面对面拜访</p>
        <p className="mt-[var(--s1)] m-0">{turn.text}</p>
        {aids.length > 0 && (
          <ul className="mt-[var(--s2)] m-0 list-disc pl-[18px] text-[12px] text-[var(--sub)]">
            {aids.map((aid) => (
              <li key={aid.id}>{aid.title}</li>
            ))}
          </ul>
        )}
      </article>
    );
  }
  return (
    <article className="rounded-[var(--r-md)] border border-[color:var(--ok)]/30 bg-[var(--ok-weak)] px-[var(--s4)] py-[var(--s3)] text-[13px] leading-[1.55] text-[var(--ok)]">
      <p className="m-0 text-[11px] font-medium tracking-wide">已写入仿真 CRM</p>
      <p className="mt-[var(--s1)] m-0">{turn.text}</p>
      {turn.payload?.visit_id && (
        <small className="mt-[var(--s1)] block text-[11px] opacity-80">
          {turn.payload.visit_id}
          {turn.payload.next_visit ? ` · 下次 ${turn.payload.next_visit}` : ""}
        </small>
      )}
    </article>
  );
}

export function Workspace(props: WorkspaceProps) {
  const {
    turns,
    loading,
    listening,
    voiceError,
    notice,
    input,
    onInput,
    onAsk,
    onVoice,
    onStop,
    onCopy,
    menuOpen,
    onToggleMenu,
    conversations,
    activeConversationId,
    onNewChat,
    onLoadConversation,
    developerOpen,
    developerRuns,
    onToggleDeveloper,
    onConfirmAction,
    customers,
    customerLoading,
    customerLoadError,
    onRetryCustomers,
    selectedCustomer,
    pendingTask,
    homeMode,
    onStartTask,
    onChooseCustomer,
    onCancelCustomerPicker,
  } = props;
  const hasTurns = turns.length > 0;

  const top = (
    <TopBar
      left={
        <button
          aria-label="打开会话菜单"
          onClick={onToggleMenu}
          className="grid h-9 w-9 place-items-center gap-[3px] rounded-[var(--r-sm)] text-[var(--ink)] hover:bg-[var(--surface-2)]"
        >
          <span className="flex flex-col gap-[3px]">
            <i className="block h-[2px] w-4 rounded bg-current" />
            <i className="block h-[2px] w-4 rounded bg-current" />
            <i className="block h-[2px] w-4 rounded bg-current" />
          </span>
        </button>
      }
      title="CRM Agent"
      subtitle={selectedCustomer ? `当前：${selectedCustomer.name}` : undefined}
      right={
        <button
          aria-label="打开开发者视图"
          onClick={onToggleDeveloper}
          className={`grid h-9 min-w-9 place-items-center rounded-[var(--r-sm)] px-2 font-mono text-[13px] ${
            developerOpen ? "bg-[var(--brand-weak)] text-[var(--brand)]" : "text-[var(--sub)] hover:bg-[var(--surface-2)]"
          }`}
        >
          &lt;/&gt;
        </button>
      }
    />
  );

  const composer = (
    <Composer
      value={input}
      listening={listening}
      loading={loading}
      onVoice={onVoice}
      onStop={onStop}
      onChange={(v) => {
        if (listening) onVoice();
        onInput(v);
      }}
      onSubmit={() => onAsk()}
      placeholder={
        listening
          ? "正在听写；也可以直接输入文字"
          : homeMode === "post"
            ? "输入或语音录入本次拜访记录…"
            : hasTurns
              ? "向 CRM Agent 发消息"
              : "说说你需要处理的拜访任务…"
      }
      footnote={
        <>
          {voiceError && <span className="block text-[var(--danger)]">{voiceError}</span>}
          {notice && <span className="block text-[var(--ok)]">{notice}</span>}
          <span className="block">CRM Agent 可能会出错。请务必核查来源。AI 提供建议，人类做决定。</span>
        </>
      }
      banner={
        selectedCustomer ? (
          <div className="mb-[var(--s2)] flex flex-wrap gap-[var(--s2)]">
            <button
              type="button"
              onClick={() => onStartTask({ label: "访前准备", prompt: "请生成本次访前准备", kind: "pre" })}
              className="rounded-[var(--r-pill)] border border-[var(--line)] px-[var(--s3)] py-[4px] text-[12px] text-[var(--ink)] hover:border-[var(--brand)] hover:bg-[var(--brand-weak)]"
            >
              访前准备
            </button>
            <button
              type="button"
              onClick={() => onStartTask({ label: "访后记录", prompt: "", kind: "post" })}
              className="rounded-[var(--r-pill)] border border-[var(--line)] px-[var(--s3)] py-[4px] text-[12px] text-[var(--ink)] hover:border-[var(--brand)] hover:bg-[var(--brand-weak)]"
            >
              访后记录
            </button>
          </div>
        ) : undefined
      }
    />
  );

  return (
    <>
      <Screen top={top} bottom={composer}>
        {!hasTurns ? (
          <div className="flex flex-col gap-[var(--s5)] px-[var(--s5)] py-[var(--s6)]">
            {homeMode === "post" ? (
              <div className="flex flex-col gap-[var(--s2)]">
                <p className="text-[12px] font-medium tracking-wide text-[var(--brand)]">
                  {selectedCustomer?.name ?? "已选医生"} · 访后记录
                </p>
                <h1 className="text-[24px] font-semibold leading-[1.25] text-[var(--ink)]">
                  记录本次，<b className="text-[var(--brand)]">拜访反馈</b>
                </h1>
                <p className="text-[13px] leading-[1.6] text-[var(--sub)]">
                  可直接输入或语音录入。Agent 将先生成草稿，确认后才会写入 CRM。
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-[var(--s2)]">
                  <p className="text-[12px] font-medium tracking-wide text-[var(--brand)]">医药代表 CRM 工作台</p>
                  <h1 className="text-[24px] font-semibold leading-[1.25] text-[var(--ink)]">
                    今天，<b className="text-[var(--brand)]">先完成哪件事？</b>
                  </h1>
                  <p className="text-[13px] leading-[1.6] text-[var(--sub)]">
                    先选择服务医生，再由 Agent 调用对应的 CRM 与资料工具。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-[var(--s3)]">
                  {PROMPTS.map(([icon, label, prompt, kind]) => (
                    <button
                      key={label}
                      onClick={() => onStartTask({ label, prompt, kind })}
                      className="flex items-center gap-[var(--s2)] rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-[var(--s3)] py-[var(--s3)] text-left text-[13px] font-medium text-[var(--ink)] shadow-[var(--shadow-card)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-weak)]"
                    >
                      <i className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--r-sm)] bg-[var(--brand-weak)] text-[15px] not-italic text-[var(--brand)]">
                        {icon}
                      </i>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <MessageThread scrollKey={`${turns.length}:${turns[turns.length - 1]?.text.length ?? 0}:${loading}`}>
            {turns.map((turn) =>
              turn.kind === "visit_session" || turn.kind === "visit_confirmed" ? (
                <TimelineCard key={turn.id} turn={turn} />
              ) : (
              <Bubble key={turn.id} role={turn.role === "user" ? "user" : "assistant"}>
                <p className="m-0 whitespace-pre-wrap">
                  {turn.text || (turn.role === "assistant" ? "正在组织回答…" : "")}
                </p>
                {turn.role === "assistant" && (
                  <div className="mt-[var(--s3)] flex flex-col gap-[var(--s3)]">
                    <ProcessDisclosure
                      trace={turn.trace ?? []}
                      skillId={turn.skill_id}
                      skillVersion={turn.skill_version}
                      modelMode={turn.model_mode}
                    />
                    {turn.sources?.length ? (
                      <div className="source-list">
                        {turn.sources.map((source) => (
                          <details key={`${turn.id}-${source.id}`} className="source-card">
                            <summary>
                              <span>
                                {source.kind === "crm" ? "CRM" : source.kind === "business" ? "机构" : "已审批"}
                              </span>
                              <b>{source.title}</b>
                              <em>⌄</em>
                            </summary>
                            <div>
                              <p>{source.excerpt}</p>
                              <small>
                                {source.location} · {source.version}
                                <br />
                                {source.status}
                              </small>
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-[var(--s3)] text-[12px] text-[var(--muted)]">
                      <button
                        aria-label="复制回复"
                        onClick={() => void onCopy(turn.text)}
                        className="rounded-[var(--r-sm)] border border-[var(--line)] px-[var(--s2)] py-[2px] text-[var(--sub)] hover:bg-[var(--surface-2)]"
                      >
                        复制
                      </button>
                      {turn.citation && (
                        <small>
                          证据：{turn.citation.title} · {turn.citation.version}
                        </small>
                      )}
                    </div>
                    {turn.suggested_action && (
                      <div className={`confirm-action ${turn.confirmed ? "confirmed" : ""}`}>
                        <div>
                          <b>{turn.confirmed ? "已写入仿真 CRM" : turn.suggested_action.title}</b>
                          <p>{turn.suggested_action.description}</p>
                        </div>
                        {!turn.confirmed && (
                          <button onClick={() => onConfirmAction(turn.id, turn.suggested_action!)}>确认写入</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Bubble>
              ),
            )}
            {loading && <StatusLine tone="run" text="正在执行工具并生成回答" />}
          </MessageThread>
        )}
      </Screen>

      {menuOpen && (
        <aside className="history-menu">
          <button onClick={onNewChat}>＋ 选择医生</button>
          <p>按医生查看</p>
          {conversations.length ? (
            conversations.map((conversation) => (
              <button
                className={`conversation-item ${conversation.id === activeConversationId ? "active" : ""}`}
                key={conversation.id}
                onClick={() => onLoadConversation(conversation.id)}
              >
                {conversation.customer_name ?? conversation.title}
              </button>
            ))
          ) : (
            <span>尚无医生服务记录</span>
          )}
        </aside>
      )}

      {developerOpen && (
        <aside className="developer-panel">
          <div>
            <b>Agent 运行记录</b>
            <button onClick={onToggleDeveloper}>关闭</button>
          </div>
          <p>会话、路由和执行轨迹均来自后端持久化记录。</p>
          {developerRuns.length ? (
            developerRuns.map((run) => (
              <article key={run.id}>
                <header>
                  <b>{run.route}</b>
                  <span>{run.model_mode}</span>
                </header>
                <small>
                  {run.skill_id ?? "guardrail"} {run.skill_version ?? ""}
                </small>
                {run.trace.map((step, index) => (
                  <p key={`${run.id}-${index}`}>
                    <i className={step.state} />
                    {step.label}：{step.detail}
                  </p>
                ))}
              </article>
            ))
          ) : (
            <div className="developer-empty">发送一条业务问题后，这里会显示真实的运行轨迹。</div>
          )}
          <section>
            <b>SDD 发布门禁</b>
            <p>多 Skill 路由 · 已审批证据 · 人工确认写入 · Golden Set 回归</p>
          </section>
        </aside>
      )}

      {pendingTask && (
        <CustomerPicker
          task={pendingTask}
          customers={customers}
          loading={customerLoading}
          error={customerLoadError}
          onChoose={onChooseCustomer}
          onCancel={onCancelCustomerPicker}
          onRetry={onRetryCustomers}
        />
      )}
    </>
  );
}
