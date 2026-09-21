import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Render 冷启动常超过 20s；中途 abort 会打断正在唤醒的那次连接。 */
const TIMEOUT_MS = 55_000;

async function pingHealth(): Promise<boolean> {
  const backend = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${backend}/health`, { cache: "no-store", signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  if (await pingHealth()) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false }, { status: 503 });
}
