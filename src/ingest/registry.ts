/** Source registry — register and discover bridge adapters. */
import type { BridgeAdapter } from "./types.js";

const adapters = new Map<string, BridgeAdapter>();

/** Register a bridge adapter. */
export function register(adapter: BridgeAdapter): void {
  adapters.set(adapter.name, adapter);
}

/** Get a registered adapter by name. */
export function get(name: string): BridgeAdapter | undefined {
  return adapters.get(name);
}

/** List all registered adapters. */
export function list(): BridgeAdapter[] {
  return Array.from(adapters.values());
}

/** List only available adapters (source accessible). */
export async function listAvailable(): Promise<BridgeAdapter[]> {
  const results = await Promise.all(
    list().map(async (a) => ({ adapter: a, available: await a.isAvailable() }))
  );
  return results.filter((r) => r.available).map((r) => r.adapter);
}

/** Clear all registered adapters (for testing). */
export function clear(): void {
  adapters.clear();
}
