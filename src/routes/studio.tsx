import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { VideoReviewDialog } from "@/components/VideoReviewDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { allVideosQuery, queueQuery } from "@/lib/queries";
import { getNextActions } from "@/lib/autopilot.functions";
import { useActionRunner } from "@/lib/useActionRunner";
import { setVideoApproval } from "@/lib/console.functions";
import { publishNow } from "@/lib/publish.functions";
import { scheduleVideo } from "@/lib/autopilot.functions";
import type { ActionCard } from "@/lib/recommendations";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAutoSchedule, saveAutoSchedule } from "@/lib/auto-schedule.functions";
import { CalendarClock, GripVertical, PenLine, Play, Scissors, Sparkles } from "lucide-react";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio — drag videos live | chamele-on-air" },
      {
        name: "description",
        content:
          "Drag AI suggestions into the do-it lane and drag videos from draft to published. One board for approving, scheduling and publishing.",
      },
      { property: "og:title", content: "Studio — chamele-on-air" },
      { property: "og:description", content: "Drag-and-drop board for approving, scheduling and publishing videos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioPage,
});

const COLUMNS = [
  { id: "draft", label: "Draft", hint: "written, not approved" },
  { id: "approved", label: "Approved", hint: "cleared by you" },
  { id: "scheduled", label: "Scheduled", hint: "in the publish queue" },
  { id: "published", label: "Published", hint: "live on YouTube" },
] as const;

type ColumnId = (typeof COLUMNS)[number]["id"];

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-border/70 bg-card/60 p-3 ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function DropZone({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border transition-colors ${isOver ? "border-primary bg-primary/10" : "border-border/70 bg-card/20"} ${className}`}
    >
      {children}
    </div>
  );
}

function AutoScheduleCard() {
  const qc = useQueryClient();
  const readFn = useServerFn(getAutoSchedule);
  const saveFn = useServerFn(saveAutoSchedule);
  const [saving, setSaving] = useState(false);

  const settings = useQuery({
    queryKey: ["auto-schedule"],
    queryFn: () => readFn({ data: undefined }),
  });

  const current = settings.data ?? { enabled: false, perWeek: 3, hourUtc: 15 };

  const save = async (next: { enabled: boolean; perWeek: number; hourUtc: number }) => {
    setSaving(true);
    try {
      const res = await saveFn({ data: next });
      if (!next.enabled) toast.success("Auto-schedule off — you schedule videos yourself.");
      else if (res.scheduled > 0)
        toast.success(
          `Auto-schedule on — queued ${res.scheduled} video${res.scheduled === 1 ? "" : "s"}, first on ${new Date(res.nextSlot!).toLocaleString()}.`,
        );
      else toast.success("Auto-schedule on — approved videos will be queued automatically.");
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="spectrum-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-primary" /> Auto-schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="auto-schedule" className="text-sm">
              Publish on a regular rhythm
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Every approved, finished video is queued on the next free slot and uploaded automatically (private).
            </p>
          </div>
          <Switch
            id="auto-schedule"
            checked={current.enabled}
            disabled={settings.isLoading || saving}
            onCheckedChange={(enabled) => save({ ...current, enabled })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">How often</Label>
            <Select
              value={String(current.perWeek)}
              disabled={saving}
              onValueChange={(v) => save({ ...current, perWeek: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Once a week</SelectItem>
                <SelectItem value="2">Twice a week</SelectItem>
                <SelectItem value="3">3 a week</SelectItem>
                <SelectItem value="5">5 a week</SelectItem>
                <SelectItem value="7">Every day</SelectItem>
                <SelectItem value="14">Twice a day</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Time of day (UTC)</Label>
            <Select
              value={String(current.hourUtc)}
              disabled={saving || current.perWeek > 7}
              onValueChange={(v) => save({ ...current, hourUtc: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StudioPage() {
  const qc = useQueryClient();
  const nextActionsFn = useServerFn(getNextActions);
  const approveFn = useServerFn(setVideoApproval);
  const scheduleFn = useServerFn(scheduleVideo);
  const publishFn = useServerFn(publishNow);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const actions = useQuery({
    queryKey: ["next-actions"],
    queryFn: () => nextActionsFn({ data: undefined }),
  });
  const videos = useQuery(allVideosQuery);
  const queue = useQuery(queueQuery);

  const { run, running } = useActionRunner(() => {
    qc.invalidateQueries({ queryKey: ["next-actions"] });
  });

  const cards = (actions.data?.actions ?? []) as ActionCard[];
  const rows = videos.data ?? [];
  const queueRows = queue.data ?? [];

  const columnOf = (v: (typeof rows)[number]): ColumnId => {
    if (v.youtube_video_id) return "published";
    const q = queueRows.find((q) => q.generated_video_id === v.id);
    if (q && (q.status === "scheduled" || q.status === "publishing")) return "scheduled";
    if (v.approved) return "approved";
    return "draft";
  };

  const move = async (videoId: string, to: ColumnId) => {
    const video = rows.find((v) => v.id === videoId);
    if (!video || columnOf(video) === to) return;
    setBusy(videoId);
    try {
      if (to === "draft") {
        await approveFn({ data: { videoId, approved: false } });
        toast.success("Moved back to draft.");
      } else if (to === "approved") {
        const res = (await approveFn({ data: { videoId, approved: true } })) as {
          published?: boolean;
          url?: string;
          error?: string;
        };
        if (res?.published && res.url) toast.success(`Published publicly: ${res.url}`);
        else if (res?.error) toast.error(`Approved, but publishing failed: ${res.error}`);
        else toast.success("Approved.");
      } else if (to === "scheduled") {
        const res = await scheduleFn({ data: { videoId } });
        toast.success(`Scheduled for ${new Date(res.scheduledFor).toLocaleString()}.`);
      } else {
        if (!video.video_url) {
          toast.error("Render this video first — there is no video file yet.");
          return;
        }
        const res = await scheduleFn({ data: { videoId } });
        const published = await publishFn({ data: { queueId: res.queueId } });
        toast.success(`Live: ${published.url}`);
      }
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That move failed.");
    } finally {
      setBusy(null);
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const over = e.over?.id;
    const active = String(e.active.id);
    if (!over) return;
    if (over === "do-it") {
      const card = cards.find((c) => `action:${c.id}` === active);
      if (card) await run(card);
      return;
    }
    if (active.startsWith("video:")) {
      await move(active.slice(6), String(over) as ColumnId);
    }
  };

  return (
    <AppShell
      title="Studio"
      subtitle="Drag a suggestion into Do this to run it. Drag a video across the board to approve, schedule or publish it."
      action={
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to="/clips">
              <Scissors className="mr-1 size-4" /> Clip studio
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/templates">
              <PenLine className="mr-1 size-4" /> Write a script
            </Link>
          </Button>
        </div>
      }
    >
      <DndContext onDragEnd={onDragEnd}>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="spectrum-border lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" /> What to do next
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {actions.isLoading ? (
                <p className="text-sm text-muted-foreground">Reading your account…</p>
              ) : cards.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing pending.</p>
              ) : (
                cards.map((c) => (
                  <DraggableCard key={c.id} id={`action:${c.id}`}>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.why}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {c.impact}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-7 px-2 text-xs"
                        disabled={running === c.id}
                        onClick={() => run(c)}
                      >
                        {running === c.id ? "Running…" : "Run"}
                      </Button>
                    </div>
                  </DraggableCard>
                ))
              )}
            </CardContent>
          </Card>

          <DropZone id="do-it" className="border-dashed p-6 lg:col-span-2">
            <div className="flex h-full min-h-40 flex-col items-center justify-center text-center">
              <Play className="size-6 text-primary" />
              <p className="mt-2 font-display text-lg font-semibold">Do this</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Drop a suggestion here and it runs immediately — scan, decode, write, render or publish.
              </p>
            </div>
          </DropZone>
        </div>

        <div className="mt-6">
          <AutoScheduleCard />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = rows.filter((v) => columnOf(v) === col.id);
            return (
              <DropZone key={col.id} id={col.id} className="p-3">
                <div className="mb-3 flex items-baseline justify-between">
                  <p className="font-display text-sm font-semibold">{col.label}</p>
                  <span className="text-[11px] text-muted-foreground">{items.length}</span>
                </div>
                <p className="mb-3 text-[11px] text-muted-foreground">{col.hint}</p>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                      Drop videos here
                    </p>
                  ) : (
                    items.map((v) => (
                      <DraggableCard key={v.id} id={`video:${v.id}`}>
                        <p className="text-sm font-medium leading-snug">{v.title}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {(v.channels as { name?: string } | null)?.name ?? "unassigned"} ·{" "}
                          {v.video_url ? `${v.duration_seconds ?? 0}s rendered` : "not rendered"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => setReviewId(v.id)}
                          >
                            Review
                          </Button>
                          {COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                            <Button
                              key={c.id}
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              disabled={busy === v.id}
                              onClick={() => move(v.id, c.id)}
                            >
                              {c.label}
                            </Button>
                          ))}
                        </div>
                      </DraggableCard>
                    ))
                  )}
                </div>
              </DropZone>
            );
          })}
        </div>
      </DndContext>
      <VideoReviewDialog
        videoId={reviewId}
        open={Boolean(reviewId)}
        onOpenChange={(o) => !o && setReviewId(null)}
      />
    </AppShell>
  );
}
