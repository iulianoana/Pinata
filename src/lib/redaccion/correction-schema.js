import { z } from "zod";

const okSegment = z.object({
  type: z.literal("ok"),
  text: z.string().min(1),
});

const majorSegment = z.object({
  type: z.literal("major"),
  original: z.string().min(1),
  correction: z.string().min(1),
  note: z.string().min(1),
});

const minorSegment = z.object({
  type: z.literal("minor"),
  original: z.string().min(1),
  suggestion: z.string().min(1),
  note: z.string().min(1),
});

export const correctionSchema = z.object({
  segments: z.array(z.union([okSegment, majorSegment, minorSegment])).min(1),
  summary: z.string().min(1),
  scoreGrammar: z.number().int().min(0).max(10),
  scoreVocabulary: z.number().int().min(0).max(10),
  scoreStructure: z.number().int().min(0).max(10),
});

export const correctionJsonSchema = z.toJSONSchema(correctionSchema);
