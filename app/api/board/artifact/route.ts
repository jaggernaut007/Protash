/**
 * POST /api/board/artifact - Create artifact
 * PUT /api/board/artifact/:id - Update artifact
 * DELETE /api/board/artifact/:id - Delete artifact
 */

import { NextRequest, NextResponse } from "next/server";
import { boardStore } from "@/lib/boardStore";
import { vectorIndex } from "@/lib/vectorIndex";
import { Artifact, CreateArtifactRequest } from "@/types/board";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === "createArtifact") {
      const createReq = data as CreateArtifactRequest;
      const artifact: Artifact = {
        id: uuidv4(),
        type: createReq.type,
        title: createReq.title,
        content: createReq.content,
        createdAt: new Date(),
        updatedAt: new Date(),
        intentId: createReq.intentId,
        ...(createReq.metadata ? { metadata: createReq.metadata } : {}),
      };

      const created = boardStore.createArtifact(artifact);
      vectorIndex.indexArtifact(created);

      return NextResponse.json({ artifact: created });
    }

    if (action === "updateArtifact") {
      const { artifactId, ...updates } = data;
      const updated = boardStore.updateArtifact(artifactId, updates);
      vectorIndex.indexArtifact(updated);
      return NextResponse.json({ artifact: updated });
    }

    if (action === "deleteArtifact") {
      const { artifactId } = data;
      boardStore.deleteArtifact(artifactId);
      vectorIndex.remove(artifactId);
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
