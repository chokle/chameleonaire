const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export class AIGatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AIGatewayError";
  }
}

type CallOptions = {
  system: string;
  prompt: string;
  model?: string;
  json?: boolean;
};

/**
 * Single entry point for every Lovable AI call in the app.
 * Streams the response so long generations are never severed mid-flight.
 */
export async function callAI({
  system,
  prompt,
  model = "google/gemini-3.7-flash",
  json = true,
}: CallOptions): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AIGatewayError(401, "AI is not configured for this project.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      message = JSON.parse(text)?.error?.message ?? text;
    } catch {
      /* keep raw text */
    }
    if (res.status === 429) {
      throw new AIGatewayError(429, "The engine is rate limited right now. Try again shortly.");
    }
    if (res.status === 402) {
      throw new AIGatewayError(
        402,
        message || "AI credits are exhausted. Add credits to keep the engine running.",
      );
    }
    throw new AIGatewayError(res.status, message || `AI request failed (${res.status}).`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof delta === "string") out += delta;
      } catch {
        /* partial chunk */
      }
    }
  }

  return out;
}

/** Parses model output that should be JSON, tolerating code fences. */
export function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.search(/[[{]/);
  const candidate = start > 0 ? cleaned.slice(start) : cleaned;
  return JSON.parse(candidate) as T;
}
