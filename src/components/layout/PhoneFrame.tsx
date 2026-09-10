// 唯一定义“手机壳”：桌面居中卡片，手机端铺满。尺寸来自 token。
import type { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[100svh] place-items-center bg-neutral-100 p-6 max-[520px]:p-0">
      <div className="relative flex h-[var(--phone-h)] w-[var(--phone-w)] flex-col overflow-hidden bg-[var(--surface)] shadow-[var(--shadow-phone)] max-[520px]:h-[100svh] max-[520px]:w-full max-[520px]:shadow-none">
        {children}
      </div>
    </div>
  );
}
