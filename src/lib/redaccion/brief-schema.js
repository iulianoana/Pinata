import { z } from "zod";

export const briefSchema = z.object({
  titulo: z.string().min(1),
  nivel: z.enum(["A1", "A2"]),
  extensionMin: z.number().int().positive(),
  extensionMax: z.number().int().positive(),
  mision: z.string().min(1),
  requisitos: z.array(z.string().min(1)).min(1),
  estructura: z.array(z.string().min(1)).min(1),
  preguntas: z.array(z.string().min(1)).min(1),
  consejo: z.string().min(1),
});

export const briefJsonSchema = z.toJSONSchema(briefSchema);
