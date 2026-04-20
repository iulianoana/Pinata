import { z } from "zod";
import { TENSE_IDS } from "./constants.js";

// ---------------------------------------------------------------------------
// Exercise schemas (for validating AI-generated output)
// The AI returns exercises WITHOUT an `id` field; IDs are assigned server-side.
// ---------------------------------------------------------------------------

const gapFillSchema = z.object({
  type: z.literal("gap_fill"),
  sentence: z.string(),
  correctAnswer: z.string(),
  hint: z.string(),
  person: z.string(),
});

const multipleChoiceSchema = z.object({
  type: z.literal("multiple_choice"),
  sentence: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  verb: z.string(),
  tenseLabel: z.string(),
  person: z.string(),
});

const chatBubbleSchema = z.object({
  type: z.literal("chat_bubble"),
  messages: z.array(
    z.object({
      sender: z.string(),
      text: z.string(),
      isUser: z.boolean(),
      blankPosition: z
        .object({ before: z.string(), after: z.string() })
        .optional(),
    })
  ),
  correctAnswer: z.string(),
  person: z.string(),
});

const oddOneOutSchema = z.object({
  type: z.literal("odd_one_out"),
  options: z.array(z.string()).length(4),
  oddIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
  verb: z.string(),
  tenseLabel: z.string(),
  person: z.string(),
});

const miniStorySchema = z.object({
  type: z.literal("mini_story"),
  segments: z.array(
    z.object({
      text: z.string(),
      isBlank: z.boolean(),
      correctAnswer: z.string().optional(),
    })
  ),
  hint: z.string(),
  verb: z.string(),
  person: z.string(),
});

/** Discriminated union for the 5 AI-generated exercise types (excludes classic_table). */
export const aiExerciseSchema = z.discriminatedUnion("type", [
  gapFillSchema,
  multipleChoiceSchema,
  chatBubbleSchema,
  oddOneOutSchema,
  miniStorySchema,
]);

const verbInfoSchema = z.object({
  type: z.string(),
  rule: z.string(),
  example: z.object({
    sentence: z.string(),
    highlightedWord: z.string(),
  }),
});

/** Full AI response: 6 exercises (one per person) + a conjugation table + optional verb info for beginners. */
export const aiResponseSchema = z.object({
  exercises: z.array(aiExerciseSchema).length(6),
  conjugationTable: z.record(z.string(), z.string()),
  verbInfo: verbInfoSchema.optional(),
});

// ---------------------------------------------------------------------------
// Request validation schemas
// ---------------------------------------------------------------------------

export const generatePacksSchema = z.object({
  verbIds: z.array(z.string().uuid()).min(1),
  tense: z.enum(TENSE_IDS),
});

export const saveAttemptSchema = z.object({
  packIds: z.array(z.string().uuid()).min(1),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  details: z.array(
    z.object({
      verb_id: z.string().uuid(),
      tense: z.string(),
      correct: z.number().int().min(0),
      total: z.number().int().min(1),
    })
  ),
});
