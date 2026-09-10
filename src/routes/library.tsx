import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { allVideosQuery, snapshotsQuery } from "@/lib/queries";
import { compact } from "@/lib/domain";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Video library — chamele-on-air" },
      {
        name: "description",
        content:
          "Every video published to YouTube from your channels, with publish date, view count and a direct link.",
      },
      { property: "og:title", content: "Video library" },
      {
        property: "og:description",
        content: "Every published video, its date, its views and a direct YouTube link.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Library,
});

function Library() {
  const { data: videos } = useQuery(allVideosQuery);
  const { data: snaps } = useQuery(snapshotsQuery);

  const published = (videos ?? []).filter((v) => v.youtube_video_id);

  // Latest snapshot per video carries the freshest public view count.
  const viewsByVideo = new Map<string, number>();
  for (const s of snaps ?? []) {
    if (!s.generated_video_id) continue;
    if (!viewsByVideo.has(s.generated_video_id)) {
      viewsByVideo.set(s.generated_video_id, Number(s.views ?? 0));
    }
  }

  return (
    <AppShell
      title="Video library"
      subtitle="Everything that made it onto YouTube, newest first."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Published ({published.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {published.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nothing published yet. Approve and schedule a video and it shows up here once it is live.
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {published.map((v) => {
                const url = `https://youtube.com/watch?v=${v.youtube_video_id}`;
                const channel = v.channels as { name?: string } | null;
                const views = viewsByVideo.get(v.id);
                return (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{v.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {channel?.name ?? "channel"} ·{" "}
                        {new Date(v.updated_at ?? v.created_at).toLocaleDateString()}
                        {v.duration_seconds ? ` · ${v.duration_seconds}s` : ""}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {views === undefined ? "views pending" : `${compact(views)} views`}
                    </Badge>
                    <a
                      className="inline-flex items-center gap-1 text-xs text-primary underline"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Watch <ExternalLink className="size-3" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
