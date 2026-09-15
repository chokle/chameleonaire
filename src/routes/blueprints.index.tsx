import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pin, PinOff, Rocket, Search, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { blueprintsQuery } from "@/lib/queries";
import { DEPLOY_THRESHOLD } from "@/lib/domain";
import {
  duplicateBlueprint,
  setBlueprintNotes,
  setBlueprintPinned,
} from "@/lib/blueprint.functions";

export const Route = createFileRoute("/blueprints/")({
  head: () => ({
    meta: [
      { title: "Blueprint bank — chamele-on-air" },
      {
        name: "description",
        content:
          "Store, search and reuse every decoded channel blueprint — pin your best, add notes and spawn a channel in one tap.",
      },
      { property: "og:title", content: "Blueprint bank" },
      {
        property: "og:description",
        content: "Saved channel strategies with confidence scores, notes and one-tap reuse.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Blueprints,
});

type Row = {
  id: string;
  name: string;
  niche: string;
  generation: number;
  confidence: number | string;
  win_rate: number | string;
  gap_notes: string | null;
  strategy: unknown;
  pinned?: boolean;
  notes?: string | null;
};

function Blueprints() {
  const { data } = useQuery(blueprintsQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const rows = (data ?? []) as unknown as Row[];

  const [term, setTerm] = useState("");
  const [niche, setNiche] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<Row | null>(null);
  const [noteText, setNoteText] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["blueprints"] });

  const pinning = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) =>
      setBlueprintPinned({ data: { blueprintId: v.id, pinned: v.pinned } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const savingNote = useMutation({
    mutationFn: (v: { id: string; notes: string }) =>
      setBlueprintNotes({ data: { blueprintId: v.id, notes: v.notes } }),
    onSuccess: () => {
      setNoteFor(null);
      toast.success("Note saved.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copying = useMutation({
    mutationFn: (id: string) => duplicateBlueprint({ data: { blueprintId: id } }),
    onSuccess: async (r) => {
      await refresh();
      toast.success("Copy saved to the bank.");
      navigate({ to: "/blueprints/$id", params: { id: r.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const niches = useMemo(
    () => Array.from(new Set(rows.map((r) => r.niche))).sort(),
    [rows],
  );

  const visible = useMemo(() => {
    const t = term.trim().toLowerCase();
    return rows
      .filter((r) => (niche ? r.niche === niche : true))
      .filter((r) =>
        t
          ? `${r.name} ${r.niche} ${r.notes ?? ""} ${r.gap_notes ?? ""}`.toLowerCase().includes(t)
          : true,
      )
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [rows, term, niche]);

  return (
    <AppShell
      title="Blueprint bank"
      subtitle={`Saved strategies you can reuse any time. A blueprint unlocks channel deployment at ${DEPLOY_THRESHOLD}% confidence or higher.`}
      action={
        <Button asChild variant="secondary">
          <Link to="/scanner">Extract a new one</Link>
        </Button>
      }
    >
      <div className="mb-6 space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search saved blueprints"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Search saved blueprints"
          />
        </div>
        {niches.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={niche === null ? "default" : "secondary"}
              onClick={() => setNiche(null)}
            >
              All
            </Button>
            {niches.map((n) => (
              <Button
                key={n}
                size="sm"
                variant={niche === n ? "default" : "secondary"}
                onClick={() => setNiche(niche === n ? null : n)}
              >
                {n}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No blueprints yet. Paste a channel link in the scanner and extract one."
              : "Nothing matches that search."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((b) => {
            const conf = Math.round(Number(b.confidence));
            return (
              <Card key={b.id} className="flex h-full flex-col">
                <CardContent className="flex flex-1 flex-col pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      to="/blueprints/$id"
                      params={{ id: b.id }}
                      className="font-display font-semibold leading-tight hover:underline"
                    >
                      {b.name}
                    </Link>
                    <Badge variant={conf >= DEPLOY_THRESHOLD ? "default" : "secondary"}>
                      {conf}%
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {b.niche} · gen {b.generation} · win rate {Math.round(Number(b.win_rate))}%
                  </p>
                  <Progress value={conf} className="mt-4 h-1.5" />
                  <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                    {conf >= DEPLOY_THRESHOLD
                      ? ((b.strategy as { why_it_wins?: string })?.why_it_wins ?? "Deployable.")
                      : (b.gap_notes ?? "Below the deploy gate.")}
                  </p>
                  {b.notes ? (
                    <p className="mt-3 rounded-md bg-secondary/60 p-2 text-xs">{b.notes}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-2">
                    <Button asChild size="sm">
                      <Link to="/channels" search={{ blueprint: b.id }}>
                        <Rocket className="mr-1 size-4" /> Spawn channel
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={b.pinned ? "Unpin blueprint" : "Pin blueprint"}
                      onClick={() => pinning.mutate({ id: b.id, pinned: !b.pinned })}
                      disabled={pinning.isPending}
                    >
                      {b.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Add a note"
                      onClick={() => {
                        setNoteFor(b);
                        setNoteText(b.notes ?? "");
                      }}
                    >
                      <StickyNote className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Duplicate blueprint"
                      onClick={() => copying.mutate(b.id)}
                      disabled={copying.isPending}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(noteFor)} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note on {noteFor?.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={6}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="What you want to remember about this blueprint."
          />
          <DialogFooter>
            <Button
              onClick={() =>
                noteFor && savingNote.mutate({ id: noteFor.id, notes: noteText })
              }
              disabled={savingNote.isPending}
            >
              Save note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
