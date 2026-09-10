// 后端调用集中封装（不改契约）。所有 fetch 都从这里走，便于统一错误与基址。
import type { AgentResponse, ConversationSummary, Customer, DeveloperRun, DetailAid, HomeTurn } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";
export const USER_ID = "mr-demo-001";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export type ConversationDetail = ConversationSummary & { turns: Array<Omit<HomeTurn, "id">> };

export const api = {
  listCustomers: () => getJSON<Customer[]>("/customers"),
  agent: (body: { message: string; mode: string; customer_id?: string; user_id?: string; conversation_id?: string | null }) =>
    postJSON<AgentResponse>("/agent", body),
  listConversations: (userId: string) => getJSON<ConversationSummary[]>(`/conversations?user_id=${userId}`),
  getConversation: (id: string, userId: string) => getJSON<ConversationDetail>(`/conversations/${id}?user_id=${userId}`),
  createConversation: (body: { user_id: string; customer_id: string }) => postJSON<ConversationSummary>("/conversations", body),
  addVisitSession: (conversationId: string, body: { user_id: string; seconds: number; shown_aids: DetailAid[] }) =>
    postJSON<{ ok: boolean }>(`/conversations/${conversationId}/events`, { kind: "visit_session", ...body }),
  developerRuns: (conversationId: string) => getJSON<DeveloperRun[]>(`/developer/runs?conversation_id=${conversationId}`),
  detailAids: (customerId: string) => getJSON<{ aids: DetailAid[] }>(`/detail-aids?customer_id=${customerId}`),
};
