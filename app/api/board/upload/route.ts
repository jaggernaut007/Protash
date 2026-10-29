/**
 * POST /api/board/upload - Upload file to board
 */

import { NextRequest, NextResponse } from "next/server";
import { boardStore } from "@/lib/boardStore";
import { vectorIndex } from "@/lib/vectorIndex";
import { UploadedFile } from "@/types/board";
import { v4 as uuidv4 } from "uuid";
import { rateLimit } from "@/lib/apiGuard";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file
const MAX_FILE_COUNT = 20;
// Uploads live in memory on a 512Mi instance, so the total is capped.
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, "upload", 10, 60_000);
  if (limited) return limited;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    // A text field named "file" is not a File. Reject it before reading its size.
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
        { status: 413 }
      );
    }

    const stored = boardStore.getAllUploadedFiles();
    const storedBytes = stored.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0);
    if (stored.length >= MAX_FILE_COUNT || storedBytes + file.size > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "Upload limit reached. Remove files or reset the board." },
        { status: 413 }
      );
    }

    // Read file content
    const content = await file.text();

    // Create uploaded file entry
    const fileId = uuidv4();
    const uploadedFile: UploadedFile = {
      id: fileId,
      name: file.name,
      type: file.type,
      content,
      uploadedAt: new Date(),
      boardId: boardStore.getBoard().id,
    };

    // Store file
    boardStore.saveUploadedFile(uploadedFile);

    // Index file for search
    vectorIndex.indexFile(uploadedFile);

    return NextResponse.json({
      fileId,
      name: file.name,
      indexed: true,
    });
  } catch (error) {
    console.error("Error during file upload:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
