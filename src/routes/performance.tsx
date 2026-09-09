import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPerformance, refreshPerformance } from "@/lib/performance.functions";
import { compact, money } from "@/lib/domain";
import { RefreshCw, Trophy } from "lucide-react";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "Performance — views, watch time and revenue | chamele-on-air" },
      {
        name: "description",
        content:
          "Track every published video's views, watch time and estimated revenue, and see which blueprints deliver the most money per video.",
      },
      { property: "og:title", content: "Performance — chamele-on-air" },
      { property: "og:description", content: "Per-video views, watch time and revenue with a blueprint leaderboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerformancePage,
});

function hours(minutes: number) {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)} h`;
  return `${Math.round(minutes)} min`;
}

function PerformancePage() {
  const qc = useQueryClient();
  const readFn = useServerFn(getPerformance);
  const refreshFn = useServerFn(refreshPerformance);
  const [refreshing, setRefreshing] = useState(false);

  const perf = useQuery({
    queryKey: ["performance"],
    queryFn: () => readFn({ data: undefined }),
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await refreshFn({ data: undefined });
      qc.setQueryData(["performance"], res);
      if (res.sync.errors.length) toast.error(res.sync.errors[0]!);
      else toast.success(`Updated ${res.sync.updated} video${res.sync.updated === 1 ? "" : "s"} from YouTube.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not refresh stats.");
    } finally {
      setRefreshing(false);
    }
  };

  const data = perf.data;
  const videos = data?.videos ?? [];
  const ranking = data?.blueprints ?? [];
  const totals = data?.totals;

  return (
    <AppShell
      title="Performance"
      subtitle="Live YouTube views for every published video, with modelled watch time and revenue, plus which blueprint earns most."
      action={
        <Button onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 size-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Pulling stats…" : "Refresh from YouTube"}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Published videos", value: String(totals?.published ?? 0) },
          { label: "Total views", value: compact(totals?.views ?? 0) },
          { label: "Watch time", value: hours(totals?.watchTimeMinutes ?? 0) },
          { label: "Estimated revenue", value: money(totals?.estRevenue ?? 0) },
        ].map((s) => (
          <Card key={s.label} className="spectrum-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="spectrum-border mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="size-4 text-primary" /> Blueprint leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {perf.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No published videos yet — publish one and its blueprint will show up here.
            </p>
          ) : (
            <ol className="space-y-3">
              {ranking.map((b, i) => (
                <li key={b.blueprintId} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-semibold">#{i + 1}</span>
                    <span className="text-sm font-medium">{b.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {b.niche}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {b.confidence}% confidence
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>{b.videos} videos</span>
                    <span>{compact(b.views)} views</span>
                    <span>{hours(b.watchTimeMinutes)} watched</span>
                    <span className="text-foreground">{money(b.revenuePerVideo)} / video</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card className="spectrum-border mt-6">
        <CardHeader>
          <CardTitle className="text-base">Every published video</CardTitle>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing published yet.</p>
          ) : (
            <ul className="space-y-3">
              {videos.map((v) => (
                <li key={v.videoId} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-sm font-medium leading-snug">{v.title}</p>
                    {v.url && (
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline underline-offset-2"
                      >
                        watch
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {v.channelName} · {v.blueprintName ?? "no blueprint"} · {v.durationSeconds}s
                    {v.capturedAt ? ` · updated ${new Date(v.capturedAt).toLocaleString()}` : " · never measured"}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                    <span>{compact(v.views)} views</span>
                    <span>{hours(v.watchTimeMinutes)} watched</span>
                    <span>{money(v.estRevenue)} est. revenue</span>
                    <span>{compact(v.likes)} likes</span>
                    <span>{v.engagementRate}% engagement</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] text-muted-foreground">
            Views, likes and comments come straight from YouTube. Watch time and revenue are modelled from the video
            length and the niche's earnings band — YouTube keeps the real figures private until a channel is monetised.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
