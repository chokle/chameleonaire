import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { Film, Image as ImageIcon, Link2, Loader2, Sparkles, Unlink } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { channelQuery, channelVideosQuery } from "@/lib/queries";
import { chameleonize, renderThumbnail } from "@/lib/chameleon.functions";
import {
  renderVideo,
  setVideoDurationTarget,
  youtubeConnectUrl,
  youtubeDisconnect,
  youtubeReady,
} from "@/lib/publish.functions";
import { setVideoApproval, setChannelGateOverride } from "@/lib/console.functions";
import { Switch } from "@/components/ui/switch";
import { DEPLOY_THRESHOLD } from "@/lib/domain";

export const Route = createFileRoute("/channels/$id")({
  head: ({ params }) => {
    const title = "Chamele-on-air - adapt · transform · go viral";
    const description = "Workspace for this channel: generate chameleonized concepts, hooks, scripts and thumbnails, then queue them to publish.";
    const url = `https://chameleonaire.me/channels/${params.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ChannelDetail,
});

function ChannelDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: channel } = useQuery(channelQuery(id));
  const { data: videos } = useQuery(channelVideosQuery(id));
  const spawn = useServerFn(chameleonize);
  const thumb = useServerFn(renderThumbnail);
  const connect = useServerFn(youtubeConnectUrl);
  const disconnectFn = useServerFn(youtubeDisconnect);
  const readyFn = useServerFn(youtubeReady);
  const render = useServerFn(renderVideo);
  const setTargetFn = useServerFn(setVideoDurationTarget);
  const youtubePopup = useRef<Window | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "youtube-connected") {
        qc.invalidateQueries({ queryKey: ["channel", id] });
        qc.invalidateQueries({ queryKey: ["channels"] });
        toast.success("YouTube channel connected.");
        if (youtubePopup.current && !youtubePopup.current.closed) {
          youtubePopup.current.close();
          youtubePopup.current = null;
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [qc, id]);

  const { data: ready } = useQuery({
    queryKey: ["youtube-ready"],
    queryFn: () => readyFn({}),
  });

  const connecting = useMutation({
    mutationFn: () => connect({ data: { channelId: id } }),
    onSuccess: (r: { url: string }) => {
      if (youtubePopup.current && !youtubePopup.current.closed) {
        youtubePopup.current.location.href = r.url;
        youtubePopup.current.focus();
        return;
      }
      window.location.href = r.url;
    },
    onError: (e: Error) => {
      youtubePopup.current?.close();
      youtubePopup.current = null;
      toast.error(e.message);
    },
  });

  const startYouTubeConnection = () => {
    youtubePopup.current = window.open(
      "about:blank",
      "youtube-oauth",
      "popup,width=600,height=760",
    );
    connecting.mutate();
  };

  const disconnecting = useMutation({
    mutationFn: () => disconnectFn({ data: { channelId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channel", id] });
      toast.success("YouTube disconnected.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rendering = useMutation({
    mutationFn: ({ videoId, durationTarget }: { videoId: string; durationTarget: number }) =>
      render({ data: { videoId, durationTarget } }),
    onSuccess: (r: { durationSeconds: number }) => {
      qc.invalidateQueries({ queryKey: ["channel-videos", id] });
      toast.success(`Video rendered and stored (${r.durationSeconds}s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setTarget = useMutation({
    mutationFn: ({ videoId, durationTarget }: { videoId: string; durationTarget: number }) =>
      setTargetFn({ data: { videoId, durationTarget } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channel-videos", id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useServerFn(setVideoApproval);
  const approving = useMutation({
    mutationFn: async ({ videoId, approved }: { videoId: string; approved: boolean }) =>
      (await approve({ data: { videoId, approved } })) as {
        published?: boolean;
        url?: string;
        error?: string;
      },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["channel-videos", id] });
      qc.invalidateQueries({ queryKey: ["queue"] });
      if (r?.published && r.url) toast.success(`Published publicly — ${r.url}`);
      else if (r?.error) toast.error(`Approved, but publishing failed: ${r.error}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });


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
      <AppShell title="Chamele-on-air - adapt · transform · go viral">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  const bp = channel.blueprints as { name?: string; confidence?: number } | null;
  const brand = channel.brands as { name?: string } | null;

  return (
    <AppShell
      title="Chamele-on-air - adapt · transform · go viral"
      subtitle={`${channel.name} · ${bp?.name ?? "no blueprint"} · ${brand?.name ?? "no brand"} · divergence ${Number(channel.divergence)}% · ${Number(channel.uploads_per_week)} uploads/week`}
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
      <Card className="mb-6 spectrum-border">
        <CardHeader>
          <CardTitle className="text-base">YouTube destination</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {channel.connected ? (
            <>
              <Badge>Connected</Badge>
              <p className="text-sm text-muted-foreground">
                Uploads go to {channel.youtube_title ?? channel.youtube_channel_id ?? "your channel"} as
                private videos you can flip public.
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => disconnecting.mutate()}
                disabled={disconnecting.isPending}
              >
                <Unlink className="mr-1 size-4" /> Disconnect
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {ready?.oauth
                  ? "Not connected. Authorise this channel once and the queue can publish on its own."
                  : "Add your Google OAuth client id and secret to enable publishing."}
              </p>
              <Button
                size="sm"
                className="ml-auto"
                onClick={startYouTubeConnection}
                disabled={connecting.isPending || !ready?.oauth}
              >
                {connecting.isPending ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Link2 className="mr-1 size-4" />
                )}
                Connect YouTube
              </Button>
            </>
          )}
        </CardContent>
      </Card>

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
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={String(v.duration_target ?? 30)}
                        onValueChange={(val) =>
                          setTarget.mutate({ videoId: v.id, durationTarget: Number(val) })
                        }
                        disabled={setTarget.isPending || rendering.isPending || Boolean(v.video_url)}
                      >
                        <SelectTrigger className="h-8 w-24 text-xs" aria-label="Target video length">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30s</SelectItem>
                          <SelectItem value="45">45s</SelectItem>
                          <SelectItem value="60">60s</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          rendering.mutate({ videoId: v.id, durationTarget: v.duration_target ?? 30 })
                        }
                        disabled={rendering.isPending || Boolean(v.video_url)}
                      >
                        {rendering.isPending ? (
                          <Loader2 className="mr-1 size-4 animate-spin" />
                        ) : (
                          <Film className="mr-1 size-4" />
                        )}
                        {v.video_url ? `Video rendered (${v.duration_seconds}s)` : "Render video"}
                      </Button>
                      <Button
                        size="sm"
                        variant={v.approved ? "outline" : "default"}
                        onClick={() => approving.mutate({ videoId: v.id, approved: !v.approved })}
                        disabled={approving.isPending}
                      >
                        {approving.isPending
                          ? "Publishing…"
                          : v.approved
                            ? "Approved — revoke"
                            : "Approve & publish"}
                      </Button>
                    </div>
                    {v.render_status === "rendering" ? (
                      <p className="text-xs text-muted-foreground">
                        Rendering {v.duration_target ?? 30}s video… this takes several minutes.
                      </p>
                    ) : null}
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
