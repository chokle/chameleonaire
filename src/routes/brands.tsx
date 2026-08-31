import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brandsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/brands")({
  head: () => ({
    meta: [
      { title: "Brands — chamele-on-air" },
      {
        name: "description",
        content: "Define the identity every chameleonized video belongs to: voice, subject, palette and audience.",
      },
      { property: "og:title", content: "Your brand identities" },
      { property: "og:description", content: "The skin the winning structure gets wrapped in." },
    ],
  }),
  component: Brands,
});

const EMPTY = { name: "", voice: "", subject: "", palette: "", audience: "", banned_topics: "" };

function Brands() {
  const qc = useQueryClient();
  const { data } = useQuery(brandsQuery);
  const [form, setForm] = useState(EMPTY);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("brands").insert(form);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Brand saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AppShell
      title="Brands"
      subtitle="A blueprint supplies the structure. A brand supplies the identity — so the output is unmistakably yours."
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit spectrum-border">
          <CardHeader>
            <CardTitle className="text-base">New brand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={set("name")} placeholder="Quiet Capital" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={set("subject")}
                placeholder="index investing for people who hate finance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice">Voice</Label>
              <Textarea
                id="voice"
                value={form.voice}
                onChange={set("voice")}
                placeholder="calm, dry humour, no hype, short sentences"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="palette">Visual palette</Label>
              <Input
                id="palette"
                value={form.palette}
                onChange={set("palette")}
                placeholder="off-black, bone white, single acid green accent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Input
                id="audience"
                value={form.audience}
                onChange={set("audience")}
                placeholder="25-40, first real salary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banned">Never cover</Label>
              <Input
                id="banned"
                value={form.banned_topics}
                onChange={set("banned_topics")}
                placeholder="crypto, get-rich-quick"
              />
            </div>
            <Button
              className="w-full"
              disabled={!form.name.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              <Plus className="mr-1 size-4" /> Save brand
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {(data ?? []).length === 0 ? (
            <Card className="sm:col-span-2">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No brands yet. Create one to give your spawned channels an identity.
              </CardContent>
            </Card>
          ) : (
            (data ?? []).map((b) => (
              <Card key={b.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg font-semibold">{b.name}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove.mutate(b.id)}
                      aria-label={`Delete ${b.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    {[
                      ["Subject", b.subject],
                      ["Voice", b.voice],
                      ["Palette", b.palette],
                      ["Audience", b.audience],
                      ["Never cover", b.banned_topics],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k as string}>
                          <dt className="text-xs uppercase tracking-widest text-muted-foreground">{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                  </dl>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
