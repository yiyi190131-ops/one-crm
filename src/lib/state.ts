// 统一异步状态模型：任何请求 / Agent 调用 / 流式都归约到这一个形状。
export type Async<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "streaming"; partial: T }
  | { status: "success"; data: T }
  | { status: "empty" }
  | { status: "error"; message: string; retry?: () => void };

export const AsyncIdle: Async<never> = { status: "idle" };
