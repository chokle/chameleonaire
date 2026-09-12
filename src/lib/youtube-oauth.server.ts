/** Google OAuth for YouTube uploads. Server-only. */

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const YOUTUBE_CALLBACK_URL =
  "https://chameleonaire.lovable.app/api/public/youtube/callback";

export const YT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

export type YouTubeChannelOption = {
  id: string;
  title: string;
  thumbnail: string | undefined;
};

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

async function fetchYouTubeChannels(
  accessToken: string,
): Promise<Array<{ id?: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }>> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(json.error?.message ?? `YouTube rejected the channel lookup (${res.status}).`);
  }
  const data = (await res.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }>;
  };
  return data.items ?? [];
}

export type PendingOAuthState = {
  channelId: string;
  channels: YouTubeChannelOption[];
  accessToken: string;
  refreshToken: string | undefined;
  expiresAt: string;
  scopes: string;
};

/** Returns the temporary payload stored during a multi-channel OAuth flow. */
export async function getPendingOAuthState(
  state: string,
): Promise<PendingOAuthState | null> {
  const db = await admin();
  const { data: row } = await db
    .from("oauth_states")
    .select("channel_id, payload")
    .eq("state", state)
    .maybeSingle();
  if (!row?.payload) return null;
  const payload = row.payload as {
    channels?: YouTubeChannelOption[];
    access_token?: string;
    refresh_token?: string | undefined;
    expires_at?: string;
    scopes?: string;
  };
  return {
    channelId: row.channel_id,
    channels: payload.channels ?? [],
    accessToken: payload.access_token ?? "",
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at ?? new Date(Date.now() + 3500 * 1000).toISOString(),
    scopes: payload.scopes ?? YT_SCOPES,
  };
}

async function saveChannelToApp(
  channelId: string,
  ytId: string,
  ytTitle: string,
  tokens: {
    access_token: string;
    refresh_token: string | undefined;
    expires_at: string;
    scopes: string;
  },
): Promise<void> {
  const db = await admin();

  // Prevent the same YouTube channel from being linked to two different app channels
  // under the same owner.
  const { data: targetChannel } = await db
    .from("channels")
    .select("owner_id")
    .eq("id", channelId)
    .maybeSingle();
  if (targetChannel) {
    const { data: duplicate } = await db
      .from("channels")
      .select("id, name")
      .eq("youtube_channel_id", ytId)
      .eq("owner_id", targetChannel.owner_id)
      .neq("id", channelId)
      .maybeSingle();
    if (duplicate) {
      throw new Error(
        `This YouTube channel is already connected to "${duplicate.name}". Disconnect it there first, or pick a different YouTube channel.`,
      );
    }
  }

  await db.from("youtube_accounts").upsert(
    {
      channel_id: channelId,
      youtube_channel_id: ytId,
      youtube_title: ytTitle,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expires_at,
      scopes: tokens.scopes,
    },
    { onConflict: "channel_id" },
  );

  await db
    .from("channels")
    .update({ connected: true, youtube_channel_id: ytId, youtube_title: ytTitle })
    .eq("id", channelId);
}

/** Handles the OAuth redirect: swaps the code for tokens and links the YouTube channel. */
export async function completeConsent(
  code: string,
  state: string,
): Promise<
  | { channelId: string; title: string }
  | { picker: true; state: string; channels: YouTubeChannelOption[] }
> {
  const creds = oauthCreds();
  if (!creds) throw new Error("YouTube OAuth is not configured.");
  const db = await admin();

  const { data: row } = await db.from("oauth_states").select("*").eq("state", state).maybeSingle();
  if (!row) throw new Error("This connect link has expired. Start the connection again.");

  const tokens = await tokenRequest({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: row.redirect_uri,
    grant_type: "authorization_code",
  });
  if (!tokens.access_token) throw new Error("Google did not return an access token.");

  const ytChannels = await fetchYouTubeChannels(tokens.access_token);
  if (ytChannels.length === 0) {
    throw new Error("This Google account has no YouTube channel. Create one in YouTube first.");
  }

  const options: YouTubeChannelOption[] = ytChannels.map((c) => ({
    id: c.id ?? "",
    title: c.snippet?.title ?? "Unknown channel",
    thumbnail: c.snippet?.thumbnails?.default?.url,
  }));

  // Single channel: complete immediately, preserving old behavior.
  if (ytChannels.length === 1) {
    await db.from("oauth_states").delete().eq("state", state);
    const ytId = options[0].id;
    const ytTitle = options[0].title;
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3500) * 1000).toISOString();
    await saveChannelToApp(row.channel_id, ytId, ytTitle, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scopes: tokens.scope ?? YT_SCOPES,
    });
    return { channelId: row.channel_id, title: ytTitle };
  }

  // Multiple channels: store tokens and options, ask the user to pick.
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3500) * 1000).toISOString();
  const payload = {
    channels: options,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    scopes: tokens.scope ?? YT_SCOPES,
  };
  await db.from("oauth_states").update({ payload }).eq("state", state);
  return { picker: true, state, channels: options };
}

/** Finalizes the connection after the user picks a YouTube channel from the picker. */
export async function finalizeChannelPick(
  state: string,
  youtubeChannelId: string,
  userId?: string,
): Promise<{ channelId: string; title: string }> {
  const db = await admin();
  const { data: row } = await db
    .from("oauth_states")
    .select("channel_id, payload")
    .eq("state", state)
    .maybeSingle();
  if (!row?.payload) throw new Error("This pick link has expired. Start the connection again.");

  const payload = row.payload as {
    channels?: YouTubeChannelOption[];
    access_token?: string;
    refresh_token?: string | undefined;
    expires_at?: string;
    scopes?: string;
  };
  const option = payload.channels?.find((c) => c.id === youtubeChannelId);
  if (!option) throw new Error("Selected YouTube channel is no longer available.");

  if (userId) {
    const { data: owned } = await db
      .from("channels")
      .select("id")
      .eq("id", row.channel_id)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!owned) throw new Error("Channel not found or not owned by you.");
  }

  await saveChannelToApp(row.channel_id, option.id, option.title, {
    access_token: payload.access_token ?? "",
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at ?? new Date(Date.now() + 3500 * 1000).toISOString(),
    scopes: payload.scopes ?? YT_SCOPES,
  });
  await db.from("oauth_states").delete().eq("state", state);

  return { channelId: row.channel_id, title: option.title };
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

export async function disconnect(channelId: string, userId?: string): Promise<void> {
  const db = await admin();
  if (userId) {
    const { data: owned } = await db
      .from("channels")
      .select("id")
      .eq("id", channelId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!owned) throw new Error("Channel not found or not owned by you.");
  }
  await db.from("youtube_accounts").delete().eq("channel_id", channelId);
  // A channel without a YouTube link cannot publish, so it stops being "active".
  await db
    .from("channels")
    .update({
      connected: false,
      youtube_channel_id: null,
      youtube_title: null,
      status: "draft",
    })
    .eq("id", channelId);
}
