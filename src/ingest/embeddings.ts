/** Embedding generation — real model via transformers.js with deterministic fallback.
 *  Uses Xenova/all-MiniLM-L6-v2 (384-dim, ~33MB, fast) by default.
 *  Falls back to deterministic hash-based stub if model unavailable. */
import { md5 } from "../lib/hash.js";

const STUB_DIM = 1024;
const MODEL_DIM = 384;

/** Lazy-loaded model pipeline. */
let pipeline: any = null;
let modelLoaded = false;
let modelFailed = false;

async function getPipeline(): Promise<any> {
  if (modelFailed) return null;
  if (pipeline) return pipeline;

  try {
    const { pipeline: loadPipeline } = await import("@huggingface/transformers");
    pipeline = await loadPipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "fp32",
    });
    modelLoaded = true;
    return pipeline;
  } catch {
    modelFailed = true;
    return null;
  }
}

/** Generate embedding using real model, or deterministic stub as fallback. */
export async function embedText(text: string): Promise<number[]> {
  const pipe = await getPipeline();

  if (pipe && modelLoaded) {
    const output = await pipe(text.slice(0, 512), { pooling: "mean", normalize: true });
    return Array.from(output.data) as number[];
  }

  // Fallback: deterministic hash-based stub
  return embedTextStub(text);
}

/** Batch embedding generation. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const pipe = await getPipeline();

  if (pipe && modelLoaded) {
    const results: number[][] = [];
    // Process in batches of 16 to avoid memory issues
    for (let i = 0; i < texts.length; i += 16) {
      const batch = texts.slice(i, i + 16).map((t) => t.slice(0, 512));
      const output = await pipe(batch, { pooling: "mean", normalize: true });
      for (let j = 0; j < batch.length; j++) {
        const start = j * MODEL_DIM;
        results.push(Array.from(output.data.slice(start, start + MODEL_DIM)));
      }
    }
    return results;
  }

  // Fallback
  return texts.map(embedTextStub);
}

/** Get the embedding dimension (384 for model, 1024 for stub). */
export function getEmbeddingDim(): number {
  return modelLoaded ? MODEL_DIM : STUB_DIM;
}

/** Check if real model is loaded. */
export function isModelLoaded(): boolean {
  return modelLoaded;
}

/** Deterministic hash-based stub (same content = same vector). */
function embedTextStub(text: string): number[] {
  const hash = md5(text);
  const vector: number[] = new Array(STUB_DIM);

  for (let i = 0; i < STUB_DIM; i++) {
    const hexPair = hash.slice((i * 2) % 32, ((i * 2) % 32) + 2) || hash.slice(0, 2);
    vector[i] = (parseInt(hexPair, 16) / 127.5) - 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map((v) => v / norm);
}

/** Synchronous stub for backwards compatibility.
 *  @deprecated Use `embedText()` for real embeddings. This always returns a hash stub. */
export function embedTextSync(text: string): number[] {
  return embedTextStub(text);
}
