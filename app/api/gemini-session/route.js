import { buildSystemInstruction } from "./prompt.js";

export async function POST(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Gemini not configured" }, { status: 500 });
  }

  try {
    const { unitContext } = await req.json();
    const systemInstruction = buildSystemInstruction(unitContext || null);

    return Response.json({
      apiKey,
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      systemInstruction,
    });
  } catch (e) {
    return Response.json({ error: "Failed to create session" }, { status: 500 });
  }
}
