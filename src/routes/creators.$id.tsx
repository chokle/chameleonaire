import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { creatorQuery } from "@/lib/queries";
import { compact, money } from "@/lib/domain";

export const Route = createFileRoute("/creators/$id")({
  head: ({ params }) => {
    const ref = params.id.slice(0, 8);
    const title = `Creator ${ref} — chamele-on-air`;
    const description = `Earnings model, cadence, consistency and sampled videos behind creator ${ref}'s profit-per-video estimate.`;
    const url = `https://chameleonaire.lovable.app/creators/${params.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CreatorDetail,
});

function CreatorDetail() {
  const { id } = Route.useParams();
  const { data } = useQuery(creatorQuery(id));

  if (!data) {
    return (
      <AppShell title="Creator">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  const videos = (data.creator_videos ?? []) as Array<{
    id: string;
    title: string;
    views: number;
    hook: string | null;
    thumbnail_desc: string | null;
    est_profit: number;
    duration_seconds: number | null;
  }>;

  const stats = [
    ["Profit / video", money(data.est_profit_per_video)],
    ["Range", `${money(data.est_profit_low)} – ${money(data.est_profit_high)}`],
    ["Monthly est.", money(data.est_monthly)],
    ["RPM band", `$${Number(data.rpm_low)} – $${Number(data.rpm_high)}`],
    ["Subscribers", compact(data.subscribers)],
    ["Avg views", compact(data.avg_views)],
    ["Uploads / mo", Number(data.uploads_per_month).toFixed(1)],
    ["Consistency", `${Math.round(Number(data.consistency_score))}%`],
  ] as const;

  return (
    <AppShell
      title={data.channel_name}
      subtitle={`${data.niche} · ${data.format ?? "mixed format"} · ${data.data_source === "youtube" ? "verified public metadata" : "modelled from public signals"}`}
      action={
        data.channel_url ? (
          <a
            href={data.channel_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open channel ↗
          </a>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.notes ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Why they earn</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">{data.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Sampled videos ({videos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No videos sampled for this creator.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {videos.map((v) => (
                <li key={v.id} className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium">{v.title}</p>
                    <span className="shrink-0 font-mono text-xs text-primary">
                      {money(v.est_profit)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {compact(v.views)} views
                    {v.duration_seconds ? ` · ${Math.round(v.duration_seconds / 60)} min` : ""}
                  </p>
                  {v.hook ? (
                    <p className="mt-2 text-xs italic text-muted-foreground">“{v.hook}”</p>
                  ) : null}
                  {v.thumbnail_desc ? (
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      {v.thumbnail_desc}
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
