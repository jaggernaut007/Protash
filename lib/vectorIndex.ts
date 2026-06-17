/**
 * Simple TF-IDF based vector index for board artifact search
 * Provides RAG context for intent agents
 */

import { Artifact, UploadedFile } from "@/types/board";

interface VectorEntry {
  id: string;
  text: string;
  tokens: Set<string>;
  type: string;
}

interface SearchResult {
  id: string;
  text: string;
  score: number;
  type: string;
}

// Tokenize text (simple: lowercase, split on whitespace/punctuation)
function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 0);
  return new Set(tokens);
}

// Calculate IDF (inverse document frequency)
function calculateIDF(
  token: string,
  documents: VectorEntry[]
): number {
  const count = documents.filter((d) => d.tokens.has(token)).length;
  if (count === 0) return 0;
  return Math.log(documents.length / (count + 1));
}

// TF-IDF scoring
function calculateTFIDF(
  tokens: Set<string>,
  queryTokens: Set<string>,
  allDocuments: VectorEntry[]
): number {
  let score = 0;
  for (const token of queryTokens) {
    const tf = tokens.has(token) ? 1 / queryTokens.size : 0;
    const idf = calculateIDF(token, allDocuments);
    score += tf * idf;
  }
  return score;
}

export class VectorIndex {
  private entries: Map<string, VectorEntry> = new Map();
  private fileEntries: Map<string, VectorEntry> = new Map();

  /**
   * Index artifacts
   */
  indexArtifact(artifact: Artifact): void {
    const text = `${artifact.title} ${artifact.content}`;
    this.entries.set(artifact.id, {
      id: artifact.id,
      text,
      tokens: tokenize(text),
      type: artifact.type,
    });
  }

  /**
   * Index multiple artifacts
   */
  indexArtifacts(artifacts: Artifact[]): void {
    artifacts.forEach((a) => this.indexArtifact(a));
  }

  /**
   * Index uploaded file
   */
  indexFile(file: UploadedFile): void {
    this.fileEntries.set(file.id, {
      id: file.id,
      text: `${file.name} ${file.content}`,
      tokens: tokenize(`${file.name} ${file.content}`),
      type: "file",
    });
  }

  /**
   * Search index
   */
  search(
    query: string,
    limit: number = 10,
    type?: string
  ): SearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.size === 0) return [];

    // Combine all documents
    const allDocuments = [
      ...Array.from(this.entries.values()),
      ...Array.from(this.fileEntries.values()),
    ];

    if (allDocuments.length === 0) return [];

    // Filter by type if provided
    const candidates = type
      ? allDocuments.filter((d) => d.type === type)
      : allDocuments;

    // Score all candidates
    const scored = candidates.map((doc) => ({
      id: doc.id,
      text: doc.text,
      score: calculateTFIDF(doc.tokens, queryTokens, allDocuments),
      type: doc.type,
    }));

    // Sort by score descending and return top results
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get all artifacts of a type
   */
  getByType(type: string): SearchResult[] {
    return Array.from(this.entries.values())
      .filter((d) => d.type === type)
      .map((d) => ({
        id: d.id,
        text: d.text,
        score: 1,
        type: d.type,
      }));
  }

  /**
   * Clear index
   */
  clear(): void {
    this.entries.clear();
    this.fileEntries.clear();
  }

  /**
   * Remove entry
   */
  remove(id: string): void {
    this.entries.delete(id);
    this.fileEntries.delete(id);
  }

  /**
   * Get index size
   */
  size(): number {
    return this.entries.size + this.fileEntries.size;
  }
}

// Global instance
export const vectorIndex = new VectorIndex();
