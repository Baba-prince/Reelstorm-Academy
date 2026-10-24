/**
 * Claude (Anthropic) — preferred BOT Director / STORM Guide brain.
 * Falls through to DashScope / Ollama via orchestrate().
 */

type Msg = { role: "system" | "user" | "assistant"; content: string };

export function anthropicAvailable(): boolean {
  return Boolean((process.env.ANTHROPIC_API_KEY || "").trim());
}

export async function callAnthropic(
  messages: Msg[],
  opts: { model?: string; json?: boolean },
  signal: AbortSignal,
): Promise<string> {
  const key = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const chat = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  if (!chat.length) {
    chat.push({ role: "user", content: "Continue." });
  }

  const model =
    opts.model ||
    process.env.ANTHROPIC_MODEL ||
    process.env.GUIDE_MODEL ||
    "claude-sonnet-4-20250514";

  const headers: Record<string, string> = {
    "x-api-key": key,
    Authorization: `Bearer ${key}`,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };
  const workspaceId = (process.env.ANTHROPIC_WORKSPACE_ID || "").trim();
  if (workspaceId) headers["anthropic-workspace-id"] = workspaceId;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model,
      max_tokens: opts.json ? 2048 : 1024,
      system: systemParts.join("\n\n") || undefined,
      messages: chat,
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return (data.content || [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}
