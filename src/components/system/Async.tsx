// 统一五态渲染器：任何数据展示都经它，强制提供 loading/empty/error(带重试)。
import type { ReactNode } from "react";
import type { Async } from "@/lib/state";

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="加载中"
      className="inline-block animate-spin rounded-full border-2 border-[var(--brand-weak)] border-t-[var(--brand)]"
      style={{ width: size, height: size }}
    />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--r-md)] bg-[var(--surface-2)] ${className}`} />;
}

export function ErrorRetry({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[color:var(--danger)]/30 bg-[var(--danger-weak)] p-[var(--s4)] text-[13px] text-[var(--danger)]">
      <p className="m-0 mb-[var(--s2)] leading-[1.5]">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-[var(--r-sm)] border border-[color:var(--danger)]/40 bg-white px-[var(--s3)] py-[var(--s1)] text-[12px] text-[var(--danger)]">
          重试
        </button>
      )}
    </div>
  );
}

export function Async<T>({
  state,
  loading,
  empty,
  error,
  children,
}: {
  state: Async<T>;
  loading?: ReactNode;
  empty?: ReactNode;
  error?: (e: { message: string; retry?: () => void }) => ReactNode;
  children: (data: T) => ReactNode;
}) {
  switch (state.status) {
    case "idle":
    case "loading":
      return <>{loading ?? <Spinner />}</>;
    case "streaming":
      return <>{children(state.partial)}</>;
    case "empty":
      return <>{empty ?? null}</>;
    case "error":
      return <>{error ? error(state) : <ErrorRetry message={state.message} onRetry={state.retry} />}</>;
    case "success":
      return <>{children(state.data)}</>;
  }
}
