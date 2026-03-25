/**
 * Shared mapping between prompt filesystem paths and DB keys (group_key + slug).
 * Used by both the seed route and the loadPrompt DB lookup.
 */

/** Group definitions with their source folders and filename prefixes to strip */
export const PROMPT_GROUPS = [
  {
    group_key: "carolina-text",
    label: "Carolina Text",
    folder: "carolina/carolina-text",
    prefixes: ["carolina-"],
  },
  {
    group_key: "carolina-voice",
    label: "Carolina Voice",
    folder: "carolina/carolina-voice",
    prefixes: ["gemini-voice-", "carolina-"],
    // Extra files not in the subfolder but belonging to this group
    extraFiles: ["carolina/carolina-identity.md"],
  },
  {
    group_key: "lesson",
    label: "Lesson",
    folder: "lesson",
    prefixes: [],
  },
  {
    group_key: "vocab",
    label: "Vocabulary",
    folder: "vocab",
    prefixes: [],
  },
];

/**
 * Derive slug from a filename, stripping known prefixes.
 * @param {string} filename - e.g. "carolina-lesson-context.md"
 * @param {string[]} prefixes - prefixes to strip, e.g. ["carolina-"]
 * @returns {string} slug, e.g. "lesson-context"
 */
export function deriveSlug(filename, prefixes = []) {
  let base = filename.replace(/\.md$/, "");
  for (const prefix of prefixes) {
    if (base.startsWith(prefix)) {
      base = base.slice(prefix.length);
      break;
    }
  }
  return base;
}

/**
 * Humanize a slug into a display name.
 * "lesson-context" → "Lesson Context"
 */
export function humanize(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Derive display name from file content (first ## heading) or slug.
 */
export function deriveName(content, slug) {
  const match = content.match(/^##\s+(.+)$/m);
  if (match) return match[1].trim();
  return humanize(slug);
}

/**
 * Map a loadPrompt path name to { group_key, slug } for DB lookup.
 * Returns null if the path doesn't match any managed group.
 *
 * @param {string} name - e.g. "carolina/carolina-text/carolina-lesson-context"
 * @returns {{ group_key: string, slug: string } | null}
 */
export function pathToDbKey(name) {
  for (const group of PROMPT_GROUPS) {
    // Check extra files first
    if (group.extraFiles) {
      for (const extra of group.extraFiles) {
        const extraNoExt = extra.replace(/\.md$/, "");
        if (name === extraNoExt) {
          const filename = extra.split("/").pop();
          return {
            group_key: group.group_key,
            slug: deriveSlug(filename, group.prefixes),
          };
        }
      }
    }
    // Check folder match
    if (name.startsWith(group.folder + "/")) {
      const filename = name.split("/").pop() + ".md";
      return {
        group_key: group.group_key,
        slug: deriveSlug(filename, group.prefixes),
      };
    }
  }
  return null;
}
