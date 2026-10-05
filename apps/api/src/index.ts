import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "../../.env") });
config(); // also local .env

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { MAX_VIDEO_UPLOAD_BYTES } from "@reelstorm/domain";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { uploadRoutes } from "./routes/upload.js";
import { templateRoutes } from "./routes/templates.js";
import {
  worldRoutes,
  storyboardRoutes,
  generateRoutes,
  archiveRoutes,
  mergeRoutes,
} from "./routes/factory.js";
import { wsRoutes } from "./ws/analysis.js";

const PORT = Number(process.env.API_PORT || 4000);
const HOST = process.env.API_HOST || "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: true,
    bodyLimit: MAX_VIDEO_UPLOAD_BYTES,
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
    version: "1.1.0",
    storm: "LIVE",
  }));

  await authRoutes(app);
  await projectRoutes(app);
  await uploadRoutes(app);
  await templateRoutes(app);
  await worldRoutes(app);
  await storyboardRoutes(app);
  await generateRoutes(app);
  await archiveRoutes(app);
  await mergeRoutes(app);
  await wsRoutes(app);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`REELSTORM API on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
