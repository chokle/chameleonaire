import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { channelsQuery } from "@/lib/queries";
import { analyzeClipSource, createShortFromMoment } from "@/lib/clips.functions";
import { Plus, Scissors, Sparkles, Wand2 } from "lucide-react";

export const Route = createFileRoute("/clips")({
  head: () => ({
    meta: [
      { title: "Clip studio — long videos into shorts | chamele-on-air" },
      {
        name: "description",
        content:
          "Paste any long-form video link, mark the strongest moments, and turn each one into an original vertical short queued on your own channel.",
      },
      { property: "og:title", content: "Clip studio — chamele-on-air" },
      {
        property: "og:description",
        content: "Turn long-form videos from anywhere into original vertical shorts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClipsPage,
});

type Moment = {
  start: number;
  end: number;
  label: string;
  why: string;
  angle: string;
};

function hhmmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

function parseTimecode(value: string): number {
  const parts = value
    .trim()
    .split(":")
    .map((p) => Number(p.replace(/[^\d.]/g, "")) || 0);
  if (!parts.length) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function ClipsPage() {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeClipSource);
  const build = useServerFn(createShortFromMoment);
  const { data: channels } = useQuery(channelsQuery);

  const [url, setUrl] = useState("");
  const [source, setSource] = useState<{
    title: string;
    author: string;
    platform: string;
    durationSeconds: number;
  } | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [channelId, setChannelId] = useState("");
  const [length, setLength] = useState("45");
  const [buildingIndex, setBuildingIndex] = useState<number | null>(null);

  const patch = (i: number, next: Partial<Moment>) =>
    setMoments((list) => list.map((m, idx) => (idx === i ? { ...m, ...next } : m)));

  const scanning = useMutation({
    mutationFn: () => analyze({ data: { url, count: 5 } }),
    onSuccess: (r) => {
      setSource(r.source);
      setMoments(r.moments);
      toast.success(`Found ${r.moments.length} moments worth clipping.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const building = useMutation({
    mutationFn: (m: Moment) =>
      build({
        data: {
          channelId,
          sourceUrl: url,
          sourceTitle: source?.title ?? "",
          start: m.start,
          end: m.end,
          label: m.label,
          why: m.why,
          angle: m.angle,
          durationTarget: Number(length) || 45,
        },
      }),
    onSuccess: (r: { title: string }) => {
      qc.invalidateQueries();
      toast.success(`"${r.title}" is in the queue awaiting your approval.`);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBuildingIndex(null),
  });

  const makeShort = (m: Moment, i: number) => {
    if (!channelId) {
      toast.error("Pick a channel first.");
      return;
    }
    if (!m.label.trim()) {
      toast.error("Describe what happens in that moment.");
      return;
    }
    setBuildingIndex(i);
    building.mutate(m);
  };

  return (
    <AppShell
      title="Clip studio"
      subtitle="Paste a long video from anywhere, mark the best moments, get original shorts."
      action={
        <Button asChild variant="secondary">
          <Link to="/queue">Open queue</Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="spectrum-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scissors className="size-4 text-primary" /> Source video
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && url.trim()) scanning.mutate();
                  }}
                  placeholder="Paste any long-form video link"
                />
                <Button
                  onClick={() => scanning.mutate()}
                  disabled={!url.trim() || scanning.isPending}
                >
                  <Wand2 className="mr-1 size-4" />
                  {scanning.isPending ? "Reading…" : "Find moments"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                We read the video's public details and build your own shorts around the same
                beats. We never re-upload anyone else's footage.
              </p>
              {source ? (
                <div className="rounded-lg border border-border/70 bg-card/50 p-3 text-sm">
                  <p className="font-medium">{source.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.author} · {source.platform}
                    {source.durationSeconds
                      ? ` · ${hhmmss(source.durationSeconds)} long`
                      : ""}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {moments.length ? (
            <div className="space-y-4">
              {moments.map((m, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-3 text-base">
                      <span className="min-w-0 truncate">{m.label || "New moment"}</span>
                      <Badge variant="secondary">
                        {hhmmss(m.start)}–{hhmmss(m.end)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Start</Label>
                        <Input
                          defaultValue={hhmmss(m.start)}
                          onBlur={(e) => patch(i, { start: parseTimecode(e.target.value) })}
                          placeholder="2:15"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>End</Label>
                        <Input
                          defaultValue={hhmmss(m.end)}
                          onBlur={(e) => patch(i, { end: parseTimecode(e.target.value) })}
                          placeholder="2:55"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>What happens here</Label>
                      <Input
                        value={m.label}
                        onChange={(e) => patch(i, { label: e.target.value })}
                        placeholder="The moment the real cost gets revealed"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Angle for your short</Label>
                      <Textarea
                        rows={2}
                        value={m.angle}
                        onChange={(e) => patch(i, { angle: e.target.value })}
                        placeholder="The evergreen angle we build originally around this beat"
                      />
                    </div>
                    {m.why ? (
                      <p className="text-xs text-muted-foreground">Why it works: {m.why}</p>
                    ) : null}
                    <Button
                      className="w-full"
                      onClick={() => makeShort(m, i)}
                      disabled={building.isPending}
                    >
                      <Sparkles className="mr-1 size-4" />
                      {buildingIndex === i ? "Writing short…" : "Make this a short"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          <Button
            variant="secondary"
            className="w-full"
            onClick={() =>
              setMoments((list) => [
                ...list,
                { start: 0, end: 45, label: "", why: "", angle: "" },
              ])
            }
          >
            <Plus className="mr-1 size-4" /> Add my own timecode
          </Button>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Where it lands</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a channel" />
                </SelectTrigger>
                <SelectContent>
                  {(channels ?? []).map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Short length</Label>
              <Select value={length} onValueChange={setLength}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="45">45 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Each short is written on your brand and lands in the queue awaiting your approval.
              Approve it and it publishes to that channel's YouTube.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
