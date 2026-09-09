import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChatGptApiKey, listChatGptApiKeys, revokeChatGptApiKey } from "@/lib/chatgpt-api.server";

export const Route = createFileRoute("/integrations/chatgpt")({
  head: () => ({
    meta: [
      { title: "ChatGPT Integration — chamele-on-air" },
      { name: "description", content: "Connect Chameleonaire to a ChatGPT Custom GPT via API key." },
      { property: "og:title", content: "ChatGPT Integration — chamele-on-air" },
      { property: "og:description", content: "Connect Chameleonaire to a ChatGPT Custom GPT via API key." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatGptIntegrationPage,
});

type KeyRow = {
  id: string;
  name: string | null;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function ChatGptIntegrationPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await listChatGptApiKeys();
      setKeys(res.items as KeyRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      const res = await createChatGptApiKey({ data: { name: newKeyName || undefined } });
      setFreshKey(res.key);
      setNewKeyName("");
      await load();
      toast.success("API key created. Copy it now — it won't be shown again.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create key");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await revokeChatGptApiKey({ data: { keyId: id } });
      await load();
      toast.success("Key revoked.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke key");
    }
  };

  return (
    <AppShell
      title="ChatGPT Integration"
      subtitle="Give a Custom GPT read-only access to your scans, creators, blueprints, channels, and earnings estimates."
    >
      <div className="grid max-w-3xl gap-6">
        <Card className="spectrum-border">
          <CardHeader>
            <CardTitle className="text-lg">Setup instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-1 pl-4">
              <li>Create an API key below.</li>
              <li>In ChatGPT, go to Configure → Add actions.</li>
              <li>Set Schema URL to: <code className="rounded bg-secondary px-1 py-0.5 text-foreground">https://chameleonaire.lovable.app/api/public/chatgpt/openapi.json</code></li>
              <li>Set Authentication type to API key, header name <code className="rounded bg-secondary px-1 py-0.5 text-foreground">Authorization</code>, value <code className="rounded bg-secondary px-1 py-0.5 text-foreground">Bearer &lt;your_key&gt;</code>.</li>
              <li>Privacy policy: <code className="rounded bg-secondary px-1 py-0.5 text-foreground">https://chameleonaire.me/privacy</code></li>
            </ol>
          </CardContent>
        </Card>

        <Card className="spectrum-border">
          <CardHeader>
            <CardTitle className="text-lg">Create API key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Label (optional)</Label>
              <Input
                id="key-name"
                placeholder="e.g. My Custom GPT"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <Button onClick={create} disabled={creating}>
              {creating ? "Creating…" : "Create API key"}
            </Button>
            {freshKey && (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                <p className="text-xs font-medium text-primary">Copy this key now — it won't be shown again.</p>
                <code className="mt-1 block break-all text-sm text-foreground">{freshKey}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-auto px-2 py-1 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(freshKey);
                    toast.success("Copied to clipboard");
                  }}
                >
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-auto px-2 py-1 text-xs"
                  onClick={() => setFreshKey(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="spectrum-border">
          <CardHeader>
            <CardTitle className="text-lg">Your keys</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No API keys yet.</p>
            ) : (
              <ul className="space-y-3">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{k.name ?? "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground">
                        {k.prefix}… • created {new Date(k.created_at).toLocaleDateString()}
                        {k.revoked_at ? " • revoked" : k.last_used_at ? " • last used recently" : ""}
                      </p>
                    </div>
                    {!k.revoked_at && (
                      <Button size="sm" variant="destructive" onClick={() => revoke(k.id)}>
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
