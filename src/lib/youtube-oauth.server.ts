/** Google OAuth for YouTube uploads. Server-only. */

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const YOUTUBE_CALLBACK_URL =
  "https://chameleonaire.lovable.app/api/public/youtube/callback";

export const YT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export function oauthCreds(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function callbackUrl(): string {
  return YOUTUBE_CALLBACK_URL;
}

/** Builds the Google consent URL for a spawned channel and stores the CSRF state. */
export async function buildConsentUrl(channelId: string): Promise<string> {
  const creds = oauthCreds();
  if (!creds) {
    throw new Error(
      "YouTube publishing is not configured yet — add your Google OAuth client id and secret first.",
    );
  }
  const db = await admin();
  const state = crypto.randomUUID().replace(/-/g, "");
  // OAuth providers require an exact callback match. Always use the registered,
  // stable production callback even when the flow starts on preview/custom domains.
  const redirect = callbackUrl();

  const { error } = await db
    .from("oauth_states")
    .insert({ state, channel_id: channelId, redirect_uri: redirect });
  if (error) throw new Error(error.message);

  const qs = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: YT_SCOPES,
    access_type: "offline",
    // Force account selection so a restricted Workspace account can be swapped
    // for the Google account that owns the intended YouTube channel.
    prompt: "select_account consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${qs.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? `Google token error (${res.status})`);
  }
  return json;
}

/** Handles the OAuth redirect: swaps the code for tokens and links the YouTube channel. */
export async function completeConsent(code: string, state: string): Promise<{ channelId: string; title: string }> {
  const creds = oauthCreds();
  if (!creds) throw new Error("YouTube OAuth is not configured.");
  const db = await admin();

  const { data: row } = await db.from("oauth_states").select("*").eq("state", state).maybeSingle();
  if (!row) throw new Error("This connect link has expired. Start the connection again.");
  await db.from("oauth_states").delete().eq("state", state);

  const tokens = await tokenRequest({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: row.redirect_uri,
    grant_type: "authorization_code",
  });
  if (!tokens.access_token) throw new Error("Google did not return an access token.");

  const meRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const me = (await meRes.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string } }>;
  };
  const ytId = me.items?.[0]?.id ?? null;
  const ytTitle = me.items?.[0]?.snippet?.title ?? "Connected channel";

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3500) * 1000).toISOString();

  await db.from("youtube_accounts").upsert(
    {
      channel_id: row.channel_id,
      youtube_channel_id: ytId,
      youtube_title: ytTitle,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAt,
      scopes: tokens.scope ?? YT_SCOPES,
    },
    { onConflict: "channel_id" },
  );

  await db
    .from("channels")
    .update({ connected: true, youtube_channel_id: ytId, youtube_title: ytTitle })
    .eq("id", row.channel_id);

  return { channelId: row.channel_id, title: ytTitle };
}

/** Returns a valid access token for a spawned channel, refreshing when needed. */
export async function accessTokenFor(channelId: string): Promise<string> {
  const creds = oauthCreds();
  if (!creds) throw new Error("YouTube OAuth is not configured.");
  const db = await admin();

  const { data: acct } = await db
    .from("youtube_accounts")
    .select("*")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (!acct) throw new Error("This channel is not connected to YouTube yet.");

  const fresh = acct.expires_at ? new Date(acct.expires_at).getTime() - 60_000 > Date.now() : false;
  if (fresh && acct.access_token) return acct.access_token;

  if (!acct.refresh_token) {
    throw new Error("The YouTube connection expired. Reconnect this channel.");
  }
  const tokens = await tokenRequest({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: acct.refresh_token,
    grant_type: "refresh_token",
  });
  if (!tokens.access_token) throw new Error("Could not refresh the YouTube connection.");

  await db
    .from("youtube_accounts")
    .update({
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + (tokens.expires_in ?? 3500) * 1000).toISOString(),
    })
    .eq("channel_id", channelId);

  return tokens.access_token;
}

export async function disconnect(channelId: string): Promise<void> {
  const db = await admin();
  await db.from("youtube_accounts").delete().eq("channel_id", channelId);
  await db
    .from("channels")
    .update({ connected: false, youtube_channel_id: null, youtube_title: null })
    .eq("id", channelId);
}
