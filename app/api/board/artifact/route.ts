/**
 * POST /api/board/artifact - body { action, data }
 *   action: createArtifact | updateArtifact | deleteArtifact
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { boardStore } from "@/lib/boardStore";
import { vectorIndex } from "@/lib/vectorIndex";
import { Artifact } from "@/types/board";
import { v4 as uuidv4 } from "uuid";
import { rateLimit, readJsonBody } from "@/lib/apiGuard";

// A saved component is 15-35 KB. The cap leaves room for large ones.
const MAX_BODY_BYTES = 512 * 1024;
const MAX_CONTENT_CHARS = 300_000;

const ArtifactType = z.enum(["decision", "constraint", "preference", "prototype", "specArtifact", "taskUI"]);

const CreateArtifactSchema = z.object({
  type: ArtifactType,
  title: z.string().max(500),
  content: z.string().max(MAX_CONTENT_CHARS),
  intentId: z.string().max(100).nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Only these fields can change. Callers cannot overwrite id, createdAt or updatedAt.
const UpdateArtifactSchema = z.object({
  artifactId: z.string().min(1).max(100),
  type: ArtifactType.optional(),
  title: z.string().max(500).optional(),
  content: z.string().max(MAX_CONTENT_CHARS).optional(),
  intentId: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ArtifactIdSchema = z.object({ artifactId: z.string().min(1).max(100) });

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, "artifact-write", 60, 60_000);
  if (limited) return limited;

  const raw = await readJsonBody(request, MAX_BODY_BYTES);
  if (!raw.ok) return raw.response;

  try {
    const { action, data } = (raw.data ?? {}) as { action?: string; data?: unknown };

    if (action === "createArtifact") {
      const parsed = CreateArtifactSchema.safeParse(data);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid artifact" }, { status: 400 });
      }
      const createReq = parsed.data;
      const artifact: Artifact = {
        id: uuidv4(),
        type: createReq.type,
        title: createReq.title,
        content: createReq.content,
        createdAt: new Date(),
        updatedAt: new Date(),
        intentId: createReq.intentId ?? undefined,
        ...(createReq.metadata ? { metadata: createReq.metadata } : {}),
      };

      const created = boardStore.createArtifact(artifact);
      vectorIndex.indexArtifact(created);

      return NextResponse.json({ artifact: created });
    }

    if (action === "updateArtifact") {
      const parsed = UpdateArtifactSchema.safeParse(data);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid artifact update" }, { status: 400 });
      }
      const { artifactId, ...updates } = parsed.data;
      const updated = boardStore.updateArtifact(artifactId, updates);
      vectorIndex.indexArtifact(updated);
      return NextResponse.json({ artifact: updated });
    }

    if (action === "deleteArtifact") {
      const parsed = ArtifactIdSchema.safeParse(data);
      if (!parsed.success) {
        return NextResponse.json({ error: "Missing artifactId" }, { status: 400 });
      }
      boardStore.deleteArtifact(parsed.data.artifactId);
      vectorIndex.remove(parsed.data.artifactId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing artifact request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
