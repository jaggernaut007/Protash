/**
 * Board store with deploy-safe persistence behavior.
 * - Local development defaults to file persistence in `.data/board.json`
 * - Hosted production defaults to in-memory storage unless explicitly overridden
 */

import * as fs from "fs";
import * as path from "path";
import {
  Board,
  Intent,
  Artifact,
  Connector,
  UploadedFile,
} from "@/types/board";

type BoardStorageMode = "file" | "memory";

// Create a new blank board with default connectors
function createNewBoard(title?: string, description?: string): Board {
  const boardId = `board-${Date.now()}`;
  return {
    id: boardId,
    title: title || "My Life Board",
    description: description || "Personal decision and goal tracking",
    createdAt: new Date(),
    updatedAt: new Date(),
    intents: [],
    artifacts: [],
    connectors: [
      {
        id: `conn-calendar-${boardId}`,
        type: "calendar",
        name: "Calendar",
        enabled: false,
        boardId,
      },
      {
        id: `conn-bank-${boardId}`,
        type: "bank",
        name: "Bank",
        enabled: false,
        boardId,
      },
      {
        id: `conn-wearable-${boardId}`,
        type: "wearable",
        name: "Wearable",
        enabled: false,
        boardId,
      },
      {
        id: `conn-docs-${boardId}`,
        type: "docs",
        name: "Documents",
        enabled: false,
        boardId,
      },
    ],
  };
}

const DATA_DIR = path.join(process.cwd(), ".data");
const BOARD_FILE = path.join(DATA_DIR, "board.json");
let warnedAboutMemoryMode = false;

function getBoardStorageMode(): BoardStorageMode {
  const envMode = process.env.BOARD_STORAGE_MODE?.trim().toLowerCase();

  if (envMode === "file" || envMode === "memory") {
    return envMode;
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return "memory";
  }

  return "file";
}

function usingFileStorage() {
  return getBoardStorageMode() === "file";
}

function logMemoryModeOnce() {
  if (!warnedAboutMemoryMode) {
    warnedAboutMemoryMode = true;
    console.warn(
      "[boardStore] BOARD_STORAGE_MODE=memory. Board data is ephemeral in this runtime."
    );
  }
}

// Ensure .data directory exists
function ensureDataDir() {
  if (!usingFileStorage()) {
    return;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Load board from file or create default
function loadBoard(): Board {
  if (!usingFileStorage()) {
    logMemoryModeOnce();
    return createNewBoard();
  }

  ensureDataDir();

  if (fs.existsSync(BOARD_FILE)) {
    try {
      const data = fs.readFileSync(BOARD_FILE, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to load board, creating new one:", error);
    }
  }

  const defaultBoard = createNewBoard();
  saveBoard(defaultBoard);
  return defaultBoard;
}

// Save board to file
function saveBoard(board: Board) {
  if (!usingFileStorage()) {
    currentBoard = board;
    logMemoryModeOnce();
    return;
  }

  ensureDataDir();
  fs.writeFileSync(BOARD_FILE, JSON.stringify(board, null, 2));
}

// In-memory state (loaded once)
let currentBoard: Board | null = null;
let uploadedFiles: Map<string, UploadedFile> = new Map();

function getBoard(): Board {
  if (!currentBoard) {
    currentBoard = loadBoard();
  }
  return currentBoard;
}

/**
 * Board Store API
 */

export const boardStore = {
  // Board operations
  getBoard: (): Board => {
    return getBoard();
  },

  updateBoardMetadata: (updates: Partial<Board>): Board => {
    const board = getBoard();
    const updated = {
      ...board,
      ...updates,
      updatedAt: new Date(),
    };
    currentBoard = updated;
    saveBoard(updated);
    return updated;
  },

  // Intent operations
  createIntent: (intent: Intent): Intent => {
    const board = getBoard();
    board.intents.push(intent);
    board.updatedAt = new Date();
    saveBoard(board);
    return intent;
  },

  getIntent: (intentId: string): Intent | undefined => {
    return getBoard().intents.find((i) => i.id === intentId);
  },

  updateIntent: (intentId: string, updates: Partial<Intent>): Intent => {
    const board = getBoard();
    const intent = board.intents.find((i) => i.id === intentId);
    if (!intent) throw new Error(`Intent ${intentId} not found`);

    const updated = {
      ...intent,
      ...updates,
      updatedAt: new Date(),
    };
    const index = board.intents.indexOf(intent);
    board.intents[index] = updated;
    board.updatedAt = new Date();
    saveBoard(board);
    return updated;
  },

  deleteIntent: (intentId: string): void => {
    const board = getBoard();
    board.intents = board.intents.filter((i) => i.id !== intentId);
    board.artifacts = board.artifacts.filter((a) => a.intentId !== intentId);
    board.updatedAt = new Date();
    saveBoard(board);
  },

  // Artifact operations
  createArtifact: (artifact: Artifact): Artifact => {
    const board = getBoard();
    board.artifacts.push(artifact);

    if (artifact.intentId) {
      const intent = board.intents.find((i) => i.id === artifact.intentId);
      if (intent) {
        intent.artifacts.push(artifact);
        intent.updatedAt = new Date();
      }
    }

    board.updatedAt = new Date();
    saveBoard(board);
    return artifact;
  },

  getArtifact: (artifactId: string): Artifact | undefined => {
    return getBoard().artifacts.find((a) => a.id === artifactId);
  },

  updateArtifact: (
    artifactId: string,
    updates: Partial<Artifact>
  ): Artifact => {
    const board = getBoard();
    const artifact = board.artifacts.find((a) => a.id === artifactId);
    if (!artifact) throw new Error(`Artifact ${artifactId} not found`);

    const updated = {
      ...artifact,
      ...updates,
      updatedAt: new Date(),
    };

    const index = board.artifacts.indexOf(artifact);
    board.artifacts[index] = updated;

    // If intentId changed, remove from the old intent's artifact list
    if (artifact.intentId && artifact.intentId !== updated.intentId) {
      const oldIntent = board.intents.find((i) => i.id === artifact.intentId);
      if (oldIntent) {
        oldIntent.artifacts = oldIntent.artifacts.filter((a) => a.id !== artifactId);
        oldIntent.updatedAt = new Date();
      }
    }

    if (updated.intentId) {
      const intent = board.intents.find((i) => i.id === updated.intentId);
      if (intent) {
        const intentArtifactIndex = intent.artifacts.findIndex(
          (a) => a.id === artifactId
        );
        if (intentArtifactIndex >= 0) {
          intent.artifacts[intentArtifactIndex] = updated;
        } else {
          intent.artifacts.push(updated);
        }
        intent.updatedAt = new Date();
      }
    }

    board.updatedAt = new Date();
    saveBoard(board);
    return updated;
  },

  deleteArtifact: (artifactId: string): void => {
    const board = getBoard();
    const artifact = board.artifacts.find((a) => a.id === artifactId);

    board.artifacts = board.artifacts.filter((a) => a.id !== artifactId);

    if (artifact?.intentId) {
      const intent = board.intents.find((i) => i.id === artifact.intentId);
      if (intent) {
        intent.artifacts = intent.artifacts.filter((a) => a.id !== artifactId);
        intent.updatedAt = new Date();
      }
    }

    board.updatedAt = new Date();
    saveBoard(board);
  },

  // Search artifacts
  searchArtifacts: (
    query: string,
    type?: Artifact["type"]
  ): Artifact[] => {
    const board = getBoard();
    const queryLower = query.toLowerCase();

    return board.artifacts.filter((artifact) => {
      const matchesType = !type || artifact.type === type;
      const matchesQuery =
        artifact.title.toLowerCase().includes(queryLower) ||
        artifact.content.toLowerCase().includes(queryLower);
      return matchesType && matchesQuery;
    });
  },

  // Connector operations
  getConnector: (connectorId: string): Connector | undefined => {
    return getBoard().connectors.find((c) => c.id === connectorId);
  },

  toggleConnector: (connectorId: string, enabled: boolean): Connector => {
    const board = getBoard();
    const connector = board.connectors.find((c) => c.id === connectorId);
    if (!connector) throw new Error(`Connector ${connectorId} not found`);

    connector.enabled = enabled;
    connector.lastSyncAt = new Date();
    board.updatedAt = new Date();
    saveBoard(board);
    return connector;
  },

  getEnabledConnectors: (): Connector[] => {
    return getBoard().connectors.filter((c) => c.enabled);
  },

  // File upload operations
  saveUploadedFile: (file: UploadedFile): void => {
    uploadedFiles.set(file.id, file);
  },

  getUploadedFile: (fileId: string): UploadedFile | undefined => {
    return uploadedFiles.get(fileId);
  },

  getAllUploadedFiles: (): UploadedFile[] => {
    return Array.from(uploadedFiles.values());
  },

  deleteUploadedFile: (fileId: string): void => {
    uploadedFiles.delete(fileId);
  },

  clearAllUploadedFiles: (): void => {
    uploadedFiles.clear();
  },

  // Reset the entire board to a fresh state
  resetBoard: (title?: string, description?: string): Board => {
    const freshBoard = createNewBoard(title, description);
    currentBoard = freshBoard;
    uploadedFiles.clear();
    saveBoard(freshBoard);
    return freshBoard;
  },
};
