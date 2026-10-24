const DASHSCOPE_BASE =
  process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/api/v1";

export type OrchestratorMessage = { role: "system" | "user" | "assistant"; content: string };

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fn(ac.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function callDashScope(
  messages: OrchestratorMessage[],
  opts: { model?: string; json?: boolean },
  signal: AbortSignal,
): Promise<string> {
  const dashKey = process.env.DASHSCOPE_API_KEY;
  if (!dashKey) throw new Error("DASHSCOPE_API_KEY missing");
  const res = await fetch(`${DASHSCOPE_BASE}/services/aigc/text-generation/generation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dashKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: opts.model || process.env.DASHSCOPE_MODEL || "qwen-plus",
      input: { messages },
      parameters: opts.json ? { result_format: "message" } : undefined,
    }),
  });
  if (!res.ok) throw new Error(`DashScope error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    output?: { text?: string; choices?: Array<{ message?: { content?: string } }> };
  };
  return data.output?.text || data.output?.choices?.[0]?.message?.content || "";
}

async function callOllama(
  messages: OrchestratorMessage[],
  opts: { model?: string; json?: boolean },
  signal: AbortSignal,
): Promise<string> {
  const ollama = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const res = await fetch(`${ollama}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: opts.model || process.env.OLLAMA_MODEL || "qwen2.5:1.5b",
      messages,
      stream: false,
      format: opts.json ? "json" : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content || "";
}

function isClaudeModel(model?: string): boolean {
  return Boolean(model && /^claude/i.test(model));
}

/** Claude primary (BOT Director) → DashScope → Ollama */
export async function orchestrate(
  messages: OrchestratorMessage[],
  opts?: { model?: string; json?: boolean; timeoutMs?: number },
): Promise<string> {
  const timeoutMs = opts?.timeoutMs ?? 25_000;
  const requested = opts?.model;
  const json = opts?.json;

  if ((process.env.ANTHROPIC_API_KEY || "").trim()) {
    try {
      const { callAnthropic } = await import("./anthropic.js");
      const claudeOpts = {
        json,
        model:
          process.env.ANTHROPIC_MODEL ||
          (isClaudeModel(requested) ? requested : undefined),
      };
      const text = await withTimeout(timeoutMs, (signal) =>
        callAnthropic(messages, claudeOpts, signal),
      );
      if (text.trim()) return text;
    } catch (err) {
      console.warn("[orchestrate] Claude failed, trying DashScope:", (err as Error).message);
    }
  }

  // Never pass Claude model ids into DashScope / Ollama
  const legacyModel = isClaudeModel(requested) ? undefined : requested;

  if (process.env.DASHSCOPE_API_KEY) {
    try {
      const text = await withTimeout(timeoutMs, (signal) =>
        callDashScope(messages, { model: legacyModel, json }, signal),
      );
      if (text.trim()) return text;
    } catch (err) {
      console.warn("[orchestrate] DashScope failed, trying Ollama:", (err as Error).message);
    }
  }

  return withTimeout(Math.min(timeoutMs, 45_000), (signal) =>
    callOllama(messages, { model: legacyModel, json }, signal),
  );
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
