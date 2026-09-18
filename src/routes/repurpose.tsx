import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Recycle, Wand2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { blueprintsQuery, channelsQuery } from "@/lib/queries";
import {
  blueprintFigures,
  queueRewrittenShort,
  rewriteOwnContent,
} from "@/lib/repurpose.functions";

export const Route = createFileRoute("/repurpose")({
  head: () => ({
    meta: [
      { title: "Repurpose your own shorts — chamele-on-air" },
      {
        name: "description",
        content:
          "Paste a script, caption or transcript you already made and turn it into a tighter original short with a cold open that matches your channel's figures.",
      },
      { property: "og:title", content: "Repurpose your own shorts" },
      {
        property: "og:description",
        content: "Your own content, rewritten into a queued short with a stronger cold open.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RepurposePage,
});

type Short = {
  title: string;
  hook: string;
  alternates: string[];
  script: string;
  description: string;
  tags: string[];
  thumbnail_prompt: string;
  concept: string;
  duration_target: number;
};

function RepurposePage() {
  const qc = useQueryClient();
  const rewrite = useServerFn(rewriteOwnContent);
  const queueIt = useServerFn(queueRewrittenShort);
  const readFigures = useServerFn(blueprintFigures);

  const { data: channels } = useQuery(channelsQuery);
  const { data: blueprints } = useQuery(blueprintsQuery);

  const [source, setSource] = useState("");
  const [channelId, setChannelId] = useState("");
  const [blueprintId, setBlueprintId] = useState("");
  const [duration, setDuration] = useState(45);
  const [short, setShort] = useState<Short | null>(null);
  const [claims, setClaims] = useState<string[]>([]);
  const [tagText, setTagText] = useState("");

  // Default the blueprint to whatever the chosen channel already runs on.
  useEffect(() => {
    if (!channelId || blueprintId) return;
    const c = (channels ?? []).find((ch) => ch.id === channelId) as
      | { blueprint_id?: string | null }
      | undefined;
    if (c?.blueprint_id) setBlueprintId(c.blueprint_id);
  }, [channelId, blueprintId, channels]);

  const figuresQuery = useQuery({
    queryKey: ["blueprint-figures", blueprintId || "none"],
    queryFn: () => readFigures({ data: { blueprintId: blueprintId || null } }),
    enabled: Boolean(blueprintId),
  });
  const shownClaims = claims.length ? claims : (figuresQuery.data?.claims ?? []);

  const writing = useMutation({
    mutationFn: () =>
      rewrite({
        data: {
          source,
          channelId: channelId || null,
          blueprintId: blueprintId || null,
          durationTarget: duration,
        },
      }),
    onSuccess: (r: { short: Short; figures: string[] }) => {
      setShort(r.short);
      setClaims(r.figures ?? []);
      setTagText((r.short.tags ?? []).join(", "));
      toast.success("Rewritten — edit anything, then add it to the queue.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const queuing = useMutation({
    mutationFn: () => {
      if (!short) throw new Error("Rewrite the content first.");
      if (!channelId) throw new Error("Pick a channel.");
      return queueIt({
        data: {
          channelId,
          title: short.title,
          hook: short.hook,
          script: short.script,
          description: short.description,
          tags: tagText
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 15),
          thumbnailPrompt: short.thumbnail_prompt,
          concept: short.concept,
          durationTarget: duration,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Added to the queue — approve it to publish.");
      setShort(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = (p: Partial<Short>) => setShort((s) => (s ? { ...s, ...p } : s));

  return (
    <AppShell
      title="Repurpose"
      subtitle="Paste something you already made and turn it into a stronger short."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Your content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rp-source">Script, caption, transcript or notes</Label>
              <Textarea
                id="rp-source"
                rows={10}
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Paste your own short's script, caption or voiceover transcript here."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {(channels ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Blueprint</Label>
                <Select value={blueprintId} onValueChange={setBlueprintId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {(blueprints ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-len">Length (seconds)</Label>
                <Input
                  id="rp-len"
                  type="number"
                  min={15}
                  max={120}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 45)}
                />
              </div>
            </div>

            {shownClaims.length ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Numbers the script will use, taken from this blueprint:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {shownClaims.map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <Button
              onClick={() => writing.mutate()}
              disabled={writing.isPending || source.trim().length < 30}
            >
              {writing.isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Wand2 className="mr-1 size-4" />
              )}
              Rewrite as a short
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>It's your material, so the substance stays — the structure gets tightened.</p>
            <p>
              The cold open states the same figures your blueprint claims, so the video matches the
              channel.
            </p>
            <p>Queued shorts wait for your approval; approving one publishes it to YouTube.</p>
          </CardContent>
        </Card>

        {short ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Recycle className="size-4" /> Your short
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rp-title">Title</Label>
                <Input
                  id="rp-title"
                  value={short.title}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rp-hook">Cold open (first 8 seconds)</Label>
                <Textarea
                  id="rp-hook"
                  rows={2}
                  value={short.hook}
                  onChange={(e) => patch({ hook: e.target.value })}
                />
                {short.alternates.length ? (
                  <div className="space-y-1 pt-1">
                    <p className="text-xs text-muted-foreground">Other options — tap to use:</p>
                    {short.alternates.map((alt) => (
                      <button
                        key={alt}
                        type="button"
                        className="block w-full rounded-md border border-border/70 px-2 py-1.5 text-left text-xs hover:bg-muted"
                        onClick={() => patch({ hook: alt })}
                      >
                        {alt}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rp-script">Script</Label>
                <Textarea
                  id="rp-script"
                  rows={10}
                  value={short.script}
                  onChange={(e) => patch({ script: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rp-desc">Description</Label>
                  <Textarea
                    id="rp-desc"
                    rows={4}
                    value={short.description}
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp-tags">Tags (comma separated)</Label>
                  <Textarea
                    id="rp-tags"
                    rows={4}
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={() => queuing.mutate()} disabled={queuing.isPending || !channelId}>
                {queuing.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Add to queue
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
