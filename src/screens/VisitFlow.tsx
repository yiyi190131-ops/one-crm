"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AgentResponse, Customer, DetailAid, HomeTurn, LadderUpdate, VisitSession } from "@/lib/types";

const A = "/figma/proto/";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
import { demoUserId } from "@/lib/session";
type DraftEdits = { feedback: string; next_visit: string; follow_up: string };
const FACES = ["😞", "😐", "😄"] as const;
const LADDER = ["中立", "认可", "认可且推荐"] as const;

type Screen = "pick" | "chat" | "aid";
type ThreadTurn = HomeTurn & { result?: AgentResponse | null };
type PostStage = "idle" | "parsing1" | "ladder" | "follow" | "parsing2" | "todo" | "confirm" | "done";
type SpeechRecognitionEvent = { results: { length: number; [index: number]: { [index: number]: { transcript: string } } } };
type SpeechRecognizer = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type SpeechRecognizerConstructor = new () => SpeechRecognizer;

function after(stage: PostStage, target: PostStage) {
  const order: PostStage[] = ["idle", "parsing1", "ladder", "follow", "parsing2", "todo", "confirm", "done"];
  return order.indexOf(stage) >= order.indexOf(target);
}

const TYPE_MS = 8;
const TYPE_PAUSE_MS = 30;

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function typeOut(from: string, to: string, onToken: (text: string) => void) {
  if (from === to) return;
  if (from.startsWith(to)) {
    onToken(to);
    return;
  }
  let shown = to.startsWith(from) ? from : "";
  if (!shown) onToken("");
  for (const ch of to.slice(shown.length)) {
    shown += ch;
    onToken(shown);
    await sleep(/[，。！？；：、\n]/.test(ch) ? TYPE_PAUSE_MS : TYPE_MS);
  }
}

const CHIP_POOL = [
  "上次拜访聊了什么，有哪些待办？",
  "该医生最近有哪些互动记录？",
  "有其他合适的拜访材料吗？",
  "该医生所在机构的进药状态/安全运营如何？",
  "帮我准备今天的访前重点",
  "医生当前观念阶梯到哪一层了？",
  "上次拜访还缺什么待办？",
];

function unusedChips(turns: ThreadTurn[]) {
  const asked = new Set(turns.filter((turn) => turn.role === "user" && turn.kind === "message").map((turn) => turn.text.trim()));
  return CHIP_POOL.filter((text) => !asked.has(text)).slice(0, 3);
}

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function hydrateTurns(raw: Array<Partial<HomeTurn> & { text: string; role: HomeTurn["role"] }>): ThreadTurn[] {
  return raw.map((turn, index) => {
    const payload = turn.payload ?? {};
    const result: AgentResponse | null = turn.role === "assistant"
      ? {
          reply: turn.text,
          route: turn.route,
          sources: turn.sources,
          suggested_action: turn.suggested_action,
          extracted: payload.extracted,
          privacy: payload.privacy,
          off_label: payload.off_label,
          todo_suggestion: payload.todo_suggestion,
          todo_decision: payload.todo_decision,
          citation: payload.citation ?? null,
          trace: turn.trace,
          skill_id: turn.skill_id,
          skill_version: turn.skill_version,
          model_mode: turn.model_mode,
        }
      : null;
    return {
      id: turn.id ?? `t-${index}`,
      role: turn.role,
      kind: turn.kind ?? "message",
      text: turn.text,
      payload,
      route: turn.route,
      sources: turn.sources,
      suggested_action: turn.suggested_action,
      result,
    };
  });
}

function openVisitIndex(turns: ThreadTurn[]) {
  let session = -1;
  let confirmed = -1;
  turns.forEach((turn, index) => {
    if (turn.kind === "visit_session") session = index;
    if (turn.kind === "visit_confirmed") confirmed = index;
  });
  return session > confirmed ? session : -1;
}

function restoreVisit(turns: ThreadTurn[]) {
  const start = openVisitIndex(turns);
  const sessionTurn = start >= 0 ? turns[start] : undefined;
  const session: VisitSession = {
    seconds: sessionTurn?.payload?.seconds ?? 0,
    shownAids: sessionTurn?.payload?.shown_aids ?? [],
  };
  if (start < 0) {
    return { showPost: false, postStage: "idle" as PostStage, postTurns: [] as string[], postReplies: [] as string[], postResult: null as AgentResponse | null, session };
  }
  const after = turns.slice(start + 1).filter((turn) => turn.kind === "message");
  const users = after.filter((turn) => turn.role === "user").map((turn) => turn.text);
  const bots = after.filter((turn) => turn.role === "assistant");
  let postStage: PostStage = "idle";
  if (users.length === 1) postStage = bots.length ? "ladder" : "parsing1";
  else if (users.length >= 2) postStage = bots.length >= 2 ? "todo" : "parsing2";
  return { showPost: true, postStage, postTurns: users, postReplies: bots.map((turn) => turn.text), postResult: bots.at(-1)?.result ?? null, session };
}

export function VisitFlow() {
  const [screen, setScreen] = useState<Screen>("pick");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [turns, setTurns] = useState<ThreadTurn[]>([]);
  const [postStage, setPostStage] = useState<PostStage>("idle");
  const [postTurns, setPostTurns] = useState<string[]>([]);
  const [postReplies, setPostReplies] = useState<string[]>([]);
  const [postResult, setPostResult] = useState<AgentResponse | null>(null);
  const [todo, setTodo] = useState<"adopt" | "ignore" | null>(null);
  const [shared, setShared] = useState(false);
  const [aidNote, setAidNote] = useState<string | null>(null);
  const [activeAid, setActiveAid] = useState<DetailAid | null>(null);
  const [detailAids, setDetailAids] = useState<DetailAid[]>([]);
  const [visitSession, setVisitSession] = useState<VisitSession>({ seconds: 0, shownAids: [] });
  const [activeSeconds, setActiveSeconds] = useState(0);
  const conversationRef = useRef<string | null>(null);
  const speechRef = useRef<SpeechRecognizer | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadAids(customerId: string) {
    try {
      const res = await fetch(`${API_BASE}/detail-aids?customer_id=${customerId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { aids: DetailAid[] };
      setDetailAids(data.aids ?? []);
    } catch { /* 手卡空态 */ }
  }

  async function bindCustomer(next: Customer) {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: demoUserId(), customer_id: next.id }),
    });
    if (!res.ok) throw new Error("bind");
    const conversation = (await res.json()) as { id: string };
    conversationRef.current = conversation.id;
    window.localStorage.setItem("crm-agent-conversation", conversation.id);
    setCustomer(next);
    await loadAids(next.id);
  }

  async function loadThread(conversationId: string) {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}?user_id=${demoUserId()}`);
    if (!res.ok) throw new Error("thread");
    const conv = (await res.json()) as { turns?: Array<Partial<HomeTurn> & { text: string; role: HomeTurn["role"] }> };
    const loaded = hydrateTurns(conv.turns ?? []);
    const restored = restoreVisit(loaded);
    setTurns(loaded);
    setPostStage(restored.postStage);
    setPostTurns(restored.postTurns);
    setPostReplies(restored.postReplies);
    setPostResult(restored.postResult);
    setTodo(restored.postResult?.todo_decision ?? null);
    setVisitSession(restored.session);
    setScreen("chat");
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" });
  }, [screen, postStage, todo, shared, turns, loading]);

  useEffect(() => {
    if (screen !== "aid") return;
    const timer = window.setInterval(() => setActiveSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/customers?user_id=${demoUserId()}`);
        if (!res.ok) throw new Error("customers");
        const list = (await res.json()) as Customer[];
        setCustomers(list);
        const savedId = window.localStorage.getItem("crm-agent-conversation");
        if (!savedId) return;
        const convRes = await fetch(`${API_BASE}/conversations/${savedId}?user_id=${demoUserId()}`);
        if (!convRes.ok) return;
        const conv = (await convRes.json()) as { id: string; customer_id?: string | null };
        const matched = list.find((item) => item.id === conv.customer_id);
        if (!matched) return;
        conversationRef.current = conv.id;
        setCustomer(matched);
        await loadAids(matched.id);
        await loadThread(conv.id);
      } catch {
        setPickError("医生列表暂不可用，请确认后端服务后重试。");
      }
    })();
  }, []);

  async function chooseDoctor(next: Customer) {
    setPickError(null);
    try {
      await bindCustomer(next);
      const conversationId = conversationRef.current;
      if (!conversationId) throw new Error("bind");
      await loadThread(conversationId);
      setShared(false);
      setAidNote(null);
      setInput("");
      setActiveSeconds(0);
    } catch {
      setPickError("无法打开该医生的服务记录，请确认后端已启动。");
    }
  }

  function goChat() {
    setScreen("chat");
    setAidNote(null);
    setInput("");
    setNotice(null);
  }

  function goPick() {
    setScreen("pick");
    setInput("");
    setNotice(null);
    setListening(false);
  }

  async function askAgent(message: string, mode: "auto" | "pre" | "post", onToken: (text: string) => void) {
    const res = await fetch(`${API_BASE}/agent/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        message,
        mode,
        customer_id: customer?.id,
        user_id: demoUserId(),
        conversation_id: conversationRef.current,
      }),
    });
    if (!res.ok || !res.body) throw new Error("stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let displayed = "";
    let final: AgentResponse | null = null;
    const reveal = async (target: string) => {
      await typeOut(displayed, target, (text) => {
        displayed = text;
        onToken(text);
      });
    };
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const packets = buffer.split("\n\n");
      buffer = packets.pop() ?? "";
      for (const packet of packets) {
        const event = packet.match(/^event:\s*(.+)$/m)?.[1];
        const raw = packet.match(/^data:\s*(.+)$/m)?.[1];
        if (!event || !raw) continue;
        const data = JSON.parse(raw) as AgentResponse & { text?: string };
        if (event === "token") {
          accumulated += data.text ?? "";
          await reveal(accumulated);
        }
        if (event === "final") final = data;
      }
    }
    const reply = (final?.reply || accumulated).trim();
    if (reply) await reveal(reply);
    if (final) return { ...final, reply: final.reply || accumulated };
    if (accumulated) return { reply: accumulated } as AgentResponse;
    throw new Error("empty-stream");
  }

  async function pushExchange(q: string, mode: "auto" | "post", onPartial?: (text: string) => void) {
    const userId = nextId("u");
    const botId = nextId("a");
    setLoading(true);
    setTurns((items) => [
      ...items,
      { id: userId, role: "user", kind: "message", text: q },
      { id: botId, role: "assistant", kind: "message", text: "", result: { reply: "" } as AgentResponse },
    ]);
    try {
      const data = await askAgent(q, mode, (partial) => {
        onPartial?.(partial);
        setTurns((items) => items.map((item) => (
          item.id === botId ? { ...item, text: partial, result: { ...(item.result ?? { reply: "" }), reply: partial } as AgentResponse } : item
        )));
      });
      if (data.conversation_id) {
        conversationRef.current = data.conversation_id;
        window.localStorage.setItem("crm-agent-conversation", data.conversation_id);
      }
      setTurns((items) => items.map((item) => (
        item.id === botId ? { ...item, text: data.reply, route: data.route, result: data, suggested_action: data.suggested_action } : item
      )));
      return data;
    } catch {
      const fallback = "暂时无法连接服务，请确认本地服务已启动。";
      setTurns((items) => items.map((item) => (
        item.id === botId ? { ...item, text: fallback, result: { reply: fallback, trace: [] } as AgentResponse } : item
      )));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function sendPre(text = input) {
    const q = text.trim();
    if (!q || loading || !customer) return;
    setInput("");
    setNotice(null);
    setScreen("chat");
    await pushExchange(q, "auto");
  }

  async function sendPost(text = input) {
    const q = text.trim();
    if (loading || !q) return;
    setInput("");
    setListening(false);
    setNotice(null);
    const first = postTurns.length === 0;
    const replyIndex = first ? 0 : 1;
    setPostTurns((items) => [...items, q]);
    setPostStage(first ? "parsing1" : "parsing2");
    const data = await pushExchange(q, "post", (partial) => {
      setPostResult((prev) => ({ ...(prev ?? { reply: "" }), reply: partial } as AgentResponse));
      setPostReplies((items) => {
        const next = items.slice();
        next[replyIndex] = partial;
        return next;
      });
    });
    if (!data) {
      setNotice("暂时无法解析拜访记录，请确认后端服务后重试。");
      setPostStage(first ? "idle" : "follow");
      return;
    }
    setPostResult(data);
    setTodo(null);
    setPostReplies((items) => {
      const next = items.slice();
      next[first ? 0 : 1] = data.reply;
      return next;
    });
    setPostStage(data.todo_suggestion ? "todo" : first ? "ladder" : "todo");
  }

  function voice() {
    if (listening) {
      speechRef.current?.stop();
      speechRef.current = null;
      setListening(false);
      return;
    }
    const w = window as typeof window & { SpeechRecognition?: SpeechRecognizerConstructor; webkitSpeechRecognition?: SpeechRecognizerConstructor };
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("当前浏览器不支持语音识别，请使用 Chrome 或直接输入文字。");
      return;
    }
    setNotice(null);
    setListening(true);
    const recognition = new Recognition();
    speechRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const spoken = event.results[event.results.length - 1][0].transcript.trim();
      setInput(spoken);
    };
    recognition.onerror = () => setNotice("未能识别语音，请检查麦克风权限后重试。");
    recognition.onend = () => { speechRef.current = null; setListening(false); };
    try { recognition.start(); } catch { setListening(false); setNotice("无法启动麦克风。"); }
  }

  async function finishAid() {
    const shown = activeAid ? [activeAid] : [];
    const session = { seconds: activeSeconds, shownAids: shown };
    setVisitSession(session);
    const conversationId = conversationRef.current;
    if (conversationId) {
      try {
        await fetch(`${API_BASE}/conversations/${conversationId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "visit_session", user_id: demoUserId(), seconds: activeSeconds, shown_aids: shown }),
        });
      } catch { /* 不阻断访后 */ }
    }
    setTurns((items) => [...items, {
      id: nextId("s"),
      role: "system",
      kind: "visit_session",
      text: `面对面拜访 ${session.seconds} 秒，已展示 ${shown[0]?.title ?? "电子手卡"}。`,
      payload: { seconds: session.seconds, shown_aids: shown },
    }]);
    setPostStage("idle");
    setPostTurns([]);
    setPostReplies([]);
    setPostResult(null);
    setTodo(null);
    setScreen("chat");
    setInput("");
    setNotice(null);
  }

  async function decideTodo(decision: "adopt" | "ignore") {
    const suggestion = postResult?.todo_suggestion;
    const action = postResult?.suggested_action;
    if (!suggestion || !action?.draft_id || !action.confirmation_token) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, date: suggestion.date, material: suggestion.material,
          draft_id: action.draft_id, confirmation_token: action.confirmation_token, user_id: demoUserId() }),
      });
      if (!res.ok) throw new Error("decision");
      setTodo(decision);
      setNotice(null);
    } catch { setNotice("选择未保存，请重试；尚未创建任务。"); }
  }

  async function confirmVisit(edits?: DraftEdits) {
    if (loading) return;
    const action = postResult?.suggested_action;
    if (!action?.confirmation_token || !action.draft_id) {
      setNotice("草稿尚未生成或已失效，请先解析拜访记录后再提交。");
      setPostStage("todo");
      return;
    }
    const extracted = postResult?.extracted;
    setLoading(true);
    const ladder = (extracted?.ladder_updates ?? []).map((u) => ({ dimension: u.dimension, from: u.from, to: u.to }));
    try {
      const res = await fetch(`${API_BASE}/visits/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation_token: action.confirmation_token,
          action: "create-follow-up",
          user_id: demoUserId(),
          todo_decision: todo ?? "ignore",
          draft_id: action.draft_id,
          conversation_id: conversationRef.current,
          feedback: edits?.feedback ?? extracted?.feedback ?? "",
          next_visit: edits?.next_visit ?? extracted?.next_visit ?? "",
          follow_up: edits?.follow_up ?? extracted?.follow_up ?? "",
          ladder,
          customer_name: customer?.name,
        }),
      });
      if (!res.ok) throw new Error("confirm");
      const receipt = await res.json();
      setTurns((items) => [...items, {
        id: nextId("c"),
        role: "system",
        kind: "visit_confirmed",
        text: receipt.message,
        payload: { ...receipt, next_visit: edits?.next_visit ?? extracted?.next_visit },
      }]);
      setPostStage("done");
      const refreshed = await fetch(`${API_BASE}/customers?user_id=${demoUserId()}`).catch(() => null);
      if (refreshed?.ok) {
        const list = await refreshed.json() as Customer[];
        setCustomers(list);
        const latest = list.find((item) => item.id === customer?.id);
        if (latest) setCustomer(latest);
      }
      setNotice(null);
    } catch {
      setNotice("提交失败，CRM 未写入，请稍后重试。");
      setPostStage("todo");
    } finally { setLoading(false); }
  }

  const showPost = openVisitIndex(turns) >= 0;
  const lastTurn = turns.at(-1);
  const concierge = showPost;
  const showSubmit = showPost && postStage !== "done";
  const scrollClass = screen === "aid" ? "proto-scroll aid" : "proto-scroll";
  const suggestions = unusedChips(turns);

  return (
    <div className="proto-page">
      <section className="proto-phone">
        {screen !== "aid" && (
          <header className="proto-top">
            <StatusBar />
            {concierge ? <img className="logo" src={`${A}concierge.svg`} alt="Concierge" /> : <h1>OneCRM</h1>}
            <button className="close" aria-label="关闭" onClick={goPick}>
              <img src={`${A}close.svg`} alt="" />
            </button>
          </header>
        )}

        <div className={scrollClass} ref={scrollRef}>
          <aside className="demo-intro">
            <strong>一次拜访，从准备到跟进</strong>
            <p>选一位医生，自由提问或使用示例。客户与医学材料均为演示数据；你确认的记录会真实保存在当前体验中。</p>
          </aside>
          {screen === "pick" && <DoctorPick customers={customers} error={pickError} onChoose={chooseDoctor} />}
          {screen === "chat" && customer && (
            <>
              <PreBrief customer={customer} aids={detailAids} onAsk={sendPre} onStart={() => { setActiveAid(detailAids[0] ?? null); setActiveSeconds(0); setScreen("aid"); }} showChips={false} />
              { (showPost && openVisitIndex(turns) >= 0 ? turns.slice(0, openVisitIndex(turns) + 1) : turns).map((turn) => (
                <TurnBlock
                  key={turn.id}
                  turn={turn}
                  customer={customer}
                  streaming={loading && turn.id === lastTurn?.id && turn.role === "assistant" && !showPost}
                  shared={shared}
                  onShare={() => setShared(true)}
                  onOpenMaterial={(aid) => { setActiveAid(aid); setActiveSeconds(0); setScreen("aid"); }}
                />
              ))}
              {showPost && !loading && postStage === "idle" && (
                <div className="proto-chips"><button className="proto-btn" onClick={() => void sendPost("医生对长期安全仍有顾虑，希望补充青少年研究资料，下周四下午再次沟通。")}>试填一段模拟拜访反馈</button></div>
              )}
              {showPost && (
                <Post
                  customer={customer}
                  session={visitSession}
                  stage={postStage}
                  turns={postTurns}
                  narratives={postReplies}
                  result={postResult}
                  todo={todo}
                  streaming={loading}
                  onConfirmLadder={() => setPostStage("follow")}
                  onTodo={(v) => void decideTodo(v)}
                  onConfirm={(edits) => void confirmVisit(edits)}
                  onCancel={() => setPostStage("todo")}
                />
              )}
              {!showPost && !loading && suggestions.length > 0 && (
                <div className="proto-chips">
                  {suggestions.map((text) => <Chip key={text} text={text} onAsk={sendPre} />)}
                </div>
              )}
            </>
          )}
          {screen === "aid" && (
            <Aid
              aid={activeAid}
              note={aidNote}
              onBack={goChat}
              onShare={() => setAidNote("演示环境未连接企业微信分享，请在当前页面查看材料。")}
              onRemote={() => setAidNote("演示环境未连接远程会议服务。")}
              onSubmit={() => void finishAid()}
            />
          )}
          {notice && <p className="proto-error">{notice}</p>}
        </div>

        {screen === "chat" && (
          <Composer
            value={input}
            listening={listening}
            showSubmit={showSubmit}
            pre={!showPost}
            onChange={setInput}
            onVoice={voice}
            onSend={() => (showPost ? void sendPost() : void sendPre())}
            onSubmitVisit={() => setPostStage("confirm")}
          />
        )}
      </section>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="proto-status">
      <time>9:41</time>
      <div className="icons">
        <img src={`${A}cellular.svg`} width={17} height={11} alt="" />
        <img src={`${A}wifi.svg`} width={15} height={11} alt="" />
        <span className="battery" aria-hidden><i /></span>
      </div>
    </div>
  );
}

function DoctorPick({ customers, error, onChoose }: { customers: Customer[]; error: string | null; onChoose: (c: Customer) => void }) {
  return (
    <>
      <p className="proto-copy">👋 欢迎使用访前助手！</p>
      <p className="proto-copy">请选择本次服务的医生。选择后，Agent 只读取该医生授权范围内的 CRM 与机构数据。</p>
      <div className="proto-pick">
        {customers.map((item) => (
          <button key={item.id} className="proto-pick-item" onClick={() => onChoose(item)}>
            <i>{item.name.slice(0, 1)}</i>
            <section>
              <b>{item.name}</b>
              <small>{item.title} · {item.hospital}</small>
              <em>{item.tier}</em>
            </section>
            <strong>›</strong>
          </button>
        ))}
      </div>
      {error && <p className="proto-error">{error}</p>}
    </>
  );
}

function PreBrief({ customer, aids, onAsk, onStart, showChips = true }: { customer: Customer; aids: DetailAid[]; onAsk: (q: string) => void; onStart: () => void; showChips?: boolean }) {
  const product = customer.product;
  const material = aids[0];
  const evidence = "点击下方示例或直接提问，获取与医生关注点匹配的演示材料";
  return (
    <>
      <p className="proto-copy">👋 正在为{customer.name}准备访前助手！</p>
      <ul className="proto-list proto-copy">
        <li>当前内容围绕<b>{product}</b>展开。如需查看其他相关内容可以告诉我。</li>
      </ul>
      <hr className="proto-rule" />
      <p className="proto-copy">📌 上次拜访（{customer.last_visit}）</p>
      <ul className="proto-list proto-copy">
        <li>使用材料：{customer.last_material ?? "—"}</li>
        <li>拜访反馈：{customer.last_feedback}</li>
        <li>当前观念阶梯<b>：{customer.tier}</b></li>
      </ul>
      <p className="proto-copy" style={{ marginTop: 12 }}>🎯 <b>本次拜访重点：</b></p>
      <ul className="proto-list proto-copy">
        <li>优先回应医生上次提出的需求，并查阅相关已审批资料<a>：「{evidence}」</a></li>
        <li>{customer.meeting ? <>可询问医生是否有意向参加<b>{customer.meeting}</b>。</> : <>推进待办：<b>{customer.open_task}</b>。</>}</li>
      </ul>
      <hr className="proto-rule" />
      <p className="proto-copy">💡 该医生学术需求较高，近期拜访效果较好，建议交流疾病信息。</p>
      <div className="proto-quote">
        <i />
        <span>“主任，最近有份关于中度AD合并2型炎症共病的学术资料，跟您快速介绍下里面的临床数据和治疗思路。”</span>
      </div>
      <article className="proto-card">
        <div className="proto-material">
          <img src={`${A}ad-cover.png`} alt="" />
          <p>{material?.subtitle ?? material?.title ?? "中度AD 2型炎症共病"}</p>
        </div>
        <div className="proto-tags">
          {(material?.tags ?? ["标签1", "标签2"]).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <button className="proto-btn" onClick={onStart}>开启面对面拜访</button>
      </article>
      {showChips && (
      <div className="proto-chips">
        <Chip text="该医生最近有哪些互动记录？" onAsk={onAsk} />
        <Chip text="有其他合适的拜访材料吗？" onAsk={onAsk} />
        <Chip text="该医生所在机构的进药状态/安全运营如何？" onAsk={onAsk} />
      </div>
      )}
    </>
  );
}

function Chip({ text, onAsk }: { text: string; onAsk: (q: string) => void }) {
  return (
    <button className="proto-chip" onClick={() => onAsk(text)}>
      {text}
      <img src={`${A}arrow.svg`} alt="" />
    </button>
  );
}

function StatusLine({ text }: { text: string }) {
  return (
    <div className="proto-status-line">
      <img src={`${A}parsed.svg`} alt="" />
      {text}
    </div>
  );
}

function TypedReply({ text, streaming }: { text?: string; streaming: boolean }) {
  if (!text && !streaming) return null;
  return (
    <p className="proto-copy proto-type">
      {text}
      {streaming && <i className="proto-caret" aria-hidden />}
    </p>
  );
}

function TurnBlock({ turn, customer, streaming, shared, onShare, onOpenMaterial }: {
  turn: ThreadTurn;
  customer: Customer;
  streaming: boolean;
  shared: boolean;
  onShare: () => void;
  onOpenMaterial: (aid: DetailAid) => void;
}) {
  if (turn.kind === "visit_session") {
    const aids = turn.payload?.shown_aids ?? [];
    return (
      <article className="proto-system">
        <p className="proto-copy"><b>面对面拜访</b></p>
        <p className="proto-copy">{turn.text}</p>
        {aids.map((aid) => <p className="proto-note" key={aid.id}>{aid.title}</p>)}
      </article>
    );
  }
  if (turn.kind === "visit_confirmed") {
    return (
      <article className="proto-system">
        <p className="proto-copy">{turn.text}</p>
        <p className="proto-copy">记录已生效。你可以继续询问“上次拜访聊了什么”或“有哪些待办”，查看保存结果。</p>
      </article>
    );
  }
  if (turn.role === "user") {
    return <div className="proto-turn is-user"><div className="proto-user">{turn.text}</div></div>;
  }
  const result = turn.result ?? ({ reply: turn.text, route: turn.route } as AgentResponse);
  const route = turn.route ?? result.route;
  return (
    <div className="proto-turn proto-bot">
      <StatusLine text={streaming ? "正在根据已取回数据组织回答…" : "解析已完成"} />
      <TypedReply text={result.reply || turn.text} streaming={streaming} />
      {!streaming && result.trace && <details className="demo-intro"><summary>查看执行过程与依据</summary>
        <p>{result.model_mode === "local" ? "本次使用本地规则模式" : `本次模型模式：${result.model_mode}`}</p>
        {result.trace.map((step, i) => <p key={i}>{step.label}：{step.detail}</p>)}
      </details>}
      {!streaming && route === "customer_insight" && <InsightEvidence customer={customer} />}
      {!streaming && (route === "material_recommendation" || route === "pre_visit") && <MaterialEvidence result={result} shared={shared} onShare={onShare} onOpen={onOpenMaterial} />}
      {!streaming && route === "institution_access" && <HospitalEvidence customer={customer} />}
      {!streaming && (route === "capability_guide" || route === "guardrail") && <GuideEvidence />}
    </div>
  );
}

function InsightEvidence({ customer }: { customer: Customer }) {
  const stats = customer.interaction_stats ?? {};
  const events = customer.interactions ?? [];
  return (
    <>
      <p className="proto-copy">👤 当前观念阶梯：<b>{customer.tier}</b></p>
      <p className="proto-copy" style={{ marginTop: 12 }}>📈 近1个月互动概览</p>
      <div className="proto-table">
        <div className="head"><span>互动类型</span><span>互动次数</span></div>
        {Object.entries(stats).map(([type, count]) => (
          <div key={type}><span>{type}</span><span>{count}</span></div>
        ))}
      </div>
      <p className="proto-copy" style={{ marginTop: 16 }}>📋 详细互动记录</p>
      <div className="proto-timeline">
        {events.map((event) => (
          <div className="proto-event" key={`${event.date}-${event.type}`}>
            <b>{event.date} | {event.type}</b>
            <div className="box"><p>{event.detail}</p></div>
          </div>
        ))}
      </div>
    </>
  );
}

function MaterialEvidence({ result, onOpen }: { result: AgentResponse; shared: boolean; onShare: () => void; onOpen: (aid: DetailAid) => void }) {
  const docs = (result.sources ?? []).filter((source) => source.kind === "approved-evidence" || source.kind === "approved-material");
  if (!docs.length) return <p className="proto-note">未检索到相关有效材料，可换一个主题继续询问。</p>;
  return <>{docs.map((doc) => <article className="proto-card article" key={doc.id}>
    <div className="proto-material"><p>{doc.title}</p></div>
    <p className="proto-note">{doc.version} · {doc.status}</p>
    <details><summary>查看资料内容与来源</summary><p className="proto-copy">{doc.excerpt}</p><p className="proto-note">{doc.location}</p></details>
    <button className="proto-btn" onClick={() => onOpen({id:doc.id,title:doc.title,subtitle:doc.version,points:[doc.excerpt],tags:["演示资料"],status:doc.status})}>打开此材料进行演示</button>
  </article>)}</>;
}

function HospitalEvidence({ customer }: { customer: Customer }) {
  const institution = customer.institution;
  if (!institution) return null;
  return (
    <>
      <p className="proto-copy">🏥 {customer.hospital} · {customer.product}进院状态</p>
      <ul className="proto-list proto-copy">
        <li>当前进药状态：<b>{institution.formulary}</b></li>
        <li>覆盖趋势：{institution.coverage_trend}；供应风险：{institution.supply_risk}。</li>
      </ul>
    </>
  );
}

function GuideEvidence() {
  return (
    <>
      <p className="proto-copy">目前，我可以帮您：</p>
      <p className="proto-copy">🔍 医生信息查询</p>
      <p className="proto-copy">📝 拜访历史回顾</p>
      <p className="proto-copy">🎯 智能拜访建议</p>
      <p className="proto-copy">🏥 进院状态查询</p>
    </>
  );
}

function Aid({ aid, note, onBack, onShare, onRemote, onSubmit }: { aid: DetailAid | null; note: string | null; onBack: () => void; onShare: () => void; onRemote: () => void; onSubmit: () => void }) {
  return (
    <>
      <div className="proto-aid-head">
        <button aria-label="返回" onClick={onBack}><img src={`${A}aid-back.svg`} alt="" /></button>
        <div className="pill"><img src={`${A}aid-icon.png`} alt="" />拜访材料</div>
        <button className="plus" aria-label="更多"><img src={`${A}aid-plus.svg`} alt="" /></button>
      </div>
      <div className="proto-aid-body">
        <h2>{aid?.title ?? "未选择材料"}</h2>
        <p className="proto-note">演示材料，非真实医学依据。{aid?.subtitle}</p>
        {(aid?.points ?? []).map((point, index) => <p className="proto-copy" key={index}>{point}</p>)}
        {note && <p className="proto-note">{note}</p>}
      </div>
      <nav className="proto-aid-bar">
        <button onClick={onShare}><img src={`${A}share.svg`} alt="" />分享</button>
        <button onClick={onRemote}><img src={`${A}remote.svg`} alt="" />远程拜访</button>
        <button onClick={onSubmit}><img src={`${A}check.svg`} alt="" />提交</button>
      </nav>
    </>
  );
}

function FaceRow({ active }: { active: string }) {
  return (
    <div className="proto-faces">
      {LADDER.map((label, i) => (
        <span key={label} className={`proto-face${active === label ? " on" : ""}`}>
          <b>{FACES[i]}</b>
          {label}
        </span>
      ))}
    </div>
  );
}

function highlightPII(text: string, spans: string[], extra?: string | null): ReactNode {
  const marks = [...spans, extra].filter((item): item is string => Boolean(item)).sort((a, b) => b.length - a.length);
  if (!marks.length) return text;
  let parts: ReactNode[] = [text];
  marks.forEach((span, si) => {
    const next: ReactNode[] = [];
    parts.forEach((part) => {
      if (typeof part !== "string" || !part.includes(span)) { next.push(part); return; }
      const segs = part.split(span);
      segs.forEach((seg, idx) => {
        if (seg) next.push(seg);
        if (idx < segs.length - 1) next.push(<mark key={`m-${si}-${idx}`}>{span}</mark>);
      });
    });
    parts = next;
  });
  return parts;
}

function Post({
  customer, session, stage, turns, narratives, result, todo, streaming, onConfirmLadder, onTodo, onConfirm, onCancel,
}: {
  customer: Customer;
  session: VisitSession;
  stage: PostStage;
  turns: string[];
  narratives: string[];
  result: AgentResponse | null;
  todo: "adopt" | "ignore" | null;
  streaming: boolean;
  onConfirmLadder: () => void;
  onTodo: (v: "adopt" | "ignore") => void;
  onConfirm: (edits?: DraftEdits) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const material = session.shownAids[0]?.title ?? "未记录展示材料";
  const updates: LadderUpdate[] = result?.extracted?.ladder_updates ?? [];
  const user1 = turns[0];
  const user2 = turns.slice(1).join("\n");
  const privacy = result?.privacy;
  const offLabel = result?.off_label;
  const suggestion = result?.todo_suggestion;
  const article = result?.extracted?.recommend_article;
  return (
    <>
      <p className="proto-copy">
        拜访记录已为您准备就绪：
        <br />日期：{today}
        <br />客户：{customer.name}
        <br />产品：{customer.product}
        <br />材料1：{material}
        <br />展示时长：{session.seconds}秒
      </p>
      <p className="proto-copy">
        我想了解一下，这次您和{customer.name}讨论{customer.product}时，他对于产品有什么反馈，<b>观念阶梯是否有变化</b>？（比如长期安全、维稳等）
      </p>
      {user1 && <div className="proto-user" style={{ marginTop: 16, maxWidth: 335, marginLeft: 0, marginRight: "auto" }}>{user1}</div>}
      {(stage === "parsing1" || after(stage, "ladder")) && (
        <StatusLine text={stage === "parsing1" ? "正在根据拜访记录组织说明…" : "解析已完成"} />
      )}
      {(stage === "parsing1" || after(stage, "ladder")) && (
        <TypedReply text={narratives[0] || result?.reply} streaming={streaming && stage === "parsing1"} />
      )}
      {after(stage, "ladder") && result?.extracted && (
        <article className="proto-km">
          <p>收到！感谢您的反馈 👍 根据您的记录，我将整理并更新本次拜访所收集到的关键信息对于医生洞察进行更新：</p>
          {updates.map((update, i) => (
            <div key={update.dimension}>
              <p className="proto-km-row">
                <img src={`${A}km-icon.svg`} alt="" width={16} height={16} style={{ verticalAlign: "middle", marginRight: 4 }} />
                <span>关键信息{i + 1}：</span>{update.dimension}
              </p>
              <FaceRow active={update.to} />
            </div>
          ))}
          {!updates.length && <p className="proto-note">未识别到明确的观念变化，将保留原状态。可在下方继续补充。</p>}
          {stage === "ladder" ? <button className="proto-btn" onClick={onConfirmLadder}>继续补充跟进安排</button> : <p className="proto-note">已加入待确认草稿，尚未写入</p>}
        </article>
      )}
      {after(stage, "follow") && (
        <p className="proto-copy" style={{ marginTop: 16 }}>
          非常感谢您提供的信息！在您的拜访过程中，{customer.name}是否提及了下次拜访时间或者任何感兴趣的产品资料？
        </p>
      )}
      {user2 && (
        <div className={`proto-user${privacy?.flagged ? " proto-privacy" : ""}`} style={{ maxWidth: 335 }}>
          {privacy?.flagged ? highlightPII(user2, privacy.spans, offLabel?.term) : user2}
        </div>
      )}
      {stage === "parsing2" && <StatusLine text="正在根据拜访记录组织说明…" />}
      {(stage === "parsing2" || after(stage, "todo")) && (
        <TypedReply text={narratives[1]} streaming={streaming && stage === "parsing2"} />
      )}
      {after(stage, "todo") && (
        <>
          {(privacy?.flagged || offLabel?.flagged) && (
            <StatusLine text={`解析已完成。${privacy?.flagged ? "检测到您的输入涉及潜在病人隐私风险，相关表述已标记高亮，系统将忽略该信息。" : ""}${offLabel?.flagged ? `（“${offLabel.term}”不在已批准适应症范围内，已按合规忽略。）` : ""}`} />
          )}
          {suggestion && (
            <article className="proto-todo">
              <p>已识别到了潜在的后续拜访计划。最终确认后才会保存为跟进任务。您可以选择采纳或忽略该建议。</p>
              <div className="row"><span>拜访日期</span>{suggestion.date}</div>
              <div className="row"><span>拜访材料</span>{suggestion.material}</div>
              {todo ? (
                <p className="proto-note">{todo === "adopt" ? "已选择创建跟进任务，最终提交拜访后生效。" : "已为您忽略此建议。"}</p>
              ) : (
                <div className="actions">
                  <button onClick={() => onTodo("ignore")}>忽略</button>
                  <button className="primary" onClick={() => onTodo("adopt")}>采纳</button>
                </div>
              )}
            </article>
          )}
          {todo === "adopt" && article && (
            <>
              <p className="proto-copy" style={{ marginTop: 16 }}>已根据您提到的{result?.extracted?.interested_topic ?? "医生关心"}相关内容，为您安排了以下相关推荐文章</p>
              <article className="proto-card article">
                <div className="proto-material">
                  <img src={`${A}ad-cover.png`} alt="" />
                  <p>{article.title}</p>
                </div>
                <p className="proto-note">演示资料，可在后续准备中继续查询。</p>
              </article>
            </>
          )}
        </>
      )}
      {stage === "confirm" && (
        <form className="proto-confirm draft-review" key={result?.suggested_action?.draft_id}
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            onConfirm({ feedback: String(fields.get("feedback") ?? ""), next_visit: String(fields.get("next_visit") ?? ""), follow_up: String(fields.get("follow_up") ?? "") });
          }}>
          <h3>核对本次完整记录</h3>
          <label>医生反馈<textarea name="feedback" required defaultValue={result?.extracted?.feedback ?? ""} /></label>
          <label>下次拜访<input name="next_visit" defaultValue={result?.extracted?.next_visit ?? "待确认"} /></label>
          <label>跟进事项<textarea name="follow_up" defaultValue={result?.extracted?.follow_up ?? ""} /></label>
          <p>{todo === "adopt" ? "提交后：保存拜访记录，并创建跟进任务。" : "提交后：仅保存拜访记录，不创建跟进任务。"}</p>
          <div className="actions">
            <button type="button" onClick={onCancel} disabled={streaming}>返回补充</button>
            <button type="submit" className="primary" disabled={streaming}>{streaming ? "正在保存…" : "确认保存"}</button>
          </div>
        </form>
      )}
      {stage === "done" && (
        <>
          <div className="proto-user" style={{ width: 88, padding: 16 }}>提交拜访</div>
          <div className="proto-confirm">
            <p>信息提交后将结束本次拜访，确认现在要提交吗？</p>
            <button className="proto-btn" disabled>已提交</button>
          </div>
          <p className="proto-copy" style={{ marginTop: 16 }}>记录已生效。你可以继续询问“上次拜访聊了什么”或“有哪些待办”，查看保存结果。</p>
        </>
      )}
    </>
  );
}

function Composer({
  value, listening, showSubmit, pre, onChange, onVoice, onSend, onSubmitVisit,
}: {
  value: string; listening: boolean; showSubmit: boolean; pre: boolean;
  onChange: (v: string) => void; onVoice: () => void; onSend: () => void; onSubmitVisit: () => void;
}) {
  return (
    <footer className="proto-composer">
      {showSubmit && (
        <button className="submit" onClick={onSubmitVisit}>
          <img src={`${A}check.svg`} alt="" />
          提交拜访
        </button>
      )}
      <div className={`proto-input${pre ? " pre" : ""}`}>
        <textarea
          aria-label="发消息"
          value={value}
          placeholder={listening ? "正在听写…" : "发消息给Concierge"}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button className={`mic${listening ? " on" : ""}`} aria-label="语音录入" onClick={onVoice}>
          <img src={`${A}mic.svg`} alt="" />
        </button>
      </div>
      <p className="proto-foot">AI生成内容仅供参考</p>
      <i className="proto-homebar" />
    </footer>
  );
}
