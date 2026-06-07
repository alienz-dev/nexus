/** MD5 hashing utility for differential content updates. */
import { createHash } from "node:crypto";

/** Compute MD5 hash of a string. */
export function md5(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

/** Compute MD5 hash of a Buffer. */
export function md5Buffer(content: Buffer): string {
  return createHash("md5").update(content).digest("hex");
}
