/** Optional ora wrapper — provides no-op fallback if ora isn't installed. */
import { createRequire } from "node:module";

let _ora: any = null;
try {
  const require = createRequire(import.meta.url);
  _ora = require("ora");
} catch {
  // ora not available
}

interface OraInstance {
  start(text?: string): OraInstance;
  succeed(text?: string): OraInstance;
  fail(text?: string): OraInstance;
  warn(text?: string): OraInstance;
  info(text?: string): OraInstance;
  stop(): OraInstance;
  text: string;
}

function noopSpinner(text = ""): OraInstance {
  const self: OraInstance = {
    text,
    start(t?: string) { if (t) console.log(t); return self; },
    succeed(t?: string) { if (t) console.log(`✔ ${t}`); return self; },
    fail(t?: string) { if (t) console.log(`✖ ${t}`); return self; },
    warn(t?: string) { if (t) console.log(`⚠ ${t}`); return self; },
    info(t?: string) { if (t) console.log(`ℹ ${t}`); return self; },
    stop() { return self; },
  };
  return self;
}

export default function ora(text?: string): OraInstance {
  if (_ora) return _ora(text);
  return noopSpinner(text);
}
