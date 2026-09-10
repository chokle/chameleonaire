import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { blueprintsQuery, brandsQuery, channelsQuery } from "@/lib/queries";
import { DEPLOY_THRESHOLD } from "@/lib/domain";
import { createChannel, deleteChannel } from "@/lib/console.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/channels/")({
  validateSearch: z.object({ blueprint: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Channels — chamele-on-air" },
      {
        name: "description",
        content: "Spawn branded channels that run a cleared blueprint, each with its own divergence dial.",
      },
      { property: "og:title", content: "Spawned channels" },
      { property: "og:description", content: "One winning formula, many brands, always adapting." },
    ],
  }),
  component: Channels,
});

function Channels() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const channels = useQuery(channelsQuery);
  const blueprints = useQuery(blueprintsQuery);
  const brands = useQuery(brandsQuery);

  const [name, setName] = useState("");
  const [blueprintId, setBlueprintId] = useState(search.blueprint ?? "");
  const [brandId, setBrandId] = useState("");
  const [divergence, setDivergence] = useState(25);
  const [uploads, setUploads] = useState(3);
  const [autoPublish, setAutoPublish] = useState(true);

  const allBlueprints = (blueprints.data ?? []).slice().sort(
    (a, b) => Number(b.confidence) - Number(a.confidence),
  );
  const selected = allBlueprints.find((b) => b.id === blueprintId) ?? null;
  const selectedLocked = selected ? Number(selected.confidence) < DEPLOY_THRESHOLD : false;

  const spawnChannel = useServerFn(createChannel);
  const create = useMutation({
    mutationFn: async () => {
      await spawnChannel({
        data: {
          name,
          blueprint_id: blueprintId || null,
          brand_id: brandId || null,
          divergence,
          uploads_per_week: uploads,
          auto_publish: autoPublish,
        },
      });
    },
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Channel spawned.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeChannel = useServerFn(deleteChannel);
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await removeChannel({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels"] });
      toast.success("Channel deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Channels"
      subtitle="Each channel pairs a cleared blueprint with one of your brands. Divergence controls how far the output drifts from the source structure."
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit spectrum-border">
          <CardHeader>
            <CardTitle className="text-base">Spawn a channel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cname">Channel name</Label>
              <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Blueprint</Label>
              <Select value={blueprintId} onValueChange={setBlueprintId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a blueprint (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {allBlueprints.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No blueprints yet — extract one from a scan first.
                    </div>
                  ) : (
                    allBlueprints.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} · {Math.round(Number(b.confidence))}%
                        {Number(b.confidence) < DEPLOY_THRESHOLD ? " · locked" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedLocked ? (
                <p className="text-xs text-muted-foreground">
                  This blueprint sits below the {DEPLOY_THRESHOLD}% gate. You can still spawn the
                  channel and connect YouTube — video generation stays locked until confidence
                  clears the gate.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Brand</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a brand" />
                </SelectTrigger>
                <SelectContent>
                  {(brands.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Divergence</Label>
                <span className="font-mono text-muted-foreground">{divergence}%</span>
              </div>
              <Slider
                aria-label="Divergence from the source blueprint"
                value={[divergence]}
                min={5}
                max={80}
                step={5}
                onValueChange={([v]) => setDivergence(v ?? 25)}
              />
              <p className="text-xs text-muted-foreground">
                Low hugs the proven structure. High keeps only the principle and reinvents the surface.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Uploads per week</Label>
                <span className="font-mono text-muted-foreground">{uploads}</span>
              </div>
              <Slider
                aria-label="Uploads per week"
                value={[uploads]}
                min={1}
                max={14}
                step={1}
                onValueChange={([v]) => setUploads(v ?? 3)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Auto-schedule</p>
                <p className="text-xs text-muted-foreground">Queue new videos without approval</p>
              </div>
              <Switch aria-label="Auto-schedule new videos" checked={autoPublish} onCheckedChange={setAutoPublish} />
            </div>

            <Button
              className="w-full"
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              <Plus className="mr-1 size-4" />
              {create.isPending ? "Spawning…" : "Spawn channel"}
            </Button>
            {!name.trim() ? (
              <p className="text-xs text-muted-foreground">Give the channel a name to spawn it.</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {(channels.data ?? []).length === 0 ? (
            <Card className="sm:col-span-2">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No channels yet. Clear a blueprint first, then spawn one here.
              </CardContent>
            </Card>
          ) : (
            (channels.data ?? []).map((c) => {
              const bp = c.blueprints as { name?: string; win_rate?: number } | null;
              const brand = c.brands as { name?: string } | null;
              return (
                <Link key={c.id} to="/channels/$id" params={{ id: c.id }}>
                  <Card className="h-full transition-colors hover:border-primary/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display text-lg font-semibold">{c.name}</p>
                        <Badge variant={c.connected ? "default" : "secondary"}>
                          {c.connected ? c.status : "not connected"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {bp?.name ?? "no blueprint"} · {brand?.name ?? "no brand"}
                      </p>
                      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                        <span>divergence {Number(c.divergence)}%</span>
                        <span>{Number(c.uploads_per_week)}/wk</span>
                        <span>win rate {Math.round(Number(bp?.win_rate ?? 0))}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
