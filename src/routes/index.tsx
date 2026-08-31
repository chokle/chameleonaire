import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Boxes, Fingerprint, Radar, Repeat, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { blueprintsQuery, channelsQuery, creatorsQuery, queueQuery } from "@/lib/queries";
import { DEPLOY_THRESHOLD, money, compact } from "@/lib/domain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command — chamele-on-air" },
      {
        name: "description",
        content:
          "One console for profit scanning, blueprint extraction and the channels spawning off the winning formula.",
      },
      { property: "og:title", content: "chamele-on-air command deck" },
      {
        property: "og:description",
        content: "Scan the earners, decode the formula, spawn the channels. Forever adapting.",
      },
    ],
  }),
  component: Command,
});

function Stat({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
}) {
  return (
    <Card className="spectrum-border">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <Icon className="size-4 text-primary" />
        </div>
        <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function Command() {
  const creators = useQuery(creatorsQuery());
  const blueprints = useQuery(blueprintsQuery);
  const channels = useQuery(channelsQuery);
  const queue = useQuery(queueQuery);

  const rows = creators.data ?? [];
  const bps = blueprints.data ?? [];
  const chans = channels.data ?? [];
  const deployable = bps.filter((b) => Number(b.confidence) >= DEPLOY_THRESHOLD);
  const topProfit = rows[0] ? Number(rows[0].est_profit_per_video) : 0;
  const pipeline = (queue.data ?? []).filter((q) => q.status !== "published");

  return (
    <AppShell
      title="Command deck"
      subtitle="Scan the earners. Decode what wins. Spawn channels that run the formula as your own — and keep adapting."
      action={
        <Button asChild>
          <Link to="/scanner">
            Run a profit scan <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Creators surfaced"
          value={compact(rows.length)}
          sub={topProfit ? `top earner ${money(topProfit)} / video` : "no scans yet"}
          icon={Radar}
        />
        <Stat
          label="Deployable blueprints"
          value={`${deployable.length}/${bps.length}`}
          sub={`gate at ${DEPLOY_THRESHOLD}% confidence`}
          icon={Fingerprint}
        />
        <Stat
          label="Live channels"
          value={compact(chans.filter((c) => c.status === "active").length)}
          sub={`${chans.length} total spawned`}
          icon={Boxes}
        />
        <Stat
          label="In pipeline"
          value={compact(pipeline.length)}
          sub="videos scheduled or awaiting approval"
          icon={Repeat}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Top earners surfaced</CardTitle>
            <Link to="/scanner" className="text-xs text-primary hover:underline">
              scanner
            </Link>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <Empty
                text="Nothing scanned yet. Pick a niche and a profit bracket and the scanner will surface who is actually earning in it."
                to="/scanner"
                cta="Open scanner"
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {rows.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/creators/$id"
                        params={{ id: c.id }}
                        className="truncate font-medium hover:text-primary"
                      >
                        {c.channel_name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.niche} · {compact(c.subscribers)} subs · {compact(c.avg_views)} avg views
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-primary">
                        {money(c.est_profit_per_video)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">per video</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blueprint confidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {bps.length === 0 ? (
              <Empty
                text="Select creators in the scanner and extract a blueprint to see the strategy broken down."
                to="/blueprints"
                cta="Blueprints"
              />
            ) : (
              bps.slice(0, 5).map((b) => (
                <div key={b.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      to="/blueprints/$id"
                      params={{ id: b.id }}
                      className="truncate hover:text-primary"
                    >
                      {b.name}
                    </Link>
                    <Badge variant={Number(b.confidence) >= DEPLOY_THRESHOLD ? "default" : "secondary"}>
                      {Math.round(Number(b.confidence))}%
                    </Badge>
                  </div>
                  <Progress value={Number(b.confidence)} className="mt-2 h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-primary" /> The loop
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          {[
            ["Scan", "Model profit per video from public signals inside your chosen bracket."],
            ["Digest", "Extract the repeatable structure with evidence and a calibrated confidence score."],
            ["Spawn", "Clone the structure onto your own brand with a divergence dial — never the source's words."],
            ["Adapt", "Score results, tighten what wins, drift away from what doesn't, re-extract."],
          ].map(([t, d], i) => (
            <div key={t} className="rounded-lg border border-border/70 bg-card/40 p-4">
              <p className="font-mono text-xs text-primary">0{i + 1}</p>
              <p className="mt-1 font-display font-semibold">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Empty({ text, to, cta }: { text: string; to: string; cta: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="secondary" size="sm" className="mt-3">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}
