import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, PlayCircle, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queueQuery, snapshotsQuery } from "@/lib/queries";
import { setQueueStatus } from "@/lib/console.functions";
import { runFeedbackLoop } from "@/lib/chameleon.functions";
import { publishNow, runPublishTick } from "@/lib/publish.functions";
import { money, compact } from "@/lib/domain";

export const Route = createFileRoute("/queue")({
  head: () => ({
    meta: [
      { title: "Publish queue — chamele-on-air" },
      {
        name: "description",
        content: "Approve, schedule and score every chameleonized video, and feed the results back into the loop.",
      },
      { property: "og:title", content: "Publish queue" },
      { property: "og:description", content: "What goes out next, and what came back." },
    ],
  }),
  component: Queue,
});

function Queue() {
  const qc = useQueryClient();
  const { data: queue } = useQuery(queueQuery);
  const { data: snaps } = useQuery(snapshotsQuery);
  const loop = useServerFn(runFeedbackLoop);
  const publish = useServerFn(publishNow);
  const tick = useServerFn(runPublishTick);

  const publishing = useMutation({
    mutationFn: (queueId: string) => publish({ data: { queueId } }),
    onSuccess: (r: { url: string }) => {
      qc.invalidateQueries();
      toast.success(`Published: ${r.url}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ticking = useMutation({
    mutationFn: () => tick({}),
    onSuccess: (r: { published: number; failed: number; skipped?: string; paused?: string }) => {
      qc.invalidateQueries();
      if (r.skipped) toast.message(`Worker skipped — ${r.skipped}`);
      else if (r.paused) toast.error(`Publishing paused: ${r.paused}`);
      else toast.success(`Published ${r.published}, failed ${r.failed}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status, videoId }: { id: string; status: string; videoId?: string }) => {
      const { error } = await supabase.from("publish_queue").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
      if (videoId) {
        await supabase
          .from("generated_videos")
          .update({ approved: status === "scheduled" })
          .eq("id", videoId);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["queue"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const adapting = useMutation({
    mutationFn: () => loop({ data: { channelId: null } }),
    onSuccess: (r: { blueprintsScored: number; snapshots: number }) => {
      qc.invalidateQueries();
      toast.success(`Scored ${r.blueprintsScored} blueprints across ${r.snapshots} snapshots.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = queue ?? [];

  return (
    <AppShell
      title="Publish queue"
      subtitle="Everything scheduled to go out, plus the performance feeding back into blueprint scoring."
      action={
        <div className="flex gap-2">
        <Button variant="secondary" onClick={() => ticking.mutate()} disabled={ticking.isPending}>
          {ticking.isPending ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <PlayCircle className="mr-1 size-4" />
          )}
          Run publish worker
        </Button>
        <Button variant="secondary" onClick={() => adapting.mutate()} disabled={adapting.isPending}>
          {adapting.isPending ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 size-4" />
          )}
          Run adaptation pass
        </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Scheduled ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Nothing queued. Generate videos on a channel and they land here on its cadence.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {rows.map((q) => {
                  const v = q.generated_videos as
                    | { id?: string; title?: string; approved?: boolean; video_url?: string | null; youtube_video_id?: string | null }
                    | null;
                  const c = q.channels as { name?: string } | null;
                  return (
                    <li key={q.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{v?.title ?? "untitled"}</p>
                        <p className="text-xs text-muted-foreground">
                          {c?.name} · {new Date(q.scheduled_for).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={q.status === "scheduled" ? "default" : "secondary"}>
                        {q.status.replace(/_/g, " ")}
                      </Badge>
                      {q.status === "awaiting_approval" ? (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Approve"
                            onClick={() =>
                              setStatus.mutate({ id: q.id, status: "scheduled", ...(v?.id ? { videoId: v.id } : {}) })
                            }
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Cancel"
                            onClick={() => setStatus.mutate({ id: q.id, status: "cancelled" })}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                      {q.status === "scheduled" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => publishing.mutate(q.id)}
                          disabled={publishing.isPending}
                        >
                          {publishing.isPending ? (
                            <Loader2 className="mr-1 size-4 animate-spin" />
                          ) : (
                            <Upload className="mr-1 size-4" />
                          )}
                          Publish now
                        </Button>
                      ) : null}
                      {v?.youtube_video_id ? (
                        <a
                          className="text-xs text-primary underline"
                          href={`https://youtube.com/watch?v=${v.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          view
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Feedback signal</CardTitle>
          </CardHeader>
          <CardContent>
            {(snaps ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No performance recorded yet. Once videos are live, snapshots score each blueprint and nudge
                channel divergence toward whatever is working.
              </p>
            ) : (
              <ul className="space-y-3">
                {(snaps ?? []).slice(0, 12).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {new Date(s.captured_at).toLocaleDateString()} · {compact(s.views)} views
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-primary">{money(s.est_revenue)}</span>
                      <Badge variant={s.outcome === "win" ? "default" : "secondary"}>{s.outcome}</Badge>
                    </span>
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
