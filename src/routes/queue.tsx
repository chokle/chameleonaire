import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queueQuery, snapshotsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { runFeedbackLoop } from "@/lib/chameleon.functions";
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

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("publish_queue").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
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
        <Button variant="secondary" onClick={() => adapting.mutate()} disabled={adapting.isPending}>
          {adapting.isPending ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 size-4" />
          )}
          Run adaptation pass
        </Button>
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
                  const v = q.generated_videos as { title?: string } | null;
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
                            onClick={() => setStatus.mutate({ id: q.id, status: "scheduled" })}
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
