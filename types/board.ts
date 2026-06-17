/**
 * Board Domain Models
 * Core entities for intent-scoped workspace
 */

export interface Artifact {
  id: string;
  type: "decision" | "constraint" | "preference" | "prototype" | "specArtifact" | "taskUI";
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  intentId?: string;
  metadata?: Record<string, unknown>;
}

export interface Decision extends Artifact {
  type: "decision";
  rationale: string;
  confidence: number; // 0-1
}

export interface Constraint extends Artifact {
  type: "constraint";
  scope: string;
  value?: string | number;
}

export interface Preference extends Artifact {
  type: "preference";
  priority: number; // 1-10
  category: string;
}

export interface PrototypeArtifact extends Artifact {
  type: "prototype";
  componentCode: string;
  generatedAt: Date;
  intentId: string;
}

export interface SpecArtifact extends Artifact {
  type: "specArtifact";
  intentId: string;
}

export interface TaskUI extends Artifact {
  type: "taskUI";
  componentCode: string;
  ephemeral: boolean;
  savedAt?: Date;
  intentId: string;
}

export interface Intent {
  id: string;
  boardId: string;
  title: string;
  description: string;
  domain?: string;
  status: "draft" | "active" | "resolved" | "archived";
  createdAt: Date;
  updatedAt: Date;
  artifacts: Artifact[];
  metadata?: Record<string, unknown>;
}

export interface Connector {
  id: string;
  type: "calendar" | "bank" | "wearable" | "docs" | "custom";
  name: string;
  enabled: boolean;
  boardId: string;
  config?: Record<string, unknown>;
  lastSyncAt?: Date;
}

export interface Board {
  id: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  intents: Intent[];
  artifacts: Artifact[];
  connectors: Connector[];
  metadata?: Record<string, unknown>;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  content: string;
  uploadedAt: Date;
  boardId: string;
}

/**
 * API Request/Response Types
 */

export interface CreateIntentRequest {
  title: string;
  description: string;
  domain?: string;
}

export interface CreateIntentResponse {
  intent: Intent;
}

export interface CreateArtifactRequest {
  type: Artifact["type"];
  title: string;
  content: string;
  intentId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateArtifactResponse {
  artifact: Artifact;
}

export interface SearchBoardRequest {
  query: string;
  limit?: number;
  type?: Artifact["type"];
}

export interface SearchBoardResponse {
  results: Artifact[];
  total: number;
}

export interface UploadFileRequest {
  file: File;
}

export interface UploadFileResponse {
  fileId: string;
  name: string;
  indexed: boolean;
}

export interface ConnectorToggleRequest {
  connectorId: string;
  enabled: boolean;
}

export interface GetBoardResponse {
  board: Board;
}

export interface UpdateIntentRequest {
  title?: string;
  description?: string;
  status?: Intent["status"];
}
