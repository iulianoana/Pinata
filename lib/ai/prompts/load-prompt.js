import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToDbKey } from "./prompt-mapping.js";

const cache = new Map();

/**
 * Load a prompt template and interpolate variables.
 * DB-first: checks user_prompts table when supabase + userId are provided.
 * Filesystem fallback only if the DB lookup finds nothing (unseeded prompts, missing rows).
 *
 * @param {string} name - Path without extension (e.g., "lesson/quiz-generator-system")
 * @param {Record<string, string|number>} [vars] - Template variables to interpolate
 * @param {{ supabase?: object, userId?: string }} [options] - DB lookup context
 * @returns {Promise<string>} The interpolated prompt text
 */
export async function loadPrompt(name, vars = {}, options = {}) {
  let template = null;

  // DB lookup — always attempted when auth context is available
  if (options.supabase && options.userId) {
    const dbKey = pathToDbKey(name);
    if (dbKey) {
      try {
        const { data } = await options.supabase
          .from("user_prompts")
          .select("content")
          .eq("user_id", options.userId)
          .eq("group_key", dbKey.group_key)
          .eq("slug", dbKey.slug)
          .single();
        if (data?.content) {
          template = data.content;
        }
      } catch {
        // DB lookup failed, fall through to filesystem
      }
    }
  }

  // Filesystem fallback — only used if DB returned nothing
  if (template === null) {
    if (!cache.has(name)) {
      const filePath = join(process.cwd(), "prompts", `${name}.md`);
      cache.set(name, readFileSync(filePath, "utf-8"));
    }
    template = cache.get(name);
  }

  for (const [key, value] of Object.entries(vars)) {
    template = template.replaceAll(`{{${key}}}`, String(value));
  }

  return template;
}
