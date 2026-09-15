import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Link2, Loader2, Radar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { BRACKETS, compact, money } from "@/lib/domain";
import { creatorsQuery } from "@/lib/queries";
import { importChannelLink, runScan } from "@/lib/scan.functions";
import { extractBlueprint } from "@/lib/blueprint.functions";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Profit scanner — chamele-on-air" },
      {
        name: "description",
        content:
          "Surface creators by modelled profit per video inside the bracket you choose, then extract their winning structure.",
      },
      { property: "og:title", content: "Profit scanner" },
      {
        property: "og:description",
        content: "Filter creators by earnings bracket and decode what makes them win.",
      },
    ],
  }),
  component: Scanner,
});

function Scanner() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const scan = useServerFn(runScan);
  const extract = useServerFn(extractBlueprint);

  const [niche, setNiche] = useState("finance");
  const [bracketId, setBracketId] = useState(BRACKETS[2]!.id);
  const [count, setCount] = useState(12);
  const [persistent, setPersistent] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [channelLink, setChannelLink] = useState("");
  const importLink = useServerFn(importChannelLink);

  const bracket = BRACKETS.find((b) => b.id === bracketId)!;
  const creators = useQuery(creatorsQuery());

  const scanning = useMutation({
    mutationFn: () =>
      scan({
        data: {
          niche,
          min: bracket.min,
          max: bracket.max,
          count,
          persistent,
          datasetId: null,
        },
      }),
    onSuccess: (r: { found: number }) => {
      toast.success(`Surfaced ${r?.found ?? 0} creators in the ${bracket.label} bracket.`);
      qc.invalidateQueries({ queryKey: ["creators"] });
      qc.invalidateQueries({ queryKey: ["scans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const extracting = useMutation({
    mutationFn: () => extract({ data: { creatorIds: selected } }),
    onSuccess: (bp: { id: string; confidence: number }) => {
      qc.invalidateQueries({ queryKey: ["blueprints"] });
      toast.success(`Blueprint extracted at ${Math.round(Number(bp.confidence))}% confidence.`);
      navigate({ to: "/blueprints/$id", params: { id: bp.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cloning = useMutation({
    mutationFn: async () => {
      const imported = (await importLink({ data: { url: channelLink.trim(), niche: null } })) as {
        creatorId: string;
        channelName: string;
      };
      const bp = (await extract({ data: { creatorIds: [imported.creatorId] } })) as {
        id: string;
        confidence: number;
      };
      return { imported, bp };
    },
    onSuccess: ({ imported, bp }) => {
      qc.invalidateQueries({ queryKey: ["creators"] });
      qc.invalidateQueries({ queryKey: ["blueprints"] });
      setChannelLink("");
      toast.success(
        `Copied ${imported.channelName} at ${Math.round(Number(bp.confidence))}% confidence.`,
      );
      navigate({ to: "/blueprints/$id", params: { id: bp.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (creators.data ?? []).filter(
    (c) =>
      Number(c.est_profit_per_video) >= bracket.min &&
      (bracket.max === null || Number(c.est_profit_per_video) <= bracket.max),
  );

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 8 ? [...s, id] : s));

  return (
    <AppShell
      title="Profit scanner"
      subtitle="Choose a niche and an earnings bracket. Profit per video is modelled from public signals — audience size, view velocity, niche RPM bands and sponsor uplift."
    >
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit spectrum-border">
          <CardHeader>
            <CardTitle className="text-base">Scan parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="niche">Niche</Label>
              <Input
                id="niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="finance, ai tools, true crime…"
              />
            </div>

            <div className="space-y-2">
              <Label>Profit bracket</Label>
              <div className="grid gap-2">
                {BRACKETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBracketId(b.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      b.id === bracketId
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Creators to surface</Label>
                <span className="font-mono text-muted-foreground">{count}</span>
              </div>
              <Slider
                aria-label="Number of creators to surface"
                value={[count]}
                min={3}
                max={24}
                step={1}
                onValueChange={([v]) => setCount(v ?? 12)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Keep scanning</p>
                <p className="text-xs text-muted-foreground">Re-sweep this niche for new winners</p>
              </div>
              <Switch aria-label="Keep scanning this niche" checked={persistent} onCheckedChange={setPersistent} />
            </div>

            <Button
              className="w-full"
              onClick={() => scanning.mutate()}
              disabled={scanning.isPending || niche.trim().length < 2}
            >
              {scanning.isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Radar className="mr-1 size-4" />
              )}
              {scanning.isPending ? "Scanning…" : "Run scan"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {rows.length} creators in {bracket.label}
            </CardTitle>
            <Button
              size="sm"
              disabled={selected.length === 0 || extracting.isPending}
              onClick={() => extracting.mutate()}
            >
              {extracting.isPending ? (
                <Loader2 className="mr-1 size-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1 size-4" />
              )}
              Extract blueprint ({selected.length})
            </Button>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                No creators in this bracket yet. Run a scan on the left.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {rows.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <Checkbox
                      aria-label={`Select ${c.channel_name} for blueprint extraction`}
                      checked={selected.includes(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <a
                          href={c.channel_url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate font-medium hover:text-primary"
                        >
                          {c.channel_name}
                        </a>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {c.data_source?.startsWith("youtube") ? "verified metadata" : "modelled"}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {compact(c.subscribers)} subs · {compact(c.avg_views)} avg views ·{" "}
                        {Number(c.uploads_per_month).toFixed(0)} uploads/mo · consistency{" "}
                        {Math.round(Number(c.consistency_score))}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-primary">
                        {money(c.est_profit_per_video)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {money(c.est_monthly)}/mo est.
                      </p>
                    </div>
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
