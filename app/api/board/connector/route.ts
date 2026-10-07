/**
 * POST /api/board/connector - Toggle connector
 * GET  /api/board/connector - Get enabled connectors
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boardStore } from "@/lib/boardStore";
import { rateLimit, readJsonBody } from "@/lib/apiGuard";

const ToggleSchema = z.object({
  connectorId: z.string().min(1).max(100),
  enabled: z.boolean(),
});

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, "connector-write", 60, 60_000);
  if (limited) return limited;

  const raw = await readJsonBody(request, 4 * 1024);
  if (!raw.ok) return raw.response;

  const parsed = ToggleSchema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const updated = boardStore.toggleConnector(
      parsed.data.connectorId,
      parsed.data.enabled
    );

    return NextResponse.json({ connector: updated });
  } catch (error) {
    console.error("Error toggling connector:", error);
    return NextResponse.json(
      { error: "Failed to toggle connector" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const connectors = boardStore.getEnabledConnectors();
    return NextResponse.json({ connectors });
  } catch (error) {
    console.error("Error fetching connectors:", error);
    return NextResponse.json(
      { error: "Failed to fetch connectors" },
      { status: 500 }
    );
  }
}
