/**
 * POST /api/board/search - Search board artifacts via RAG
 */

import { NextRequest, NextResponse } from "next/server";
import { boardStore } from "@/lib/boardStore";
import { vectorIndex } from "@/lib/vectorIndex";
import { z } from "zod";
import { rateLimit, readJsonBody } from "@/lib/apiGuard";

// The UI sends the intent text (up to 4000 chars) as the query.
const SearchSchema = z.object({
  query: z.string().max(5000),
  limit: z.number().int().min(1).max(50).optional(),
  type: z
    .enum(["decision", "constraint", "preference", "prototype", "specArtifact", "taskUI"])
    .optional(),
});

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, "search", 60, 60_000);
  if (limited) return limited;

  const raw = await readJsonBody(request, 16 * 1024);
  if (!raw.ok) return raw.response;

  const parsed = SearchSchema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search request" }, { status: 400 });
  }

  try {
    const searchReq = parsed.data;

    // Re-index artifacts (incremental: only artifacts, preserving file entries)
    const board = boardStore.getBoard();
    board.artifacts.forEach((a) => vectorIndex.indexArtifact(a));
    // Re-index uploaded files so they remain searchable
    boardStore.getAllUploadedFiles().forEach((f) => vectorIndex.indexFile(f));

    // Execute search
    const results = vectorIndex.search(
      searchReq.query,
      searchReq.limit || 10,
      searchReq.type
    );

    // Enrich results with full artifact data
    const enrichedResults = results
      .map((r) => boardStore.getArtifact(r.id))
      .filter((a) => a !== undefined) as typeof board.artifacts;

    return NextResponse.json({
      results: enrichedResults,
      total: enrichedResults.length,
    });
  } catch (error) {
    console.error("Error during search:", error);
    return NextResponse.json(
      { error: "Failed to search" },
      { status: 500 }
    );
  }
}
