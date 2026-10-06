#!/usr/bin/env node
/**
 * Enqueue fetchTemplateIntros (Pexels → Pixabay → R2).
 * Requires API running: POST /api/templates/intros/fetch
 *
 *   npm run worker:fetch-intros
 *   API_URL=http://127.0.0.1:4017 npm run worker:fetch-intros
 */
const base = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4017").replace(
  /\/$/,
  "",
);

const res = await fetch(`${base}/api/templates/intros/fetch`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    perCategoryTarget: Number(process.env.INTROS_PER_CATEGORY || 20),
    perQuery: Number(process.env.INTROS_PER_QUERY || 7),
  }),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { raw: text };
}

if (!res.ok) {
  console.error("Failed", res.status, json);
  process.exit(1);
}

console.log("Queued fetchTemplateIntros", json);
console.log("Ensure reelstorm-worker is online to process the queue.");
