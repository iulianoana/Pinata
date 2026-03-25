import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generate({ model, system, messages, maxTokens = 4096 }) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages,
  });

  const content = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    content,
    usage: response.usage
      ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
      : undefined,
  };
}

export async function* streamChat({ model, system, messages, maxTokens = 4096 }) {
  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system,
    messages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export async function generateFromPDF({ model, system, userMessage, pdfBase64, pdfMediaType, maxTokens = 8192 }) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: pdfMediaType, data: pdfBase64 },
          },
          { type: "text", text: userMessage },
        ],
      },
    ],
  });

  const content = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    content,
    usage: response.usage
      ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
      : undefined,
  };
}
