import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { channelsQuery } from "@/lib/queries";
import {
  createVideoFromTemplate,
  deleteTemplate,
  generateColdOpen,
  listTemplates,
  saveTemplate,
} from "@/lib/templates.functions";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Video templates — chamele-on-air" },
      {
        name: "description",
        content:
          "Write your script, hook and visual direction up front, then turn a template into a draft video ready to render.",
      },
      { property: "og:title", content: "Video templates" },
      {
        property: "og:description",
        content: "Script and visuals decided before anything renders.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Templates,
});

type Draft = {
  id: string | null;
  name: string;
  title: string;
  hook: string;
  script: string;
  description: string;
  tags: string;
  visual_style: string;
  palette: string;
  pacing: string;
  shot_notes: string;
  thumbnail_prompt: string;
  duration_target: number;
};

const EMPTY: Draft = {
  id: null,
  name: "",
  title: "",
  hook: "",
  script: "",
  description: "",
  tags: "",
  visual_style: "",
  palette: "",
  pacing: "",
  shot_notes: "",
  thumbnail_prompt: "",
  duration_target: 30,
};

function Templates() {
  const qc = useQueryClient();
  const list = useServerFn(listTemplates);
  const save = useServerFn(saveTemplate);
  const remove = useServerFn(deleteTemplate);
  const toVideo = useServerFn(createVideoFromTemplate);

  const { data: templates } = useQuery({
    queryKey: ["video-templates"],
    queryFn: () => list({}),
  });
  const { data: channels } = useQuery(channelsQuery);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [channelId, setChannelId] = useState<string>("");
  const [alternates, setAlternates] = useState<string[]>([]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const coldOpen = useServerFn(generateColdOpen);
  const writingHook = useMutation({
    mutationFn: () => coldOpen({ data: { script: draft.script, title: draft.title } }),
    onSuccess: (r: { coldOpen: string; alternates: string[] }) => {
      set({ hook: r.coldOpen });
      setAlternates(r.alternates ?? []);
      toast.success("Cold open written — swap in an alternate if you prefer.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...draft,
          tags: draft.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (r: { id: string }) => {
      qc.invalidateQueries({ queryKey: ["video-templates"] });
      set({ id: r.id });
      toast.success("Template saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleting = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-templates"] });
      setDraft(EMPTY);
      toast.success("Template deleted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const creating = useMutation({
    mutationFn: () => {
      if (!draft.id) throw new Error("Save the template first.");
      if (!channelId) throw new Error("Pick a channel.");
      return toVideo({ data: { templateId: draft.id, channelId } });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Draft video created — review and render it in Studio.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Video templates"
      subtitle="Write the script and pick the visuals before anything renders."
      action={
        <Button variant="secondary" onClick={() => setDraft(EMPTY)}>
          <Plus className="mr-1 size-4" /> New template
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {draft.id ? "Edit template" : "New template"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Template name</Label>
                <Input
                  id="tpl-name"
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Evergreen money trap"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-title">Video title</Label>
                <Input
                  id="tpl-title"
                  value={draft.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="Why most savers lose $40,000 to fees"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-hook">Hook (first 8 seconds)</Label>
              <Textarea
                id="tpl-hook"
                rows={2}
                value={draft.hook}
                onChange={(e) => set({ hook: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-script">Script</Label>
              <Textarea
                id="tpl-script"
                rows={10}
                value={draft.script}
                onChange={(e) => set({ script: e.target.value })}
                placeholder="Full spoken script — keep it evergreen: no dates, news or trends."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-style">Visual style</Label>
                <Input
                  id="tpl-style"
                  value={draft.visual_style}
                  onChange={(e) => set({ visual_style: e.target.value })}
                  placeholder="Cinematic b-roll, tight close-ups"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-palette">Palette</Label>
                <Input
                  id="tpl-palette"
                  value={draft.palette}
                  onChange={(e) => set({ palette: e.target.value })}
                  placeholder="Deep green, warm gold, high contrast"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-pacing">Pacing</Label>
                <Input
                  id="tpl-pacing"
                  value={draft.pacing}
                  onChange={(e) => set({ pacing: e.target.value })}
                  placeholder="Cut every 2s, no dead air"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-duration">Target length (seconds)</Label>
                <Input
                  id="tpl-duration"
                  type="number"
                  min={8}
                  max={120}
                  value={draft.duration_target}
                  onChange={(e) => set({ duration_target: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-shots">Shot notes</Label>
              <Textarea
                id="tpl-shots"
                rows={3}
                value={draft.shot_notes}
                onChange={(e) => set({ shot_notes: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-thumb">Thumbnail direction</Label>
              <Textarea
                id="tpl-thumb"
                rows={2}
                value={draft.thumbnail_prompt}
                onChange={(e) => set({ thumbnail_prompt: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-desc">Description</Label>
                <Textarea
                  id="tpl-desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-tags">Tags (comma separated)</Label>
                <Input
                  id="tpl-tags"
                  value={draft.tags}
                  onChange={(e) => set({ tags: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => saving.mutate()} disabled={saving.isPending || !draft.name}>
                {saving.isPending ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Save className="mr-1 size-4" />
                )}
                Save template
              </Button>

              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger className="w-56" aria-label="Channel">
                  <SelectValue placeholder="Send to channel…" />
                </SelectTrigger>
                <SelectContent>
                  {(channels ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="secondary"
                onClick={() => creating.mutate()}
                disabled={creating.isPending || !draft.id || !channelId}
              >
                {creating.isPending ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-1 size-4" />
                )}
                Create draft video
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Saved ({(templates ?? []).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {(templates ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No templates yet. Write one on the left and save it.
              </p>
            ) : (
              <ul className="space-y-2">
                {(templates ?? []).map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() =>
                        setDraft({
                          id: t.id,
                          name: t.name,
                          title: t.title,
                          hook: t.hook,
                          script: t.script,
                          description: t.description,
                          tags: (t.tags ?? []).join(", "),
                          visual_style: t.visual_style,
                          palette: t.palette,
                          pacing: t.pacing,
                          shot_notes: t.shot_notes,
                          thumbnail_prompt: t.thumbnail_prompt,
                          duration_target: t.duration_target,
                        })
                      }
                    >
                      {t.name}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => {
                        if (confirm(`Delete template "${t.name}"?`)) deleting.mutate(t.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
