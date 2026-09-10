"use client";
// 统一输入区：自适应文本域 + 主按钮（发送/停止/听写）。Enter 发送，Shift+Enter 换行。
import type { ReactNode } from "react";

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  listening,
  loading,
  onVoice,
  onStop,
  footnote,
  banner,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  listening?: boolean;
  loading?: boolean;
  onVoice?: () => void;
  onStop?: () => void;
  footnote?: ReactNode;
  banner?: ReactNode;
}) {
  return (
    <footer className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)] px-[var(--s4)] pb-[var(--s3)] pt-[var(--s3)]">
      {banner}
      <div
        className={`flex items-end gap-[var(--s2)] rounded-[var(--r-lg)] border bg-[var(--surface)] px-[var(--s3)] py-[var(--s2)] transition-colors ${
          listening ? "border-[var(--brand)]" : "border-[var(--line)]"
        }`}
      >
        <textarea
          aria-label="向 CRM Agent 输入"
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-[14px] leading-[1.5] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
        />
        {loading ? (
          <button
            type="button"
            aria-label="停止生成"
            onClick={onStop}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-[13px] text-white"
          >
            ■
          </button>
        ) : onVoice ? (
          <button
            type="button"
            aria-label={listening ? "停止听写" : "开始听写"}
            onClick={onVoice}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] ${
              listening ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-2)] text-[var(--ink)]"
            }`}
          >
            {listening ? "■" : "♩"}
          </button>
        ) : (
          <button
            type="button"
            aria-label="发送"
            onClick={onSubmit}
            disabled={!value.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-[15px] text-white disabled:opacity-40"
          >
            ↑
          </button>
        )}
      </div>
      {footnote && <p className="mt-[var(--s2)] text-center text-[11px] leading-[1.5] text-[var(--muted)]">{footnote}</p>}
    </footer>
  );
}
