import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BRACKETS, NICHE_RPM } from "@/lib/domain";
import { startAutopilot } from "@/lib/autopilot.functions";
import { Rocket, CheckCircle2, CircleSlash, XCircle } from "lucide-react";

type Step = { step: string; status: "done" | "skipped" | "failed"; detail: string };

/** The one button: pick a niche and a bracket, everything else runs itself. */
export function StartEarning() {
  const qc = useQueryClient();
  const run = useServerFn(startAutopilot);
  const [niche, setNiche] = useState("finance");
  const [bracket, setBracket] = useState("proven");
  const [publishIt, setPublishIt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  const go = async () => {
    const b = BRACKETS.find((x) => x.id === bracket) ?? BRACKETS[2]!;
    setBusy(true);
    setSteps([]);
    try {
      const res = await run({
        data: {
          niche,
          min: b.min,
          max: b.max,
          videoCount: 3,
          durationTarget: 30,
          mode: publishIt ? "full" : "plan",
        },
      });
      setSteps(res.steps as Step[]);
      await qc.invalidateQueries();
      toast.success(res.publishedUrl ? "Your first video is live (private)." : "Your pipeline is loaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Autopilot could not finish.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="spectrum-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="size-4 text-primary" /> Start earning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pick a niche and how much a video should be worth. It finds who is winning, decodes the formula,
          writes evergreen videos in your voice and loads them ready to go.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Niche</Label>
            <Select value={niche} onValueChange={setNiche}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(NICHE_RPM).map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Earnings per video</Label>
            <Select value={bracket} onValueChange={setBracket}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRACKETS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
          <Switch id="publish-it" checked={publishIt} onCheckedChange={setPublishIt} />
          <Label htmlFor="publish-it" className="text-sm font-normal text-muted-foreground">
            Also render and upload the first video (private) when it is ready
          </Label>
        </div>
        <Button className="w-full" size="lg" onClick={go} disabled={busy}>
          {busy ? "Working — this takes a few minutes…" : "Start earning"}
        </Button>

        {steps.length > 0 && (
          <ul className="space-y-2 rounded-lg border border-border/70 p-3">
            {steps.map((s) => (
              <li key={s.step} className="flex items-start gap-2 text-sm">
                {s.status === "done" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : s.status === "skipped" ? (
                  <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <span className="text-muted-foreground">{s.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
