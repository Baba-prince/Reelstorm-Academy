import type { FastifyInstance } from "fastify";
import {
  GUIDE_SYSTEM_PROMPT,
  buildGuideContextBlock,
  resolveGuideLayer,
  type GuideOption,
} from "@reelstorm/domain";
import { orchestrate } from "@reelstorm/providers";

type ChatBody = {
  message?: string;
  pathname?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  optionId?: string;
  locale?: string;
};

function localCoach(pathname: string, message: string, option?: GuideOption): {
  reply: string;
  options: GuideOption[];
  source: "knowledge";
} {
  const layer = resolveGuideLayer(pathname);
  const focus = option?.prompt || message;
  const lines = [
    `**${layer.title}** — ${layer.blurb}`,
    "",
    "System tips:",
    ...layer.tips.map((t) => `• ${t}`),
    "",
    `On “${focus.slice(0, 160)}”:`,
  ];

  const lower = focus.toLowerCase();
  if (
    lower.includes("rtc") ||
    lower.includes("pricing") ||
    lower.includes("wallet") ||
    lower.includes("tier") ||
    lower.includes("archive5") ||
    lower.includes("£")
  ) {
    lines.push(
      "• 1 RTC = 1 minute of finished master · 1 set = 5 RTC.",
      "• Free Test $0 · Basic $49 (3 sets, 720p) · Premium $99 (5 sets, 1080p) · Premium Pro $199.",
      "• 10 ARCHIVE5/mo ≈ 1000 RTC → Storm (£39) covers 15 blocks; Free only covers 3.",
      "• Check /wallet before Studio if remaining blocks < 2.",
    );
  } else if (lower.includes("sound") || lower.includes("voice") || lower.includes("clone") || lower.includes("audio")) {
    lines.push(
      "• Sync: Template Forge uploadId + audio file/URL → Sound Studio Sync tab.",
      "• Extract: pull full + voice/music stems from any uploadId.",
      "• Clone/TTS needs ELEVENLABS_API_KEY in Model Center.",
    );
  } else if (lower.includes("soul") || lower.includes("world")) {
    lines.push(
      "• Lock Soul ID before any STORM job — face drift kills the master.",
      "• Capture 4-angle room plates with lighting locked.",
    );
  } else if (lower.includes("next") || lower.includes("workflow") || option?.kind === "improve") {
    lines.push(
      "• Recommended path: Forge → World → Storyboard → Studio → Sound → Vault → Merge.",
      "• Improve throughput: parallel blocks, retry only QC fails, vault before merge.",
    );
  } else {
    lines.push(
      `• Stay on ${layer.title} until its exit criteria are met.`,
      "• Use the options below to go deeper or jump screens.",
    );
  }

  lines.push("", "Pick an option to improve your workflow:");
  return { reply: lines.join("\n"), options: layer.options, source: "knowledge" };
}

export async function guideRoutes(app: FastifyInstance) {
  /** GET /api/guide/context?pathname= — page tips + options */
  app.get("/api/guide/context", async (req, reply) => {
    const q = req.query as { pathname?: string };
    const pathname = q.pathname || "/";
    const layer = resolveGuideLayer(pathname);
    return reply.send({
      pathname,
      layer: layer.layer,
      title: layer.title,
      blurb: layer.blurb,
      tips: layer.tips,
      options: layer.options,
    });
  });

  /** POST /api/guide/chat — STORM Guide coach */
  app.post("/api/guide/chat", async (req, reply) => {
    const body = (req.body || {}) as ChatBody;
    const pathname = body.pathname || "/";
    const locale = (body.locale || "en").slice(0, 8);
    const layer = resolveGuideLayer(pathname);
    const option = body.optionId
      ? layer.options.find((o) => o.id === body.optionId)
      : undefined;
    const message = (body.message || option?.prompt || "").trim();
    if (!message) return reply.code(400).send({ error: "message or optionId required" });

    const history = (body.history || []).slice(-8);

    const hasLlm = Boolean(process.env.DASHSCOPE_API_KEY) || process.env.GUIDE_USE_OLLAMA === "1";

    if (hasLlm) {
      try {
        const raw = await orchestrate(
          [
            { role: "system", content: GUIDE_SYSTEM_PROMPT },
          {
            role: "system",
            content: `Page context:\n${buildGuideContextBlock(pathname)}\n\nUser UI locale: ${locale}. Reply in that language when possible (Yoruba=yo, Hausa=ha, Igbo=ig, French=fr, Swahili=sw, Arabic=ar, Portuguese=pt, Hindi=hi, Chinese=zh, Indonesian=id, Thai=th, Vietnamese=vi, Malay=ms, Japanese=ja, Korean=ko, Bengali=bn, Filipino=fil, Urdu=ur; else English).`,
          },
            ...history.map((h) => ({ role: h.role, content: h.content })),
            {
              role: "user",
              content: option
                ? `User selected option “${option.label}” (${option.kind}). ${option.prompt}${option.href ? ` Link: ${option.href}` : ""}`
                : message,
            },
          ],
          { model: process.env.GUIDE_MODEL, timeoutMs: Number(process.env.GUIDE_TIMEOUT_MS || 4500) },
        );

        if (raw?.trim()) {
          return reply.send({
            reply: raw.trim(),
            options: layer.options,
            source: process.env.DASHSCOPE_API_KEY ? "dashscope" : "ollama",
            layer: { title: layer.title, path: pathname },
          });
        }
      } catch (err) {
        app.log.warn({ err }, "guide orchestrate failed — knowledge fallback");
      }
    }

    const local = localCoach(pathname, message, option);
    return reply.send({
      ...local,
      layer: { title: layer.title, path: pathname },
    });
  });
}
