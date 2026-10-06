import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "../../.env") });
config();

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { MAX_VIDEO_UPLOAD_BYTES } from "@reelstorm/domain";
import { ensureRedis, uploadTmp } from "./lib/bootstrap.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { uploadRoutes } from "./routes/upload.js";
import { templateRoutes } from "./routes/templates.js";
import { templateRoomRoutes } from "./routes/template-room.js";
import {
  worldRoutes,
  storyboardRoutes,
  generateRoutes,
  archiveRoutes,
  mergeRoutes,
} from "./routes/factory.js";
import { wsRoutes } from "./ws/analysis.js";
import { readinessRoutes } from "./routes/readiness.js";
import { whiteLabelRoutes, billingRoutes } from "./routes/whitelabel.js";
import { soundRoutes } from "./routes/sound.js";
import { guideRoutes } from "./routes/guide.js";
import { i18nRoutes } from "./routes/i18n.js";

const PORT = Number(process.env.API_PORT || 4000);
const HOST = process.env.API_HOST || "0.0.0.0";

async function main() {
  process.env.UPLOAD_TMP_DIR = uploadTmp();
  await ensureRedis();

  const app = Fastify({
    logger: true,
    bodyLimit: MAX_VIDEO_UPLOAD_BYTES,
  });

  // Preserve raw body for Stripe webhook signature verification
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    try {
      const raw = body as Buffer;
      (req as { rawBody?: Buffer }).rawBody = raw;
      const json = raw.length ? JSON.parse(raw.toString("utf8")) : {};
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: MAX_VIDEO_UPLOAD_BYTES,
      files: 1,
    },
  });

  await app.register(websocket);

  app.get("/health", async () => ({
    ok: true,
    service: "reelstorm-api",
    version: "1.2.0",
    storm: "LIVE",
    redis: process.env.REDIS_URL || null,
  }));

  await authRoutes(app);
  await projectRoutes(app);
  await uploadRoutes(app);
  await templateRoomRoutes(app); // before /api/templates/:id
  await templateRoutes(app);
  await worldRoutes(app);
  await storyboardRoutes(app);
  await generateRoutes(app);
  await archiveRoutes(app);
  await mergeRoutes(app);
  await wsRoutes(app);
  await readinessRoutes(app);
  await whiteLabelRoutes(app);
  await billingRoutes(app);
  await soundRoutes(app);
  await guideRoutes(app);
  await i18nRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`REELSTORM API on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
