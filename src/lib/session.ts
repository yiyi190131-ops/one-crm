// A per-browser demo identity, not production authentication.
export function demoUserId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem("crm-demo-visitor");
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem("crm-demo-visitor", id);
    window.localStorage.removeItem("crm-agent-conversation");
  }
  return id;
}
