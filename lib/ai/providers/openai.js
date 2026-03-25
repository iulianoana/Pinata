const API_URL = "https://api.openai.com/v1/chat/completions";

function headers() {
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function generate({ model, system, messages, maxTokens = 4096 }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage
      ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
      : undefined,
  };
}

export async function* streamChat({ model, system, messages, maxTokens = 4096 }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      try {
        const data = JSON.parse(line.slice(6));
        const text = data.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {}
    }
  }
}

export async function generateFromPDF({ model, system, userMessage, pdfBase64, pdfMediaType, maxTokens = 8192 }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            {
              type: "file",
              file: {
                filename: "document.pdf",
                file_data: `data:${pdfMediaType};base64,${pdfBase64}`,
              },
            },
            { type: "text", text: userMessage },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage
      ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
      : undefined,
  };
}
