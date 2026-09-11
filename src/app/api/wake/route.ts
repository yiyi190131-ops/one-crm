import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ATTEMPTS = 3;
const TIMEOUT_MS = 20_000;

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
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (await pingHealth()) return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 503 });
}
