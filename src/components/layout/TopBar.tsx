// 通用顶栏：左槽 / 标题(+副标题) / 右槽，高度来自 token。
import type { ReactNode } from "react";

export function TopBar({
  left,
  title,
  subtitle,
  right,
}: {
  left?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="flex h-[var(--topbar-h)] shrink-0 items-center gap-[var(--s2)] border-b border-[var(--line)] bg-[var(--surface)] px-[var(--s3)]">
      <div className="flex min-w-[44px] items-center justify-start">{left}</div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
        {title && <div className="truncate text-[15px] font-semibold text-[var(--ink)]">{title}</div>}
        {subtitle && <div className="truncate text-[11px] text-[var(--muted)]">{subtitle}</div>}
      </div>
      <div className="flex min-w-[44px] items-center justify-end">{right}</div>
    </header>
  );
}
