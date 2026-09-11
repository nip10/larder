import { z } from "zod";

import { draftOrderFor } from "@/lib/reorder";

const bodySchema = z.object({ supplierId: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const result = await draftOrderFor(parsed.data.supplierId);
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
