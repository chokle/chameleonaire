import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNextActions } from "@/lib/autopilot.functions";
import { useActionRunner } from "@/lib/useActionRunner";
import { useCompletedActions, clearActionDone } from "@/lib/completedActions";
import type { ActionCard } from "@/lib/recommendations";
import { Check, ListChecks } from "lucide-react";

/** Always-on checklist: the single most valuable action first, everything else under it. */
export function NextSteps() {
  const qc = useQueryClient();
  const fn = useServerFn(getNextActions);
  const { data, isLoading } = useQuery({
    queryKey: ["next-actions"],
    queryFn: () => fn({ data: undefined }),
  });
  const { run, running } = useActionRunner(() => qc.invalidateQueries({ queryKey: ["next-actions"] }));
  const doneIds = useCompletedActions();

  const cards = (data?.actions ?? []) as ActionCard[];
  const pending = cards.filter((c) => !doneIds.has(c.id));
  const done = cards.filter((c) => doneIds.has(c.id));
  const [first, ...rest] = pending;


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-4 text-primary" /> Your next steps
        </CardTitle>
        <Link to="/studio" className="text-xs text-primary hover:underline">
          open studio
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Reading your account…</p>
        ) : !first ? (
          <p className="text-sm text-muted-foreground">You are all caught up.</p>
        ) : (
          <>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <Badge className="mb-2">Do this first</Badge>
              <p className="font-medium">{first.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{first.why}</p>
              <Button className="mt-3" size="sm" disabled={running === first.id} onClick={() => run(first)}>
                {running === first.id ? "Running…" : "Do it"}
              </Button>
            </div>
            {rest.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.impact}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={running === c.id}
                  onClick={() => run(c)}
                  className="shrink-0"
                >
                  {running === c.id ? "…" : "Run"}
                </Button>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
