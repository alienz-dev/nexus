/**
 * Prompt template rendering — simple {{variable}} interpolation.
 * Zero dependencies. Strict mode throws on missing variables.
 */

/**
 * Render a template string by replacing {{variable}} placeholders with values.
 *
 * @example
 * ```ts
 * renderTemplate("Hello {{name}}, you have {{count}} items", { name: "Alice", count: 5 })
 * // => "Hello Alice, you have 5 items"
 * ```
 */
export function renderTemplate(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Missing template variable: ${key}`);
    }
    const value = vars[key];
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Extract all variable names from a template string.
 *
 * @example
 * ```ts
 * extractVariables("Hello {{name}}, you have {{count}} items")
 * // => ["name", "count"]
 * ```
 */
export function extractVariables(template: string): string[] {
  const vars: string[] = [];
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!vars.includes(match[1])) {
      vars.push(match[1]);
    }
  }
  return vars;
}

/**
 * Validate that all required variables are present in the provided values.
 * Returns an array of missing variable names (empty if all present).
 */
export function validateVariables(
  template: string,
  vars: Record<string, unknown>,
): string[] {
  const required = extractVariables(template);
  return required.filter((key) => !(key in vars));
}
