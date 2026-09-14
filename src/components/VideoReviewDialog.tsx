import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reviewVideo } from "@/lib/review.functions";
import { setVideoApproval } from "@/lib/console.functions";

/**
 * Review-before-approve pass: shows the script, hook, thumbnail prompt and a
 * temporary preview of the rendered file, then green-lights the video.
 * Approving does not schedule — that stays an explicit second step.
 */
export function VideoReviewDialog({
  videoId,
  open,
  onOpenChange,
}: {
  videoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const review = useServerFn(reviewVideo);
  const approve = useServerFn(setVideoApproval);

  const { data, isPending, error } = useQuery({
    queryKey: ["review", videoId],
    enabled: open && Boolean(videoId),
    queryFn: () => review({ data: { videoId: videoId as string } }),
  });

  const approving = useMutation({
    mutationFn: (approved: boolean) =>
      approve({ data: { videoId: videoId as string, approved } }),
    onSuccess: (r, approved) => {
      qc.invalidateQueries();
      if (!approved) {
        toast.success("Approval removed.");
        return;
      }
      if (r.published) {
        toast.success(r.url ? `Live: ${r.url}` : "Published to YouTube.");
      } else if (r.error) {
        toast.error(`Approved, but the YouTube upload failed: ${r.error}`);
      } else {
        toast.success("Approved.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const v = data?.video;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base">{v?.title ?? "Review video"}</DialogTitle>
          <DialogDescription>
            Read the script and watch the render before you green-light it.
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading review…
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{(error as Error).message}</p>
        ) : data ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant={data.rendered ? "default" : "secondary"}>
                {data.rendered ? "Rendered" : `Render: ${v?.render_status ?? "pending"}`}
              </Badge>
              <Badge variant={data.approved ? "default" : "secondary"}>
                {data.approved ? "Approved" : "Not approved"}
              </Badge>
              {v?.duration_seconds ? <Badge variant="secondary">{v.duration_seconds}s</Badge> : null}
              <Badge variant="secondary">{data.channel.name}</Badge>
            </div>

            {data.preview_url ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={data.preview_url}
                controls
                className="w-full rounded-lg border border-border bg-black"
              />
            ) : null}

            {v?.hook ? (
              <section>
                <h3 className="mb-1 font-medium">Hook</h3>
                <p className="text-muted-foreground">{v.hook}</p>
              </section>
            ) : null}

            {v?.script ? (
              <section>
                <h3 className="mb-1 font-medium">Script</h3>
                <p className="whitespace-pre-wrap text-muted-foreground">{v.script}</p>
              </section>
            ) : null}

            {v?.thumbnail_prompt ? (
              <section>
                <h3 className="mb-1 font-medium">Thumbnail direction</h3>
                <p className="text-muted-foreground">{v.thumbnail_prompt}</p>
              </section>
            ) : null}

            <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">{data.next}</p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex gap-2">
            {data?.approved ? (
              <Button
                variant="secondary"
                onClick={() => approving.mutate(false)}
                disabled={approving.isPending}
              >
                <X className="mr-1 size-4" /> Remove approval
              </Button>
            ) : (
              <Button
                onClick={() => approving.mutate(true)}
                disabled={approving.isPending || !data?.rendered}
              >
                {approving.isPending ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Check className="mr-1 size-4" />
                )}
                Approve
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
