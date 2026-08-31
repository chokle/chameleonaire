import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { channelQuery, channelVideosQuery } from "@/lib/queries";
import { chameleonize, renderThumbnail } from "@/lib/chameleon.functions";

export const Route = createFileRoute("/channels/$id")({
  head: () => ({
    meta: [
      { title: "Channel — chamele-on-air" },
      {
        name: "description",
        content: "Generate chameleonized videos for this channel: concepts, hooks, scripts and thumbnails.",
      },
      { property: "og:title", content: "Channel workspace" },
      { property: "og:description", content: "The blueprint, wearing your brand." },
    ],
  }),
  component: ChannelDetail,
});

function ChannelDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: channel } = useQuery(channelQuery(id));
  const { data: videos } = useQuery(channelVideosQuery(id));
  const spawn = useServerFn(chameleonize);
  const thumb = useServerFn(renderThumbnail);

  const generating = useMutation({
    mutationFn: () => spawn({ data: { channelId: id, count: 3 } }),
    onSuccess: (r: { created: number }) => {
      qc.invalidateQueries({ queryKey: ["channel-videos", id] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      toast.success(`${r.created} chameleonized videos created.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const thumbing = useMutation({
    mutationFn: (videoId: string) => thumb({ data: { videoId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channel-videos", id] });
      toast.success("Thumbnail rendered.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!channel) {
    return (
      <AppShell title="Channel">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  const bp = channel.blueprints as { name?: string; confidence?: number } | null;
  const brand = channel.brands as { name?: string } | null;

  return (
    <AppShell
      title={channel.name}
      subtitle={`${bp?.name ?? "no blueprint"} · ${brand?.name ?? "no brand"} · divergence ${Number(channel.divergence)}% · ${Number(channel.uploads_per_week)} uploads/week`}
      action={
        <Button onClick={() => generating.mutate()} disabled={generating.isPending}>
          {generating.isPending ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 size-4" />
          )}
          Generate 3 videos
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chameleonized output ({videos?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {(videos ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nothing generated yet. The engine applies the blueprint's structure to your brand — never the
              source creator's words.
            </p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {(videos ?? []).map((v) => (
                <AccordionItem key={v.id} value={v.id}>
                  <AccordionTrigger className="text-left">
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
                      {v.thumbnail_url ? (
                        <img
                          src={v.thumbnail_url}
                          alt={`Thumbnail for ${v.title}`}
                          className="h-10 w-[72px] shrink-0 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-10 w-[72px] shrink-0 place-items-center rounded bg-secondary">
                          <ImageIcon className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="truncate">{v.title}</span>
                      <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                        {v.status}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Concept</p>
                      <p className="mt-1 text-sm">{v.concept}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Hook</p>
                      <p className="mt-1 text-sm italic">{v.hook}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Script</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{v.script}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(v.tags ?? []).map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => thumbing.mutate(v.id)}
                      disabled={thumbing.isPending}
                    >
                      {thumbing.isPending ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : (
                        <ImageIcon className="mr-1 size-4" />
                      )}
                      {v.thumbnail_url ? "Re-render thumbnail" : "Render thumbnail"}
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
