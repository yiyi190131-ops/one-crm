// 每屏统一骨架：固定顶栏 + 可滚动主体 + 固定底部（composer）。
import type { ReactNode } from "react";

export function Screen({
  top,
  children,
  bottom,
  bodyClassName = "",
}: {
  top?: ReactNode;
  children: ReactNode;
  bottom?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {top}
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}>{children}</div>
      {bottom}
    </div>
  );
}
