import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Tv } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { youtubePendingChannels, youtubePickChannel } from "@/lib/publish.functions";

export const Route = createFileRoute("/youtube-picker")({
  validateSearch: (search: Record<string, unknown>) => ({
    state: String(search.state ?? ""),
  }),
  head: () => ({
    meta: [
      { title: "Pick YouTube channel — chamele-on-air" },
      { name: "description", content: "Choose which YouTube channel to connect." },
    ],
  }),
  component: YouTubePicker,
});

function YouTubePicker() {
  const { state } = Route.useSearch();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>("");

  const pending = useServerFn(youtubePendingChannels);
  const pick = useServerFn(youtubePickChannel);

  const { data, isLoading, error } = useQuery({
    queryKey: ["youtube-pending", state],
    queryFn: () => pending({ data: { state } }),
    enabled: Boolean(state),
  });

  const choosing = useMutation({
    mutationFn: async (youtubeChannelId: string) => {
      return pick({ data: { state, youtubeChannelId } });
    },
    onSuccess: (result) => {
      toast.success(`Connected to “${result.title}”.`);
      // If opened as a popup, close and tell the parent to refresh.
      if (window.opener) {
        window.opener.postMessage({ type: "youtube-connected", channelId: result.channelId }, "*");
        window.close();
      } else {
        navigate({ to: "/channels/$id", params: { id: result.channelId } });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!state) {
    return (
      <AppShell title="No selection link">
        <p className="text-sm text-muted-foreground">Missing OAuth state. Start the connection again.</p>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell title="Loading channels">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Fetching your YouTube channels…
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="Link expired">
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Could not load the channel picker."}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Pick a YouTube channel"
      subtitle="This Google account has more than one YouTube channel. Choose which one to link to this app channel."
    >
      <div className="mx-auto grid max-w-2xl gap-4">
        {data.channels.map((c) => (
          <Card
            key={c.id}
            className={`cursor-pointer transition-colors hover:border-primary/50 ${
              selected === c.id ? "border-primary ring-1 ring-primary" : ""
            }`}
            onClick={() => setSelected(c.id)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              {c.thumbnail ? (
                <img
                  src={c.thumbnail}
                  alt=""
                  className="size-12 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="grid size-12 place-items-center rounded-full bg-secondary">
                  <Tv className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.id}</p>
              </div>
              {selected === c.id ? (
                <Check className="size-5 text-primary" />
              ) : null}
            </CardContent>
          </Card>
        ))}
        <Button
          className="w-full"
          disabled={!selected || choosing.isPending}
          onClick={() => choosing.mutate(selected)}
        >
          {choosing.isPending ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Check className="mr-1 size-4" />
          )}
          Connect selected channel
        </Button>
      </div>
    </AppShell>
  );
}
