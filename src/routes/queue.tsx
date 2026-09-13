import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Eye, Loader2, Pencil, PlayCircle, RefreshCw, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { queueQuery, snapshotsQuery } from "@/lib/queries";
import { setQueueStatus } from "@/lib/console.functions";
import { getAutoApprove, runAutoApprove, saveAutoApprove } from "@/lib/auto-approve.functions";
import { runFeedbackLoop } from "@/lib/chameleon.functions";
import { publishNow, runPublishTick } from "@/lib/publish.functions";
import { money, compact, scoreVideoConfidence } from "@/lib/domain";
import { VideoReviewDialog } from "@/components/VideoReviewDialog";
import { QueueMetadataDialog, type QueueVideoMeta } from "@/components/QueueMetadataDialog";
import { Progress } from "@/components/ui/progress";

type QueueVideo = {
  id?: string;
  title?: string;
  hook?: string | null;
  script?: string | null;
  description?: string | null;
  thumbnail_prompt?: string | null;
  tags?: string[] | null;
  duration_target?: number | null;
  approved?: boolean;
  status?: string | null;
  render_status?: string | null;
  render_error?: string | null;
  video_url?: string | null;
  youtube_video_id?: string | null;
  blueprints?: { confidence?: number | null } | null;
};

/** Where a queued video sits on its way to YouTube, as a single progress step. */
function uploadStage(status: string, v: QueueVideo | null) {
  if (v?.youtube_video_id) return { percent: 100, label: "Live on YouTube", tone: "ok" as const };
  if (status === "failed") return { percent: 100, label: "Upload failed", tone: "bad" as const };
  if (status === "cancelled") return { percent: 0, label: "Cancelled", tone: "bad" as const };
  if (status === "publishing") return { percent: 80, label: "Uploading to YouTube…", tone: "busy" as const };
  if (v?.render_status === "failed") return { percent: 35, label: "Render failed", tone: "bad" as const };
  if (v?.video_url || v?.render_status === "done")
    return {
      percent: 60,
      label: status === "scheduled" ? "Rendered — waiting to upload" : "Rendered — needs approval",
      tone: "ok" as const,
    };
  if (v?.render_status === "rendering")
    return { percent: 30, label: "Rendering video…", tone: "busy" as const };
  return { percent: 12, label: status === "scheduled" ? "Queued for render" : "Waiting for approval", tone: "idle" as const };
}

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
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<QueueVideoMeta | null>(null);
  // Live feed: refresh while renders and uploads are in flight.
  const { data: queue, isFetching } = useQuery({ ...queueQuery, refetchInterval: 10_000 });
  const { data: snaps } = useQuery(snapshotsQuery);
  const loop = useServerFn(runFeedbackLoop);
  const publish = useServerFn(publishNow);
  const tick = useServerFn(runPublishTick);

  const readAuto = useServerFn(getAutoApprove);
  const writeAuto = useServerFn(saveAutoApprove);
  const runAuto = useServerFn(runAutoApprove);
  const { data: auto } = useQuery({
    queryKey: ["auto-approve"],
    queryFn: () => readAuto({}),
  });
  const [draftThreshold, setDraftThreshold] = useState<number | null>(null);
  const threshold = draftThreshold ?? auto?.threshold ?? 85;

  const savingAuto = useMutation({
    mutationFn: (next: { enabled: boolean; threshold: number }) => writeAuto({ data: next }),
    onSuccess: (r: { approved: number; held: number }) => {
      setDraftThreshold(null);
      qc.invalidateQueries();
      toast.success(
        r.approved > 0 ? `Auto-approved ${r.approved} video${r.approved === 1 ? "" : "s"}.` : "Auto-approval saved.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runningAuto = useMutation({
    mutationFn: () => runAuto({}),
    onSuccess: (r: { approved: number; held: number; skipped?: string }) => {
      qc.invalidateQueries();
      if (r.skipped) toast.message(`Skipped — ${r.skipped}`);
      else toast.success(`Auto-approved ${r.approved}, held ${r.held} below threshold.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });


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

  const queueStatus = useServerFn(setQueueStatus);
  const setStatus = useMutation({
    mutationFn: async ({ id, status, videoId }: { id: string; status: string; videoId?: string }) => {
      await queueStatus({ data: { id, status, videoId: videoId ?? null } });
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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Confidence auto-approval</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <div className="flex items-center gap-3">
            <Switch
              id="auto-approve"
              checked={Boolean(auto?.enabled)}
              onCheckedChange={(enabled) => savingAuto.mutate({ enabled, threshold })}
              disabled={savingAuto.isPending}
            />
            <Label htmlFor="auto-approve" className="text-sm">
              {auto?.enabled ? "On" : "Off"}
            </Label>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Auto-approve and schedule rendered videos scoring{" "}
              <span className="font-mono text-foreground">{threshold}%</span> or higher. Anything below waits
              for you — and your manual approve or cancel always overrides it.
            </p>
            <Slider
              value={[threshold]}
              min={50}
              max={100}
              step={1}
              aria-label="Auto-approval threshold"
              onValueChange={(v) => setDraftThreshold(v[0] ?? threshold)}
              onValueCommit={(v) =>
                savingAuto.mutate({ enabled: Boolean(auto?.enabled), threshold: v[0] ?? threshold })
              }
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => runningAuto.mutate()}
            disabled={runningAuto.isPending}
          >
            {runningAuto.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Check className="mr-1 size-4" />
            )}
            Run now
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Live status
            {isFetching ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              refreshes every 10s
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing in flight. Anything you approve shows its upload progress here.
            </p>
          ) : (
            <ul className="space-y-4">
              {rows.slice(0, 12).map((q) => {
                const v = q.generated_videos as QueueVideo | null;
                const c = q.channels as { name?: string } | null;
                const stage = uploadStage(q.status, v);
                return (
                  <li key={`feed-${q.id}`} className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {v?.title ?? "untitled"}
                      </p>
                      <Badge
                        variant={
                          stage.tone === "ok" || stage.tone === "busy" ? "default" : "secondary"
                        }
                      >
                        {stage.label}
                      </Badge>
                      {v?.youtube_video_id ? (
                        <a
                          className="text-xs text-primary underline"
                          href={`https://youtube.com/watch?v=${v.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          watch
                        </a>
                      ) : null}
                    </div>
                    <Progress value={stage.percent} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {c?.name} · {q.status.replace(/_/g, " ")}
                      {q.published_at ? ` · published ${new Date(q.published_at).toLocaleString()}` : ""}
                    </p>
                    {q.last_error || v?.render_error ? (
                      <p className="text-xs text-destructive">{q.last_error ?? v?.render_error}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>


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
                  const v = q.generated_videos as QueueVideo | null;
                  const c = q.channels as { name?: string } | null;
                  const live = Boolean(v?.youtube_video_id);
                  const conf = v ? scoreVideoConfidence(v, v.blueprints?.confidence ?? null) : null;
                  const score = conf?.score ?? null;
                  return (
                    <li key={q.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{v?.title ?? "untitled"}</p>
                        <p className="text-xs text-muted-foreground">
                          {c?.name} · {new Date(q.scheduled_for).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant={score !== null && score >= threshold ? "default" : "secondary"}
                        title={
                          conf
                            ? conf.factors.map((f) => `${f.label}: ${Math.round(f.score * 100)}% (${f.note})`).join("\n")
                            : "No score yet"
                        }
                      >
                        {score !== null ? `${score}% confidence` : "no score"}
                      </Badge>
                      <Badge variant={q.status === "scheduled" ? "default" : "secondary"}>
                        {q.status.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant={live ? "default" : "secondary"}>
                        {live ? "on YouTube" : "not on YouTube"}
                      </Badge>
                      {v?.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReviewId(v.id ?? null)}
                        >
                          <Eye className="mr-1 size-4" />
                          Review
                        </Button>
                      ) : null}
                      {v?.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditing({
                              id: v.id as string,
                              title: v.title ?? "",
                              description: v.description ?? "",
                              tags: v.tags ?? [],
                              locked: live,
                            })
                          }
                        >
                          <Pencil className="mr-1 size-4" />
                          Details
                        </Button>
                      ) : null}
                      {q.status === "awaiting_approval" ? (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Schedule"
                            disabled={!v?.approved}
                            title={v?.approved ? "Schedule" : "Review and approve this video first"}
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
                      {live ? (
                        <a
                          className="text-xs text-primary underline"
                          href={`https://youtube.com/watch?v=${v?.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          watch on YouTube
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
      <VideoReviewDialog
        videoId={reviewId}
        open={Boolean(reviewId)}
        onOpenChange={(o) => !o && setReviewId(null)}
      />
      <QueueMetadataDialog
        video={editing}
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </AppShell>
  );
}
