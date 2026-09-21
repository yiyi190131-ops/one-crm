import type { Metadata } from "next";
import "../styles/tokens.css";
import "@/styles/prototype.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumen Field · 医药代表 CRM Agent",
  description: "用于演示可信知识问答、拜访支持与受控业务写回的全栈 CRM Agent。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
