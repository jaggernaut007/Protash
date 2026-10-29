/**
 * GET  /api/board - Get current board
 * POST /api/board - body { action, data }
 *   action: createIntent | updateIntent | deleteIntent | resetBoard
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boardStore } from "@/lib/boardStore";
import { vectorIndex } from "@/lib/vectorIndex";
import { Intent } from "@/types/board";
import { v4 as uuidv4 } from "uuid";
import { rateLimit, readJsonBody } from "@/lib/apiGuard";

const MAX_BODY_BYTES = 64 * 1024;

const CreateIntentSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(8000),
  domain: z.string().max(100).optional(),
});

// Only these fields can change. Callers cannot overwrite id, boardId, artifacts or createdAt.
const UpdateIntentSchema = z.object({
  intentId: z.string().min(1).max(100),
  title: z.string().max(200).optional(),
  description: z.string().max(8000).optional(),
  domain: z.string().max(100).optional(),
  status: z.enum(["draft", "active", "resolved", "archived"]).optional(),
});

const IntentIdSchema = z.object({ intentId: z.string().min(1).max(100) });

const ResetBoardSchema = z
  .object({ title: z.string().max(200).optional(), description: z.string().max(2000).optional() })
  .default({});

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
  const limited = rateLimit(request, "board-write", 60, 60_000);
  if (limited) return limited;

  const raw = await readJsonBody(request, MAX_BODY_BYTES);
  if (!raw.ok) return raw.response;

  try {
    const { action, data } = (raw.data ?? {}) as { action?: string; data?: unknown };

    if (action === "createIntent") {
      const parsed = CreateIntentSchema.safeParse(data);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid intent" }, { status: 400 });
      }
      const boardId = boardStore.getBoard().id;
      const intent: Intent = {
        id: uuidv4(),
        boardId,
        title: parsed.data.title,
        description: parsed.data.description,
        domain: parsed.data.domain,
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
      const parsed = UpdateIntentSchema.safeParse(data);
      if (!parsed.success) {
        return NextResponse.json({ error: "Missing intentId" }, { status: 400 });
      }
      const { intentId, ...updates } = parsed.data;
      const updated = boardStore.updateIntent(intentId, updates);
      return NextResponse.json({ intent: updated });
    }

    if (action === "deleteIntent") {
      const parsed = IntentIdSchema.safeParse(data);
      if (!parsed.success) {
        return NextResponse.json({ error: "Missing intentId" }, { status: 400 });
      }
      const { intentId } = parsed.data;
      // Remove the intent's artifacts from the vector index before deletion
      const intentToDelete = boardStore.getIntent(intentId);
      intentToDelete?.artifacts.forEach((a) => vectorIndex.remove(a.id));
      boardStore.deleteIntent(intentId);
      return NextResponse.json({ success: true });
    }

    if (action === "resetBoard") {
      const parsed = ResetBoardSchema.safeParse(data ?? undefined);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const freshBoard = boardStore.resetBoard(parsed.data.title, parsed.data.description);
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
