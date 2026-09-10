"use client";
// 消息流容器：统一内边距与间距，随 scrollKey 变化自动滚动到底部。
import { useEffect, useRef, type ReactNode } from "react";

export function MessageThread({ children, scrollKey }: { children: ReactNode; scrollKey: unknown }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [scrollKey]);
  return (
    <div className="flex flex-col gap-[var(--s5)] px-[var(--s4)] py-[var(--s5)]">
      {children}
      <div ref={bottomRef} />
    </div>
  );
}
