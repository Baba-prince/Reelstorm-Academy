const DASHSCOPE_BASE =
  process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/api/v1";

export type OrchestratorMessage = { role: "system" | "user" | "assistant"; content: string };

/** DashScope primary orchestrator; falls back to local Ollama llama3.1:8b */
export async function orchestrate(
  messages: OrchestratorMessage[],
  opts?: { model?: string; json?: boolean; timeoutMs?: number },
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 25_000;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const dashKey = process.env.DASHSCOPE_API_KEY;
    if (dashKey) {
      const res = await fetch(`${DASHSCOPE_BASE}/services/aigc/text-generation/generation`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dashKey}`,
          "Content-Type": "application/json",
        },
        signal: ac.signal,
        body: JSON.stringify({
          model: opts?.model || process.env.DASHSCOPE_MODEL || "qwen-plus",
          input: { messages },
          parameters: opts?.json ? { result_format: "message" } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`DashScope error ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as {
        output?: { text?: string; choices?: Array<{ message?: { content?: string } }> };
      };
      return (
        data.output?.text ||
        data.output?.choices?.[0]?.message?.content ||
        ""
      );
    }

    // Local Ollama fallback
    const ollama = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    const res = await fetch(`${ollama}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({
        model: opts?.model || process.env.OLLAMA_MODEL || "llama3.1:8b",
        messages,
        stream: false,
        format: opts?.json ? "json" : undefined,
      }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

export async function breakScriptIntoShots(script: string): Promise<unknown> {
  const raw = await orchestrate(
    [
      {
        role: "system",
        content:
          "You are the STORM OS Producer Agent. Break scripts into shot lists for 5-min ARCHIVE5 blocks. Return JSON only.",
      },
      {
        role: "user",
        content: `Break into shots with timing, framing, camera moves:\n\n${script}`,
      },
    ],
    { json: true },
  );
  try {
    return JSON.parse(raw);
  } catch {
    return { shots: [], raw };
  }
}
