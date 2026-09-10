// 消息气泡：用户右侧实色，助手左侧留白（附内容槽用于证据/来源/动作）。
import type { ReactNode } from "react";

export function Bubble({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-[var(--r-lg)] rounded-br-[var(--r-sm)] bg-[var(--brand)] px-[var(--s4)] py-[var(--s3)] text-[14px] leading-[1.55] text-white">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] text-[14px] leading-[1.6] text-[var(--ink)]">{children}</div>
    </div>
  );
}
