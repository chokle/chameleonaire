import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateVideoMetadata } from "@/lib/console.functions";

export type QueueVideoMeta = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  locked: boolean;
};

/** Edits the title, description and tags YouTube shows on the published upload. */
export function QueueMetadataDialog({
  video,
  open,
  onOpenChange,
}: {
  video: QueueVideoMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(updateVideoMetadata);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (!video) return;
    setTitle(video.title ?? "");
    setDescription(video.description ?? "");
    setTags((video.tags ?? []).join(", "));
  }, [video]);

  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          videoId: video?.id as string,
          title: title.trim(),
          description: description.trim(),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 15),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Saved — this is what YouTube will show.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">YouTube details</DialogTitle>
          <DialogDescription>
            {video?.locked
              ? "This video is already on YouTube — edits here won't change the live listing."
              : "Exactly what viewers will see on YouTube when this goes out."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meta-title">Title</Label>
            <Input
              id="meta-title"
              value={title}
              maxLength={95}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{title.length}/95</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meta-desc">Description</Label>
            <Textarea
              id="meta-desc"
              rows={7}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the video covers, plus any links you want under it."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meta-tags">Tags (comma separated, up to 15)</Label>
            <Input id="meta-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => saving.mutate()}
            disabled={saving.isPending || !title.trim() || !video}
          >
            {saving.isPending ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Save className="mr-1 size-4" />
            )}
            Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
