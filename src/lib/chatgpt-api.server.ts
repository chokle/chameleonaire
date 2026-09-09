import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const API_KEY_PREFIX = "chatgpt_";
const KEY_BYTES = 32;

function encodeKey(buf: Uint8Array): string {
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${API_KEY_PREFIX}${hex}`;
}

async function hashKeySync(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(key));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const buf = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  const key = encodeKey(buf);
  const hash = await hashKeySync(key);
  const prefix = key.slice(0, 16);
  return { key, hash, prefix };
}

export async function verifyApiKey(key: string): Promise<{ userId: string; keyId: string } | null> {
  if (!key.startsWith(API_KEY_PREFIX)) return null;
  const hash = await hashKeySync(key);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("chatgpt_api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", hash)
    .single();
  if (error || !data || data.revoked_at) return null;
  await supabaseAdmin
    .from("chatgpt_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { userId: data.user_id, keyId: data.id };
}

const CreateKeyInput = z.object({
  name: z.string().trim().min(1).max(100).optional(),
});

export const createChatGptApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateKeyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { key, hash, prefix } = await generateApiKey();
    const { supabase } = context;
    const { error } = await supabase.from("chatgpt_api_keys").insert({
      user_id: context.userId,
      name: data.name ?? "ChatGPT",
      key_hash: hash,
      prefix,
    });
    if (error) throw new Error(error.message);
    return { key, prefix };
  });

export const listChatGptApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chatgpt_api_keys")
      .select("id, name, prefix, created_at, last_used_at, revoked_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

const RevokeKeyInput = z.object({ keyId: z.string().uuid() });

export const revokeChatGptApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RevokeKeyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chatgpt_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.keyId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
