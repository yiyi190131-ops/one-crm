"use client";
/* eslint-disable @next/next/no-img-element */

import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AgentResponse, ConversationSummary, Customer, DetailAid, HomeTurn, LadderUpdate, VisitSession } from "@/lib/types";
import { DEMO_CUSTOMERS } from "@/lib/demo-customers";
import { demoUserId } from "@/lib/session";
import { timedFetch, wakeBackend } from "@/lib/wake";

const A = "/figma/proto/";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
type DraftEdits = { feedback: string; next_visit: string; follow_up: string };
const FACES = ["😞", "😐", "😄"] as const;
const LADDER = ["中立", "认可", "认可且推荐"] as const;

type Screen = "home" | "aid";
type ThreadTurn = HomeTurn & { result?: AgentResponse | null };
type PostStage = "idle" | "parsing1" | "ladder" | "follow" | "parsing2" | "todo" | "confirm" | "done";
type SpeechRecognitionEvent = {
  results: { length: number; [index: number]: { isFinal?: boolean; [index: number]: { transcript: string } } };
};
type SpeechRecognizer = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type SpeechRecognizerConstructor = new () => SpeechRecognizer;

function after(stage: PostStage, target: PostStage) {
  const order: PostStage[] = ["idle", "parsing1", "ladder", "follow", "parsing2", "todo", "confirm", "done"];
  return order.indexOf(stage) >= order.indexOf(target);
}

const TYPE_MS = 32;
const TYPE_PAUSE_MS = 160;
const EVIDENCE_STEP_MS = 220;

function samplePostFeedback(customer: Customer) {
  const name = customer.name;
  const patients = (customer.target_patients ?? []).slice(0, 2).join("、") || "中重度 AD";
  const safety = customer.perception_ladder?.find((item) => item.dimension === "长期安全")?.level ?? "中立";
  const control = customer.perception_ladder?.find((item) => item.dimension === "维稳")?.level ?? "中立";
  const base = customer.last_feedback?.trim() || "对产品仍有顾虑，希望补充循证材料。";
  return (
    `今天和${name}完成面对面拜访。沟通对象主要是${patients}相关需求。` +
    `当前观念上长期安全偏「${safety}」、维稳偏「${control}」。` +
    `医生反馈：${base}` +
    `我建议下周同一时段复访，并带上对应已审批资料做一次对照讲解，同时确认${customer.open_task || "后续跟进事项"}。`
  );
}

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

function conversationTime(raw?: string) {
  if (!raw) return "";
  const stamp = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isNaN(stamp.getTime())) return raw.slice(0, 16);
  const mm = String(stamp.getMonth() + 1).padStart(2, "0");
  const dd = String(stamp.getDate()).padStart(2, "0");
  const hh = String(stamp.getHours()).padStart(2, "0");
  const mi = String(stamp.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

function conversationLabel(item: ConversationSummary) {
  const name = item.customer_name?.trim() || "未选医生";
  const when = conversationTime(item.updated_at);
  if (!item.turn_count) return when ? `${name} · 新对话 ${when}` : `${name} · 新对话`;
  return when ? `${name} ${when}` : name;
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
  const [screen, setScreen] = useState<Screen>("home");
  const [customers, setCustomers] = useState<Customer[]>(DEMO_CUSTOMERS);
  const [waking, setWaking] = useState(true);
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
  const [aidNote, setAidNote] = useState<string | null>(null);
  const [activeAid, setActiveAid] = useState<DetailAid | null>(null);
  const [detailAids, setDetailAids] = useState<DetailAid[]>([]);
  const [visitSession, setVisitSession] = useState<VisitSession>({ seconds: 0, shownAids: [] });
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [showPreDoctors, setShowPreDoctors] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationRef = useRef<string | null>(null);
  const customerRef = useRef<Customer | null>(null);
  const intentRef = useRef<"pre" | "post" | null>(null);
  const speechRef = useRef<SpeechRecognizer | null>(null);
  const voiceBaseRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const jumpBottomRef = useRef<HTMLButtonElement>(null);
  const stickToBottomRef = useRef(true);
  const followBudgetRef = useRef<number | null>(null);
  customerRef.current = customer;

  async function loadAids(customerId: string) {
    try {
      const res = await timedFetch(`${API_BASE}/detail-aids?customer_id=${customerId}`, {}, 8000);
      if (!res.ok) return;
      const data = (await res.json()) as { aids: DetailAid[] };
      setDetailAids(data.aids ?? []);
    } catch { /* 手卡空态 */ }
  }

  async function bindCustomer(next: Customer) {
    const existingId = conversationRef.current;
    if (!existingId) {
      const res = await timedFetch(`${API_BASE}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: demoUserId(), customer_id: next.id, force_new: true }),
      }, 20_000);
      if (!res.ok) throw new Error("bind");
      const conversation = (await res.json()) as { id: string };
      conversationRef.current = conversation.id;
      setActiveConversationId(conversation.id);
      window.localStorage.setItem("crm-agent-conversation", conversation.id);
    }
    customerRef.current = next;
    setCustomer(next);
    await loadAids(next.id);
    if (existingId) {
      setConversations((items) => items.map((item) => (
        item.id === existingId
          ? { ...item, customer_id: next.id, customer_name: next.name }
          : item
      )));
      return;
    }
    await loadConversations();
  }

  async function loadConversations() {
    try {
      const res = await timedFetch(`${API_BASE}/conversations?user_id=${demoUserId()}`);
      if (!res.ok) return;
      setConversations((await res.json()) as ConversationSummary[]);
    } catch { /* 菜单空态 */ }
  }

  async function loadThread(conversationId: string) {
    const res = await timedFetch(`${API_BASE}/conversations/${conversationId}?user_id=${demoUserId()}`, {}, 12_000);
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
    setScreen("home");
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.classList.remove("is-enter");
    void el.offsetWidth;
    el.classList.add("is-enter");
  }, [screen, !customer && turns.length === 0]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const syncJump = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = gap < 80;
      stickToBottomRef.current = atBottom;
      if (atBottom) followBudgetRef.current = null;
      const btn = jumpBottomRef.current;
      if (btn) btn.hidden = gap <= el.clientHeight * 0.35;
    };
    el.addEventListener("scroll", syncJump, { passive: true });
    syncJump();
    return () => el.removeEventListener("scroll", syncJump);
  }, []);

  useEffect(() => {
    if (loading) {
      stickToBottomRef.current = true;
      const el = scrollRef.current;
      followBudgetRef.current = el ? el.scrollTop + el.clientHeight : null;
    } else {
      followBudgetRef.current = null;
    }
  }, [loading]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || screen === "aid") return;
    const syncJump = () => {
      const btn = jumpBottomRef.current;
      if (!btn) return;
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      btn.hidden = gap <= el.clientHeight * 0.35;
    };
    if (turns.length === 0 && screen === "home") {
      el.scrollTop = 0;
      syncJump();
      return;
    }
    const showPostNow = openVisitIndex(turns) >= 0;

    if (loading && stickToBottomRef.current) {
      const budget = followBudgetRef.current;
      const maxTop = budget == null ? el.scrollHeight : Math.min(el.scrollHeight, budget);
      if (el.scrollTop < maxTop) el.scrollTop = maxTop;
      syncJump();
      return;
    }

    if (!stickToBottomRef.current && !loading) {
      syncJump();
      return;
    }

    if (!loading && !showPostNow) {
      const bots = el.querySelectorAll<HTMLElement>(".proto-turn.proto-bot");
      const lastBot = bots[bots.length - 1];
      if (lastBot) {
        el.scrollTop += lastBot.getBoundingClientRect().top - el.getBoundingClientRect().top;
        syncJump();
        return;
      }
    }

    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      syncJump();
    }
  }, [screen, postStage, todo, turns, loading, customer]);

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    followBudgetRef.current = null;
    el.scrollTop = el.scrollHeight;
    if (jumpBottomRef.current) jumpBottomRef.current.hidden = true;
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (screen !== "aid") return;
    const timer = window.setInterval(() => setActiveSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    let cancelled = false;
    const showUi = window.setTimeout(() => {
      if (!cancelled) setWaking(false);
    }, 400);

    void (async () => {
      const ready = await wakeBackend();
      if (cancelled) return;
      setWaking(false);
      if (!ready) return;
      try {
        const res = await timedFetch(`${API_BASE}/customers?user_id=${demoUserId()}`);
        if (!res.ok) throw new Error("customers");
        const list = (await res.json()) as Customer[];
        if (cancelled || !list.length) return;
        setCustomers(list);
        const savedId = window.localStorage.getItem("crm-agent-conversation");
        if (!savedId) return;
        const convRes = await timedFetch(`${API_BASE}/conversations/${savedId}?user_id=${demoUserId()}`);
        if (!convRes.ok) return;
        const conv = (await convRes.json()) as { id: string; customer_id?: string | null };
        conversationRef.current = conv.id;
        setActiveConversationId(conv.id);
        const matched = list.find((item) => item.id === conv.customer_id);
        if (matched) {
          setCustomer(matched);
          await loadAids(matched.id);
        } else if (conv.customer_id) {
          return;
        }
        await loadThread(conv.id);
        await loadConversations();
      } catch {
        /* 静态医生列表已可点，不阻塞首屏 */
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(showUi);
    };
  }, []);

  async function chooseDoctor(next: Customer) {
    if (loading || customerRef.current?.id === next.id) return;
    const startPost = intentRef.current === "post";
    intentRef.current = null;
    setPickError(null);
    setShowPreDoctors(false);
    setInput("");
    setScreen("home");
    try {
      if (startPost) {
        await bindCustomer(next);
        setPostStage("idle");
        setPostTurns([]);
        setPostReplies([]);
        setPostResult(null);
        setTodo(null);
        setAidNote(null);
        setActiveAid(null);
        setVisitSession({ seconds: 0, shownAids: [] });
        setActiveSeconds(0);
        setTurns([{
          id: nextId("s"),
          role: "system",
          kind: "visit_session",
          text: "开始整理访后记录。",
          payload: { seconds: 0, shown_aids: [] },
        }]);
        return;
      }
      await pushExchange(next.name, "auto", undefined, async () => {
        await bindCustomer(next);
        setPostStage("idle");
        setPostTurns([]);
        setPostReplies([]);
        setPostResult(null);
        setTodo(null);
        setAidNote(null);
        setActiveAid(null);
        setVisitSession({ seconds: 0, shownAids: [] });
        setActiveSeconds(0);
      });
    } catch {
      setPickError("服务正在启动，请再试一次。");
      void wakeBackend();
    }
  }

  function goChat() {
    setScreen("home");
    setAidNote(null);
    setInput("");
    setNotice(null);
  }

  function newChat() {
    conversationRef.current = null;
    setActiveConversationId(null);
    window.localStorage.removeItem("crm-agent-conversation");
    setCustomer(null);
    setTurns([]);
    setPostStage("idle");
    setPostTurns([]);
    setPostReplies([]);
    setPostResult(null);
    setTodo(null);
    setAidNote(null);
    setActiveAid(null);
    setDetailAids([]);
    setVisitSession({ seconds: 0, shownAids: [] });
    setActiveSeconds(0);
    setInput("");
    setNotice(null);
    setPickError(null);
    setListening(false);
    setScreen("home");
    setMenuOpen(false);
    intentRef.current = null;
    setShowPreDoctors(false);
    setMenuQuery("");
  }

  async function openConversation(id: string) {
    setMenuOpen(false);
    setPickError(null);
    try {
      const res = await timedFetch(`${API_BASE}/conversations/${id}?user_id=${demoUserId()}`, {}, 12_000);
      if (!res.ok) throw new Error("thread");
      const conv = (await res.json()) as ConversationSummary & { turns?: Array<Partial<HomeTurn> & { text: string; role: HomeTurn["role"] }> };
      const matched = customers.find((item) => item.id === conv.customer_id) ?? null;
      conversationRef.current = conv.id;
      setActiveConversationId(conv.id);
      window.localStorage.setItem("crm-agent-conversation", conv.id);
      setCustomer(matched);
      if (matched) await loadAids(matched.id);
      await loadThread(conv.id);
      setAidNote(null);
      setInput("");
      intentRef.current = null;
      setShowPreDoctors(false);
    } catch {
      setPickError("无法打开这条聊天记录。");
    }
  }

  function namedDoctors(raw: string) {
    const q = raw.replace(/\s+/g, "");
    if (!q) return [];
    return customers.filter((item) => {
      const name = item.name.replace(/\s+/g, "");
      return q === name || q.includes(name) || (q.length >= 2 && name.includes(q));
    });
  }

  async function sendWithoutCustomer(text = input) {
    const q = text.trim();
    if (!q || loading) return;
    setNotice(null);
    setPickError(null);
    const named = namedDoctors(q);
    if (named.length === 1) {
      setInput("");
      void chooseDoctor(named[0]);
      return;
    }
    if (q === "访前准备") {
      intentRef.current = "pre";
      setShowPreDoctors(true);
    }
    if (q === "访后记录") {
      intentRef.current = "post";
      setShowPreDoctors(false);
    }
    setInput("");
    const data = await pushExchange(q, "auto");
    if (data?.route && data.route !== "need_customer") intentRef.current = null;
  }

  async function askAgent(message: string, mode: "auto" | "pre" | "post", onToken: (text: string) => void) {
    const res = await fetch(`${API_BASE}/agent/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        message,
        mode,
        user_id: demoUserId(),
        ...(customerRef.current?.id ? { customer_id: customerRef.current.id } : {}),
        ...(conversationRef.current ? { conversation_id: conversationRef.current } : {}),
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

  async function pushExchange(q: string, mode: "auto" | "post", onPartial?: (text: string) => void, beforeAsk?: () => Promise<void>) {
    const userId = nextId("u");
    const botId = nextId("a");
    setLoading(true);
    setTurns((items) => [
      ...items,
      { id: userId, role: "user", kind: "message", text: q },
      { id: botId, role: "assistant", kind: "message", text: "", result: { reply: "" } as AgentResponse },
    ]);
    try {
      if (beforeAsk) await beforeAsk();
      const data = await askAgent(q, mode, (partial) => {
        onPartial?.(partial);
        setTurns((items) => items.map((item) => (
          item.id === botId ? { ...item, text: partial, result: { ...(item.result ?? { reply: "" }), reply: partial } as AgentResponse } : item
        )));
      });
      if (data.conversation_id) {
        conversationRef.current = data.conversation_id;
        setActiveConversationId(data.conversation_id);
        window.localStorage.setItem("crm-agent-conversation", data.conversation_id);
      }
      setTurns((items) => items.map((item) => (
        item.id === botId ? { ...item, text: data.reply, route: data.route, result: data, suggested_action: data.suggested_action } : item
      )));
      return data;
    } catch {
      const fallback = "服务正在启动，请再试一次。";
      setTurns((items) => items.map((item) => (
        item.id === botId ? { ...item, text: fallback, result: { reply: fallback, trace: [] } as AgentResponse } : item
      )));
      setNotice("服务正在启动，请再试一次");
      void wakeBackend();
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
      setNotice("服务正在启动，请再试一次。");
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

  function stopVoice() {
    speechRef.current?.stop();
    speechRef.current = null;
    setListening(false);
  }

  function voice() {
    if (listening) {
      stopVoice();
      return;
    }
    const w = window as typeof window & { SpeechRecognition?: SpeechRecognizerConstructor; webkitSpeechRecognition?: SpeechRecognizerConstructor };
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice("当前浏览器不支持语音识别，请使用 Chrome 或直接输入文字。");
      return;
    }
    setNotice(null);
    voiceBaseRef.current = input.trim();
    setListening(true);
    const recognition = new Recognition();
    speechRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finals = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finals += piece;
        else interim += piece;
      }
      const spoken = `${finals}${interim}`.trim();
      setInput([voiceBaseRef.current, spoken].filter(Boolean).join(" "));
    };
    recognition.onerror = () => {
      setNotice("未能识别语音，请检查麦克风权限后重试。");
      stopVoice();
    };
    recognition.onend = () => {
      speechRef.current = null;
      setListening(false);
    };
    try { recognition.start(); } catch { setListening(false); setNotice("无法启动麦克风。"); }
  }

  function sendComposer() {
    if (listening) stopVoice();
    if (showPost) void sendPost();
    else if (!customer) void sendWithoutCustomer();
    else void sendPre();
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
    setScreen("home");
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
  const showSubmit = showPost && postStage !== "done";
  const showFill = showPost && postStage === "idle";
  const welcome = !customer && screen !== "aid" && turns.length === 0 && !loading;
  const scrollClass = [
    screen === "aid" ? "proto-scroll aid" : "proto-scroll",
    welcome ? "is-idle" : "",
  ].filter(Boolean).join(" ");
  const visibleConversations = conversations.filter((item) => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return true;
    return conversationLabel(item).toLowerCase().includes(q) || (item.title ?? "").toLowerCase().includes(q);
  });
  const suggestions = unusedChips(turns);

  return (
    <div className="proto-page">
      <section className="proto-phone">
        {screen !== "aid" && (
          <header className="proto-top">
            <button className="proto-more" aria-label="更多" onClick={() => { setMenuOpen((open) => !open); if (!menuOpen) { setMenuQuery(""); void loadConversations(); } }}>
              <i /><i /><i />
            </button>
            <h1>拜访助手</h1>
          </header>
        )}
        {screen !== "aid" && (
          <div className={`proto-drawer${menuOpen ? " is-open" : ""}`} onClick={() => setMenuOpen(false)}>
            <aside className="proto-drawer-panel" onClick={(event) => event.stopPropagation()} aria-label="更多">
              <div className="proto-drawer-head">
                <label className="proto-drawer-search">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.75" />
                    <path d="M16.2 16.2 20 20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                  <input
                    value={menuQuery}
                    onChange={(event) => setMenuQuery(event.target.value)}
                    placeholder="搜索对话"
                    aria-label="搜索对话"
                  />
                </label>
                <button className="proto-drawer-create" type="button" aria-label="新建对话" onClick={newChat}>
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="proto-drawer-list">
                <p>历史聊天</p>
                {visibleConversations.length ? visibleConversations.map((item) => (
                  <button
                    key={item.id}
                    className={`proto-drawer-item${item.id === activeConversationId ? " on" : ""}`}
                    onClick={() => void openConversation(item.id)}
                  >
                    {conversationLabel(item)}
                  </button>
                )) : <span>{conversations.length ? "没有匹配的对话" : "还没有聊天记录"}</span>}
              </div>
            </aside>
          </div>
        )}

        <div className={scrollClass} ref={scrollRef}>
          {screen !== "aid" && (
            <>
              {!customer && welcome && (
                <DoctorPick
                  error={pickError}
                  onPreVisit={() => void sendWithoutCustomer("访前准备")}
                  onPostVisit={() => void sendWithoutCustomer("访后记录")}
                />
              )}
              {!customer && !welcome && (
                <>
                  {turns.map((turn) => (
                    <TurnBlock
                      key={turn.id}
                      turn={turn}
                      customer={null}
                      streaming={loading && turn.id === lastTurn?.id && turn.role === "assistant"}
                      onOpenMaterial={(aid) => { setActiveAid(aid); setActiveSeconds(0); setScreen("aid"); }}
                    />
                  ))}
                  {showPreDoctors && !loading && (
                    <DoctorSuggest customers={customers} onChoose={chooseDoctor} />
                  )}
                </>
              )}
              {customer && (
                <>
                  {!showPost && turns.length === 0 && (
                    <div className="proto-turn is-user">
                      <div className="proto-user">拜访{customer.name}</div>
                    </div>
                  )}
                  {(showPost && openVisitIndex(turns) >= 0 ? turns.slice(0, openVisitIndex(turns) + 1) : turns).map((turn) => (
                    <TurnBlock
                      key={turn.id}
                      turn={turn}
                      customer={customer}
                      streaming={loading && turn.id === lastTurn?.id && turn.role === "assistant" && !showPost}
                      onOpenMaterial={(aid) => { setActiveAid(aid); setActiveSeconds(0); setScreen("aid"); }}
                    />
                  ))}
                  {!showPost && turns.length === 0 && (
                    <PreBrief customer={customer} aids={detailAids} onAsk={sendPre} onStart={() => { setActiveAid(detailAids[0] ?? null); setActiveSeconds(0); setScreen("aid"); }} showChips={false} />
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
            </>
          )}
          {screen === "aid" && (
            <Aid
              aid={activeAid}
              note={aidNote}
              onBack={goChat}
              onShare={() => setNotice("演示环境未连接企业微信分享，请在当前页面查看材料。")}
              onRemote={() => setNotice("演示环境未连接远程会议服务。")}
              onSubmit={() => void finishAid()}
            />
          )}
        </div>

        {notice && <p className="proto-toast" role="status">{notice}</p>}

        {screen !== "aid" && (
          <button
            type="button"
            ref={jumpBottomRef}
            className="proto-jump-bottom"
            aria-label="回到底部"
            hidden
            onClick={jumpToBottom}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {screen !== "aid" && (
          <Composer
            value={input}
            listening={listening}
            loading={loading}
            waking={waking}
            showFill={showFill}
            showSubmit={showSubmit}
            idle={welcome}
            placeholder={welcome ? "今天我能为您做些什么？" : "发消息给拜访助手"}
            onChange={setInput}
            onFill={() => {
              if (customer) setInput(samplePostFeedback(customer));
            }}
            onVoice={voice}
            onSend={sendComposer}
            onSubmitVisit={() => setPostStage("confirm")}
          />
        )}
      </section>
    </div>
  );
}

function DoctorPick({
  error, onPreVisit, onPostVisit,
}: {
  error: string | null;
  onPreVisit: () => void; onPostVisit: () => void;
}) {
  return (
    <div className="proto-idle">
      <div className="proto-idle-hero">
        <h2 className="proto-hello">欢迎，<em>Xiang</em></h2>
        <div className="proto-caps">
          <button type="button" onClick={onPreVisit}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect width="8" height="4" x="8" y="2" rx="1" stroke="currentColor" strokeWidth="1.75" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="1.75" />
              <path d="M8 11h.01M8 16h.01M12 11h4M12 16h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            访前准备
          </button>
          <button type="button" onClick={onPostVisit}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
              <path d="m9 15 2 2 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            访后记录
          </button>
        </div>
      </div>
      {error && <p className="proto-error">{error}</p>}
    </div>
  );
}

function DoctorSuggest({ customers, onChoose }: { customers: Customer[]; onChoose: (c: Customer) => void }) {
  return (
    <div className="proto-guide">
      <p className="proto-pick-label">👇 这几位也许是你要找的</p>
      <div className="proto-pick">
        {customers.map((item) => (
          <button key={item.id} className="proto-pick-item" onClick={() => onChoose(item)}>
            <section>
              <b>{item.name}</b>
              <small>{item.title} · {item.hospital}</small>
            </section>
            <strong>›</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function PreBrief({ customer, aids, onAsk, onStart, showChips = true }: { customer: Customer; aids: DetailAid[]; onAsk: (q: string) => void; onStart: () => void; showChips?: boolean }) {
  const product = customer.product;
  const material = aids[0];
  const articleTitle = "达必妥与 JAK 抑制剂安全性对比研究（2026）";
  const advantages = (customer.knowledge?.advantages ?? [])
    .filter((item) => item.level && item.level !== "未知")
    .slice(0, 3)
    .map((item) => `${item.name}：${item.level}`);
  const patients = (customer.target_patients ?? []).slice(0, 3);
  return (
    <>
      <p className="proto-copy">已为你准备好{customer.name}的访前简报。</p>
      <ul className="proto-list proto-copy">
        <li>当前内容围绕<b>{product}</b>展开。如需查看其他相关内容可以告诉我。</li>
        {customer.grade && <li>客户等级：<b>{customer.grade}</b>{customer.department ? ` · ${customer.department}${customer.role ? ` / ${customer.role}` : ""}` : ""}</li>}
        {customer.hospital && <li>所属机构：{customer.hospital}</li>}
      </ul>
      <hr className="proto-rule" />
      <p className="proto-copy">📌 上次拜访（{customer.last_visit}）</p>
      <ul className="proto-list proto-copy">
        <li>使用材料：{customer.last_material ?? "—"}</li>
        <li>拜访反馈：{customer.last_feedback}</li>
        <li>当前观念阶梯<b>：{customer.tier}</b></li>
        {advantages.length > 0 && <li>关键观念：{advantages.join("；")}</li>}
        {patients.length > 0 && <li>目标患者侧重：{patients.join("、")}</li>}
      </ul>
      <p className="proto-copy" style={{ marginTop: 12 }}>🎯 <b>本次拜访重点：</b></p>
      <ul className="proto-list proto-copy">
        <li>
          优先回应医生上次提出的需求，并查阅相关已审批资料
          <a href="#aid" onClick={(event) => { event.preventDefault(); onStart(); }}>「{articleTitle}」</a>
        </li>
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
          <section>
            <p>{material?.subtitle ?? material?.title ?? "中度AD 2型炎症共病"}</p>
            <div className="proto-tags">
              {(material?.tags ?? ["标签1", "标签2"]).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          </section>
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

function StatusLine({ text, busy }: { text: string; busy?: boolean }) {
  return (
    <div className={`proto-status-line${busy ? " is-busy" : ""}`}>
      {busy ? <i className="proto-spinner" aria-hidden /> : <img src={`${A}parsed.svg`} alt="" />}
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

function Staggered({ streaming, children, step = EVIDENCE_STEP_MS }: { streaming: boolean; children: ReactNode; step?: number }) {
  const items = Children.toArray(children).filter(Boolean);
  const [live] = useState(streaming);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (streaming || !live || items.length === 0) return;
    const timer = window.setInterval(() => {
      setRevealed((n) => {
        const next = n + 1;
        if (next >= items.length) window.clearInterval(timer);
        return next;
      });
    }, step);
    return () => window.clearInterval(timer);
  }, [streaming, live, items.length, step]);

  const count = streaming ? 0 : live ? Math.min(revealed, items.length) : items.length;
  if (!count) return null;
  return (
    <>
      {items.slice(0, count).map((child, index) => (
        <div key={index} className="proto-reveal">{child}</div>
      ))}
    </>
  );
}

function TurnBlock({ turn, customer, streaming, onOpenMaterial }: {
  turn: ThreadTurn;
  customer: Customer | null;
  streaming: boolean;
  onOpenMaterial: (aid: DetailAid) => void;
}) {
  if (turn.kind === "visit_session") {
    return (
      <article className="proto-system">
        <p className="proto-copy"><b>面对面拜访</b></p>
        <p className="proto-copy">{turn.text}</p>
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
      <StatusLine busy={streaming} text={streaming ? "解析中" : "解析已完成"} />
      <TypedReply text={result.reply || turn.text} streaming={streaming} />
      {route === "customer_insight" && customer && <InsightEvidence customer={customer} streaming={streaming} />}
      {(route === "material_recommendation" || route === "pre_visit") && (
        <Staggered streaming={streaming}>
          <MaterialEvidence result={result} onOpen={onOpenMaterial} />
        </Staggered>
      )}
      {route === "institution_access" && customer && (
        <Staggered streaming={streaming}>
          <HospitalEvidence customer={customer} />
        </Staggered>
      )}
      {route === "guardrail" && (
        <Staggered streaming={streaming}>
          <GuideEvidence />
        </Staggered>
      )}
    </div>
  );
}

function InsightEvidence({ customer, streaming }: { customer: Customer; streaming: boolean }) {
  const stats = customer.interaction_stats ?? {};
  const events = customer.interactions ?? [];
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? events : events.slice(0, 2);
  return (
    <Staggered streaming={streaming}>
      <p className="proto-copy">👤 当前观念阶梯：<b>{customer.tier}</b></p>
      <div>
        <p className="proto-copy" style={{ marginTop: 12 }}>📈 近1个月互动概览</p>
        <div className="proto-table">
          <div className="head"><span>互动类型</span><span>互动次数</span></div>
          {Object.entries(stats).map(([type, count]) => (
            <div key={type}><span>{type}</span><span>{count}</span></div>
          ))}
        </div>
      </div>
      <div>
        <p className="proto-copy" style={{ marginTop: 16 }}>📋 详细互动记录</p>
        <div className="proto-timeline">
          {visible.map((event) => (
            <div className="proto-event" key={`${event.date}-${event.type}`}>
              <b>{event.date} | {event.type}</b>
              <div className="box"><p>{event.detail}</p></div>
            </div>
          ))}
        </div>
        {events.length > 2 && !expanded && (
          <button type="button" className="proto-expand" onClick={() => setExpanded(true)}>
            展开全部 {events.length} 条
          </button>
        )}
      </div>
    </Staggered>
  );
}

function MaterialEvidence({ result, onOpen }: { result: AgentResponse; onOpen: (aid: DetailAid) => void }) {
  const docs = (result.sources ?? []).filter((source) => source.kind === "approved-evidence" || source.kind === "approved-material");
  if (!docs.length) return <p className="proto-note">未检索到相关有效材料，可换一个主题继续询问。</p>;
  return (
    <>
      {docs.map((doc) => {
        const title = doc.title.replace(/^演示材料：/, "");
        const tags = [doc.status.split(" · ")[0], doc.version].filter(Boolean);
        return (
          <article className="proto-card" key={doc.id}>
            <div className="proto-material">
              <img src={`${A}ad-cover.png`} alt="" />
              <section>
                <p>{title}</p>
                <div className="proto-tags">
                  {tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </section>
            </div>
            {doc.excerpt && <p className="proto-excerpt">{doc.excerpt}</p>}
            <button
              className="proto-btn"
              onClick={() => onOpen({
                id: doc.id,
                title: doc.title,
                subtitle: doc.version,
                points: [doc.excerpt],
                tags: tags.length ? tags : ["演示资料"],
                status: doc.status,
              })}
            >
              打开此材料进行演示
            </button>
          </article>
        );
      })}
    </>
  );
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
      </div>
      <div className="proto-aid-body">
        <img className="chart" src={`${A}aid-long.png`} alt={aid?.title ?? "拜访材料"} />
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
          <em>{label}</em>
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
      {user1 && (
        <div className="proto-turn is-user">
          <div className="proto-user">{user1}</div>
        </div>
      )}
      {(stage === "parsing1" || after(stage, "ladder")) && (
        <StatusLine busy={stage === "parsing1"} text={stage === "parsing1" ? "解析中" : "解析已完成"} />
      )}
      {(stage === "parsing1" || after(stage, "ladder")) && (
        <TypedReply text={narratives[0] || result?.reply} streaming={streaming && stage === "parsing1"} />
      )}
      {after(stage, "ladder") && result?.extracted && (
        <article className="proto-km">
          <p>根据本次反馈，整理出以下观念变化。确认提交前不会写入 CRM。</p>
          {updates.map((update) => (
            <div className="proto-km-item" key={update.dimension}>
              <p className="proto-km-row">
                <img src={`${A}km-icon.svg`} alt="" width={16} height={16} />
                {update.dimension}
              </p>
              <p className="proto-km-change">
                {update.from && update.from !== update.to ? <>{update.from} <span>→</span> {update.to}</> : update.to}
              </p>
              <FaceRow active={update.to} />
            </div>
          ))}
          {!updates.length && <p className="proto-note">未识别到明确的观念变化，将保留原状态。可继续补充跟进安排。</p>}
          {stage === "ladder" && (
            <button type="button" className="proto-btn" onClick={onConfirmLadder}>继续补充跟进安排</button>
          )}
        </article>
      )}
      {after(stage, "follow") && (
        <p className="proto-copy" style={{ marginTop: 16 }}>
          非常感谢您提供的信息！在您的拜访过程中，{customer.name}是否提及了下次拜访时间或者任何感兴趣的产品资料？
        </p>
      )}
      {user2 && (
        <div className="proto-turn is-user">
          <div className={`proto-user${privacy?.flagged ? " proto-privacy" : ""}`}>
            {privacy?.flagged ? highlightPII(user2, privacy.spans, offLabel?.term) : user2}
          </div>
        </div>
      )}
      {stage === "parsing2" && <StatusLine busy text="解析中" />}
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
              {todo === "ignore" ? (
                <button type="button" className="proto-btn" disabled>已忽略</button>
              ) : todo === "adopt" ? null : (
                <div className="actions">
                  <button type="button" onClick={() => onTodo("ignore")}>忽略</button>
                  <button type="button" className="primary" onClick={() => onTodo("adopt")}>采纳</button>
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
  value, listening, loading, waking, showFill, showSubmit, idle, placeholder, onChange, onFill, onVoice, onSend, onSubmitVisit,
}: {
  value: string; listening: boolean; loading?: boolean; waking?: boolean; showFill?: boolean; showSubmit: boolean; idle?: boolean; placeholder?: string;
  onChange: (v: string) => void; onFill?: () => void; onVoice: () => void; onSend: () => void; onSubmitVisit: () => void;
}) {
  const canSend = Boolean(value.trim()) && !loading;
  const hint = listening
    ? "正在听写，再次点击麦克风结束"
    : waking
      ? "演示服务启动中"
      : "AI生成内容仅供参考";
  return (
    <footer className={`proto-composer${showFill || showSubmit ? " has-submit" : ""}${idle ? " is-idle" : ""}`}>
      {(showFill || showSubmit) && (
        <div className="proto-composer-actions">
          {showFill && (
            <button type="button" className="submit" onClick={onFill}>试填一段模拟拜访反馈</button>
          )}
          {showSubmit && (
            <button type="button" className="submit" onClick={onSubmitVisit}>
              <img src={`${A}check.svg`} alt="" />
              提交拜访
            </button>
          )}
        </div>
      )}
      <div className={`proto-input${listening ? " listening" : ""}${idle ? " is-idle" : ""}`}>
        <textarea
          aria-label="发消息"
          value={value}
          placeholder={listening ? "正在听写…" : placeholder ?? "发消息给拜访助手"}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        <button className={`mic${listening ? " on" : ""}`} aria-label={listening ? "结束语音录入" : "语音录入"} onClick={onVoice}>
          <img src={`${A}mic.svg`} alt="" />
        </button>
        <button className="send" aria-label="发送" disabled={!canSend} onClick={onSend}>
          <img src={`${A}arrow.svg`} alt="" />
        </button>
      </div>
      <p className={`proto-foot${waking ? " is-waking" : ""}`}>{hint}</p>
    </footer>
  );
}
