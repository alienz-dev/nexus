/** Embedding generation — deterministic stub for BGE-M3.
 *  TODO: Replace with BGE-M3 via @huggingface/transformers or local inference. */
import { md5 } from "../lib/hash.js";

const EMBEDDING_DIM = 1024;

/** Generate a deterministic pseudo-embedding from content hash.
 *  Same content always produces the same vector. Not semantically meaningful —
 *  used for testing vector search infrastructure before real model integration. */
export function embedText(text: string): number[] {
  const hash = md5(text);
  const vector: number[] = new Array(EMBEDDING_DIM);

  // Derive 1024 floats from the 32-char hex hash by cycling through pairs
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const hexPair = hash.slice((i * 2) % 32, ((i * 2) % 32) + 2) || hash.slice(0, 2);
    // Map hex to [-1, 1] range
    vector[i] = (parseInt(hexPair, 16) / 127.5) - 1;
  }

  // Normalize to unit vector
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map((v) => v / norm);
}

/** Batch embedding generation. */
export function embedBatch(texts: string[]): number[][] {
  return texts.map(embedText);
}
