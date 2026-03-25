import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  PROMPT_GROUPS,
  deriveSlug,
  deriveName,
} from "../../../../lib/ai/prompts/prompt-mapping.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

/**
 * Reads all prompt .md files from the filesystem and returns seed rows.
 */
function collectPromptFiles(userId) {
  const promptsDir = join(process.cwd(), "prompts");
  const rows = [];

  for (const group of PROMPT_GROUPS) {
    // Collect files from the group's folder
    const folderPath = join(promptsDir, ...group.folder.split("/"));
    let files = [];
    try {
      files = readdirSync(folderPath).filter((f) => f.endsWith(".md"));
    } catch {
      // folder may not exist
    }

    for (const filename of files) {
      const content = readFileSync(join(folderPath, filename), "utf-8");
      const slug = deriveSlug(filename, group.prefixes);
      const name = deriveName(content, slug);
      rows.push({
        user_id: userId,
        group_key: group.group_key,
        slug,
        name,
        filename,
        content,
      });
    }

    // Collect extra files (e.g. carolina-identity.md in carolina-voice group)
    if (group.extraFiles) {
      for (const relPath of group.extraFiles) {
        const filePath = join(promptsDir, ...relPath.split("/"));
        try {
          const content = readFileSync(filePath, "utf-8");
          const filename = relPath.split("/").pop();
          const slug = deriveSlug(filename, group.prefixes);
          const name = deriveName(content, slug);
          rows.push({
            user_id: userId,
            group_key: group.group_key,
            slug,
            name,
            filename,
            content,
          });
        } catch {
          // file may not exist
        }
      }
    }
  }

  return rows;
}

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = collectPromptFiles(user.id);

  // Only insert prompts that don't already exist
  const { data: existing } = await supabase
    .from("user_prompts")
    .select("group_key, slug")
    .eq("user_id", user.id);

  const existingKeys = new Set(
    (existing || []).map((r) => `${r.group_key}:${r.slug}`)
  );

  const toInsert = rows.filter(
    (r) => !existingKeys.has(`${r.group_key}:${r.slug}`)
  );

  if (toInsert.length === 0) {
    return Response.json({ inserted: 0 });
  }

  const { error } = await supabase.from("user_prompts").insert(toInsert);
  if (error)
    return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ inserted: toInsert.length });
}

// Also export the collector for reuse in the GET route's auto-seed
export { collectPromptFiles };
