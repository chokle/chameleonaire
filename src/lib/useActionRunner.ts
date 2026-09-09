import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { ActionCard } from "./recommendations";
import { runScan } from "./scan.functions";
import { extractBlueprint } from "./blueprint.functions";
import { chameleonize } from "./chameleon.functions";
import { renderVideo, publishNow } from "./publish.functions";
import { setVideoApproval } from "./console.functions";
import { startAutopilot, scheduleVideo } from "./autopilot.functions";

/** One place that knows how to actually run a recommended action card. */
export function useActionRunner(onDone?: () => void) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);

  const scan = useServerFn(runScan);
  const extract = useServerFn(extractBlueprint);
  const generate = useServerFn(chameleonize);
  const render = useServerFn(renderVideo);
  const approve = useServerFn(setVideoApproval);
  const publish = useServerFn(publishNow);
  const schedule = useServerFn(scheduleVideo);
  const autopilot = useServerFn(startAutopilot);

  const run = async (card: ActionCard) => {
    const p = card.params as Record<string, never>;
    setRunning(card.id);
    try {
      switch (card.kind) {
        case "run_scan": {
          const res = await scan({
            data: {
              niche: String(p["niche"] ?? "finance"),
              min: Number(p["min"] ?? 2000),
              max: (p["max"] ?? null) as number | null,
              count: 12,
              persistent: false,
              datasetId: null,
            },
          });
          toast.success(`Scan complete — ${res.found} earners surfaced.`);
          break;
        }
        case "extract_blueprint": {
          const bp = await extract({ data: { creatorIds: (p["creatorIds"] ?? []) as unknown as string[] } });
          toast.success(`Blueprint extracted at ${Math.round(Number(bp.confidence))}% confidence.`);
          break;
        }
        case "generate_videos": {
          const res = await generate({
            data: { channelId: String(p["channelId"]), count: Number(p["count"] ?? 3) },
          });
          toast.success(`${res.created} evergreen videos written.`);
          break;
        }
        case "render_video": {
          toast.info("Rendering — this takes a few minutes.");
          const res = await render({
            data: { videoId: String(p["videoId"]), durationTarget: Number(p["durationTarget"] ?? 30) },
          });
          toast.success(`Rendered ${res.durationSeconds}s of video.`);
          break;
        }
        case "approve_video": {
          await approve({ data: { videoId: String(p["videoId"]), approved: true } });
          toast.success("Approved.");
          break;
        }
        case "publish_video": {
          const res = await publish({ data: { queueId: String(p["queueId"]) } });
          toast.success(`Published: ${res.url}`);
          break;
        }
        case "autopilot": {
          toast.info("Autopilot running — scanning, decoding and writing.");
          const res = await autopilot({
            data: {
              niche: String(p["niche"] ?? "finance"),
              min: 2000,
              max: 10000,
              videoCount: 3,
              durationTarget: 30,
              mode: "plan",
            },
          });
          toast.success(res.steps.map((s) => s.detail).join(" "));
          break;
        }
        case "connect_youtube":
          navigate({ to: "/channels/$id", params: { id: String(p["channelId"]) } });
          break;
        case "create_brand":
          navigate({ to: "/brands" });
          break;
        case "spawn_channel":
          navigate({ to: "/channels" });
          break;
      }
      await qc.invalidateQueries();
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That action failed.");
    } finally {
      setRunning(null);
    }
  };

  return { run, running, scheduleVideo: schedule };
}
