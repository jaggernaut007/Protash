/**
 * POST /api/board/upload - Upload file to board
 */

import { NextRequest, NextResponse } from "next/server";
import { boardStore } from "@/lib/boardStore";
import { vectorIndex } from "@/lib/vectorIndex";
import { UploadedFile } from "@/types/board";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB." },
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
