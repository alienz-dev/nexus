/** Structured logging for nexus. */
import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, (s: string) => string> = {
  debug: chalk.gray,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
};

let minLevel: LogLevel = "info";

/** Set the minimum log level. */
export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

/** Log a message at the given level. */
export function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const timestamp = new Date().toISOString();
  const color = LEVEL_COLORS[level];
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
