/**
 * GET /api/board - Get current board
 * POST /api/board/intent - Create intent
 * PUT /api/board/intent/:id - Update intent
 * DELETE /api/board/intent/:id - Delete intent
 */

import { NextRequest, NextResponse } from "next/server";
import { boardStore } from "@/lib/boardStore";
import { vectorIndex } from "@/lib/vectorIndex";
import { Intent, CreateIntentRequest } from "@/types/board";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const board = boardStore.getBoard();
    return NextResponse.json(board);
  } catch (error) {
    console.error("Error fetching board:", error);
    return NextResponse.json(
      { error: "Failed to fetch board" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === "createIntent") {
      const createReq = data as CreateIntentRequest;
      const boardId = boardStore.getBoard().id;
      const intent: Intent = {
        id: uuidv4(),
        boardId,
        title: createReq.title,
        description: createReq.description,
        domain: createReq.domain,
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
        artifacts: [],
      };

      const created = boardStore.createIntent(intent);

      // Index artifacts associated with intent
      created.artifacts.forEach((a) => vectorIndex.indexArtifact(a));

      return NextResponse.json({ intent: created });
    }

    if (action === "updateIntent") {
      if (!data?.intentId) {
        return NextResponse.json({ error: "Missing intentId" }, { status: 400 });
      }
      const { intentId, ...updates } = data;
      const updated = boardStore.updateIntent(intentId, updates);
      return NextResponse.json({ intent: updated });
    }

    if (action === "deleteIntent") {
      if (!data?.intentId) {
        return NextResponse.json({ error: "Missing intentId" }, { status: 400 });
      }
      const { intentId } = data;
      // Remove the intent's artifacts from the vector index before deletion
      const intentToDelete = boardStore.getIntent(intentId);
      intentToDelete?.artifacts.forEach((a) => vectorIndex.remove(a.id));
      boardStore.deleteIntent(intentId);
      return NextResponse.json({ success: true });
    }

    if (action === "resetBoard") {
      const { title, description } = data || {};
      const freshBoard = boardStore.resetBoard(title, description);
      vectorIndex.clear();
      return NextResponse.json({ board: freshBoard });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing board request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
