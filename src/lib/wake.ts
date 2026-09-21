let inflight: Promise<boolean> | null = null;
let lastOkAt = 0;

/** 复用同一次唤醒，避免首页并行请求把休眠后端打成排队。 */
export function wakeBackend(): Promise<boolean> {
  if (lastOkAt && Date.now() - lastOkAt < 60_000) return Promise.resolve(true);
  if (!inflight) {
    inflight = fetch("/api/wake", { cache: "no-store" })
      .then((res) => {
        const ok = res.ok;
        if (ok) lastOkAt = Date.now();
        return ok;
      })
      .catch(() => false)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function timedFetch(url: string, init: RequestInit = {}, ms = 5000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}
