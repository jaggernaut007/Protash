/**
 * POST /api/board/connector - Toggle connector
 * GET /api/board/connectors - Get enabled connectors
 */

import { NextRequest, NextResponse } from "next/server";
import { boardStore } from "@/lib/boardStore";
import { ConnectorToggleRequest } from "@/types/board";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const toggleReq = body as ConnectorToggleRequest;

    const updated = boardStore.toggleConnector(
      toggleReq.connectorId,
      toggleReq.enabled
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
