/** Optional chalk wrapper — provides no-color fallback if chalk isn't installed. */
import { createRequire } from "node:module";

let _chalk: any = null;
try {
  const require = createRequire(import.meta.url);
  _chalk = require("chalk");
} catch {
  // chalk not available
}

const identity = (s: string) => s;

/** chalk-compatible object that falls back to identity when chalk is not installed. */
export default _chalk ?? {
  gray: identity,
  blue: identity,
  yellow: identity,
  red: identity,
  green: identity,
  cyan: identity,
  magenta: identity,
  white: identity,
  dim: identity,
  bold: (s: string) => s,
  underline: (s: string) => s,
};
