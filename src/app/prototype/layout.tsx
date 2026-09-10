import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OneCRM · Figma 原型",
  description: "访前准备、电子手卡与访后记录的 1:1 可交互原型。",
};

export default function PrototypeLayout({ children }: LayoutProps<"/prototype">) {
  return children;
}
