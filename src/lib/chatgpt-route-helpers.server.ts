import { verifyApiKey } from "./chatgpt-api.server";
import { assertIsMember } from "./chatgpt-actions.server";

export async function authenticateRequest(request: Request): Promise<{ userId: string; keyId: string } | Response> {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "Missing or invalid Authorization header. Use 'Authorization: Bearer <key>'." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const key = auth.slice(7).trim();
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing API key." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const verified = await verifyApiKey(key);
  if (!verified) {
    return new Response(JSON.stringify({ error: "Invalid or revoked API key." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const isMember = await assertIsMember(verified.userId);
  if (!isMember) {
    return new Response(JSON.stringify({ error: "Account is not an approved member." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return verified;
}

export function jsonResponse(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function parseQueryInt(value: string | null, fallback: number, min: number, max: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function parseQueryFloat(value: string | null, fallback?: number): number | undefined {
  if (!value) return fallback;
  const n = parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
}
