import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { blueprintsQuery } from "@/lib/queries";
import { DEPLOY_THRESHOLD } from "@/lib/domain";

export const Route = createFileRoute("/blueprints/")({
  head: () => ({
    meta: [
      { title: "Blueprints — chamele-on-air" },
      {
        name: "description",
        content:
          "Every decoded strategy with its evidence, confidence score and deploy status at the 95% gate.",
      },
      { property: "og:title", content: "Decoded strategy blueprints" },
      {
        property: "og:description",
        content: "Hook patterns, title formulas, pacing and cadence — with confidence you can audit.",
      },
    ],
  }),
  component: Blueprints,
});

function Blueprints() {
  const { data } = useQuery(blueprintsQuery);
  const rows = data ?? [];

  return (
    <AppShell
      title="Blueprints"
      subtitle={`A blueprint only unlocks channel deployment at ${DEPLOY_THRESHOLD}% confidence or higher.`}
      action={
        <Button asChild variant="secondary">
          <Link to="/scanner">Extract a new one</Link>
        </Button>
      }
    >
      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No blueprints yet. Select creators in the scanner and extract one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => {
            const conf = Math.round(Number(b.confidence));
            return (
              <Link key={b.id} to="/blueprints/$id" params={{ id: b.id }}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display font-semibold leading-tight">{b.name}</p>
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
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
