import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { blueprintSourcesQuery } from "@/lib/queries";
import { compact } from "@/lib/domain";

/**
 * The real channels a blueprint was decoded from: their actual picture, about
 * text and public numbers. Shown as the source of the structure only — nothing
 * here is reused on the operator's own channel.
 */
export function SourceChannels({
  ids,
  title = "Modeled on",
}: {
  ids: string[];
  title?: string;
}) {
  const { data, isLoading } = useQuery(blueprintSourcesQuery(ids));
  const rows = data ?? [];

  if (!ids.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Reading the source channels…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The source channels for this blueprint are no longer on file.
          </p>
        ) : (
          rows.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-lg border border-border/70">
              {c.banner_url ? (
                <img
                  src={c.banner_url}
                  alt={`${c.channel_name} channel banner`}
                  loading="lazy"
                  className="h-20 w-full object-cover"
                />
              ) : null}
              <div className="flex gap-3 p-3">
                {c.avatar_url ? (
                  <img
                    src={c.avatar_url}
                    alt={`${c.channel_name} channel picture`}
                    loading="lazy"
                    className="size-12 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">
                    {c.channel_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{c.channel_name}</p>
                    <Badge variant="secondary">{c.niche}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {compact(Number(c.subscribers))} subscribers · {compact(Number(c.avg_views))} avg
                    views · ${Math.round(Number(c.est_profit_per_video)).toLocaleString()} modelled per
                    video
                  </p>
                  {c.description ? (
                    <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {c.description}
                    </p>
                  ) : null}
                  {c.channel_url ? (
                    <a
                      href={c.channel_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open on YouTube <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
