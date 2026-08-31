import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ExtractInput = z.object({
  creatorIds: z.array(z.string().uuid()).min(1).max(8),
  name: z.string().min(1).max(120).optional(),
});

export const extractBlueprint = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data }) => {
    const { buildBlueprint } = await import("./blueprint.server");
    return buildBlueprint(data.creatorIds, data.name);
  });

const RefineInput = z.object({ blueprintId: z.string().uuid() });

export const refineBlueprint = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RefineInput.parse(input))
  .handler(async ({ data }) => {
    const { evolveBlueprint } = await import("./blueprint.server");
    return evolveBlueprint(data.blueprintId);
  });
