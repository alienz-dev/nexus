/** Structured logging for nexus. */
import { createRequire } from "node:module";

// Optional chalk — falls back to no-color if not installed
let _chalk: any = null;
let _chalkLoaded = false;

function getChalk(): any {
  if (_chalkLoaded) return _chalk;
  _chalkLoaded = true;
  try {
    const require = createRequire(import.meta.url);
    _chalk = require("chalk");
  } catch {
    _chalk = null;
  }
  return _chalk;
}

const identity = (s: string) => s;

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function colorFor(level: LogLevel): (s: string) => string {
  const c = getChalk();
  if (!c) return identity;
  switch (level) {
    case "debug": return c.gray ?? identity;
    case "info": return c.blue ?? identity;
    case "warn": return c.yellow ?? identity;
    case "error": return c.red ?? identity;
  }
}

let minLevel: LogLevel = "info";

/** Set the minimum log level. */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

/** Log a message at the given level. */
export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const timestamp = new Date().toISOString();
  const color = colorFor(level);
  const prefix = color(`[${level.toUpperCase()}]`);
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`${timestamp} ${prefix} ${message}${suffix}`);
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};
