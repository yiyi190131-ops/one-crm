// 全站共享类型（从原 page.tsx 抽出，作为单一真源）。

export type Screen = "workspace" | "pre" | "active" | "post" | "success";

export type Citation = { title: string; version: string; status: string; excerpt: string; location?: string };
export type LadderUpdate = { dimension: string; from: string; to: string };
export type RecommendArticle = { id: string; title: string; tag?: string; note?: string; status?: string };
export type Extracted = {
  feedback: string;
  ladder: string;
  ladder_updates?: LadderUpdate[];
  next_visit: string;
  interested_topic?: string | null;
  follow_up: string;
  recommend_article?: RecommendArticle | null;
};
export type PrivacyFinding = { flagged: boolean; spans: string[]; reason: string };
export type OffLabelFinding = { flagged: boolean; term?: string | null; notice: string };
export type TodoSuggestion = { date: string; material: string; article_id?: string | null; type: string };
export type DetailAid = { id: string; title: string; subtitle?: string; points: string[]; tags: string[]; status?: string };
export type TraceStep = { label: string; detail: string; state: "done" | "active" | "guarded" };
export type SourceCard = Citation & { id: string; kind: "crm" | "business" | "approved-material" | "approved-evidence" };
export type SuggestedAction = {
  type: "create-task" | "confirm-submit";
  title: string;
  description: string;
  draft_id?: string | null;
  confirmation_token?: string | null;
};
export type AgentResponse = {
  todo_decision?: "adopt" | "ignore";
  reply: string;
  citation?: Citation | null;
  extracted?: Extracted | null;
  privacy?: PrivacyFinding | null;
  off_label?: OffLabelFinding | null;
  todo_suggestion?: TodoSuggestion | null;
  trace?: TraceStep[];
  sources?: SourceCard[];
  suggested_action?: SuggestedAction | null;
  route?: string;
  skill_id?: string | null;
  skill_version?: string | null;
  model_mode?: string;
  run_id?: string;
  conversation_id?: string | null;
};

export type VisitSession = { seconds: number; shownAids: DetailAid[] };
export const LADDER_LEVELS = ["中立", "认可", "认可且推荐"] as const;

export type TurnKind = "message" | "visit_session" | "visit_confirmed";
export type TimelinePayload = {
  todo_decision?: "adopt" | "ignore";
  seconds?: number;
  shown_aids?: DetailAid[];
  visit_id?: string;
  task_id?: string | null;
  draft_id?: string | null;
  next_visit?: string;
  extracted?: Extracted;
  privacy?: PrivacyFinding;
  off_label?: OffLabelFinding;
  todo_suggestion?: TodoSuggestion;
  citation?: Citation | null;
};
export type ChatTurn = { role: "user" | "assistant"; text: string };
export type HomeTurn = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  kind?: TurnKind;
  payload?: TimelinePayload;
  citation?: Citation | null;
  trace?: TraceStep[];
  sources?: SourceCard[];
  suggested_action?: SuggestedAction | null;
  route?: string;
  skill_id?: string | null;
  skill_version?: string | null;
  model_mode?: string;
  confirmed?: boolean;
};
export type ConversationSummary = { id: string; title: string; updated_at: string; customer_id?: string | null; customer_name?: string | null };
export type DeveloperRun = {
  id: string;
  route: string;
  skill_id?: string | null;
  skill_version?: string | null;
  model_mode: string;
  trace: TraceStep[];
  created_at: string;
};
export type Customer = {
  id: string;
  name: string;
  hospital: string;
  title: string;
  product: string;
  tier: string;
  last_visit: string;
  last_feedback: string;
  open_task: string;
  last_material?: string;
  meeting?: string;
  interactions?: { date: string; type: string; detail: string }[];
  interaction_stats?: Record<string, number>;
  perception_ladder?: { dimension: string; level: string }[];
  institution?: { formulary: string; coverage_trend: string; supply_risk: string };
};
export type PendingTask = { label: string; prompt: string; kind: "ask" | "post" | "pre" | "open" };
export type PreTurn = { id: string; question: string; loading: boolean; kind: "answer" | "recommend" | "unsupported"; result: AgentResponse | null };
