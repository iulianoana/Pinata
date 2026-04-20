-- One-shot cleanup: delete verb rows that have no drill_packs.
-- Before the /api/conjugar/generate-batch endpoint, AI generation failures
-- could leave verb rows with zero packs ("orphans"). The new flow only
-- inserts verbs after AI validation, so no new orphans can appear.
-- Safe to run multiple times.

DELETE FROM verbs
WHERE id NOT IN (
  SELECT DISTINCT verb_id
  FROM drill_packs
  WHERE verb_id IS NOT NULL
);
