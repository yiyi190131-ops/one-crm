// 行内状态条：把“思考中/流式/错误”统一成一种视觉语言。
import { Spinner } from "@/components/system/Async";

export function StatusLine({ text, tone = "info" }: { text: string; tone?: "info" | "run" | "error" }) {
  const toneClass =
    tone === "error"
      ? "text-[var(--danger)]"
      : tone === "run"
        ? "text-[var(--brand)]"
        : "text-[var(--muted)]";
  return (
    <div className={`flex items-center gap-[var(--s2)] text-[12px] ${toneClass}`}>
      {tone === "run" && <Spinner size={12} />}
      <span>{text}</span>
    </div>
  );
}
