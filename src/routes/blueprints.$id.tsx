import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Rocket, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { blueprintQuery } from "@/lib/queries";
import { DEPLOY_THRESHOLD, type BlueprintEvidence, type StrategyBlueprint } from "@/lib/domain";
import { refineBlueprint } from "@/lib/blueprint.functions";

export const Route = createFileRoute("/blueprints/$id")({
  head: () => ({
    meta: [
      { title: "Blueprint breakdown — chamele-on-air" },
      {
        name: "description",
        content: "The decoded structure: hook pattern, title formula, beats, pacing and the evidence behind it.",
      },
      { property: "og:title", content: "Blueprint breakdown" },
      { property: "og:description", content: "Structure, evidence and confidence for one winning formula." },
    ],
  }),
  component: BlueprintDetail,
});

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function BlueprintDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(blueprintQuery(id));
  const refine = useServerFn(refineBlueprint);

  const refining = useMutation({
    mutationFn: () => refine({ data: { blueprintId: id } }),
    onSuccess: (bp: { id: string }) => {
      qc.invalidateQueries({ queryKey: ["blueprints"] });
      toast.success("Next-generation blueprint extracted.");
      navigate({ to: "/blueprints/$id", params: { id: bp.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <AppShell title="Blueprint">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  const s = (data.strategy ?? {}) as StrategyBlueprint;
  const evidence = (data.evidence ?? []) as BlueprintEvidence[];
  const conf = Math.round(Number(data.confidence));
  const ready = conf >= DEPLOY_THRESHOLD;

  return (
    <AppShell
      title={data.name}
      subtitle={`${data.niche} · generation ${data.generation} · built from ${data.source_creator_ids?.length ?? 0} creators`}
      action={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => refining.mutate()} disabled={refining.isPending}>
            {refining.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 size-4" />
            )}
            Re-extract wider
          </Button>
          <Button asChild disabled={!ready}>
            <Link to="/channels" search={{ blueprint: id }}>
              <Rocket className="mr-1 size-4" /> Spawn channel
            </Link>
          </Button>
        </div>
      }
    >
      <Card className={ready ? "spectrum-border" : ""}>
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <div className="min-w-[220px] flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Confidence</p>
              <Badge variant={ready ? "default" : "secondary"}>{conf}%</Badge>
            </div>
            <Progress value={conf} className="mt-2 h-2" />
          </div>
          <div className="flex items-start gap-2 text-sm">
            {ready ? (
              <>
                <ShieldCheck className="mt-0.5 size-4 text-primary" />
                <span>Above the {DEPLOY_THRESHOLD}% gate — cleared for channel deployment.</span>
              </>
            ) : (
              <>
                <ShieldAlert className="mt-0.5 size-4 text-muted-foreground" />
                <span className="max-w-md text-muted-foreground">
                  {data.gap_notes ?? `Below the ${DEPLOY_THRESHOLD}% gate — deployment locked.`}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">The formula</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Positioning" value={s.positioning} />
            <Field label="Hook pattern" value={s.hook_pattern} />
            <Field label="Title formula" value={s.title_formula} />
            <Field label="Thumbnail grammar" value={s.thumbnail_grammar} />
            <Field label="Pacing" value={s.pacing} />
            <Field label="Cadence" value={s.upload_cadence} />
            <Field label="Ideal length" value={s.ideal_length} />
            <Field label="Monetization mix" value={s.monetization_mix} />
            <Field label="Why it wins" value={s.why_it_wins} />

            {s.script_skeleton?.length ? (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Script beats</p>
                <ol className="mt-2 space-y-1.5">
                  {s.script_skeleton.map((b, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {s.retention_devices?.length ? (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Retention devices</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.retention_devices.map((d) => (
                    <Badge key={d} variant="outline">
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {s.topic_ladder?.length ? (
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Topic ladder</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {s.topic_ladder.map((t, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="text-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">No evidence recorded.</p>
            ) : (
              evidence.map((e, i) => (
                <div key={i} className="rounded-lg border border-border/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm">{e.claim}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {Math.round(Number(e.confidence))}%
                    </Badge>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {(e.supporting_videos ?? []).slice(0, 4).map((v, j) => (
                      <li key={j} className="truncate text-xs text-muted-foreground">
                        · {v}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
