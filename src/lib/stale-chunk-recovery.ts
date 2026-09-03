// When a new version is deployed, old hashed chunks disappear from the CDN.
// A client still running the previous build then fails to lazy-load a route
// ("Failed to fetch dynamically imported module") and shows a blank screen.
// Recover by reloading once (guarded so we never loop).

const KEY = "chunk-reload-at";
const COOLDOWN_MS = 30_000;

function isStaleChunkError(message: string) {
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable: fall through to a single reload attempt
  }
  window.location.reload();
}

export function installStaleChunkRecovery() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    if (isStaleChunkError(event.message ?? "")) reloadOnce();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
    if (isStaleChunkError(message)) reloadOnce();
  });
}
