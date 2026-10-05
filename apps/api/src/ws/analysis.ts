import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import { redisConnection } from "../lib/queue.js";

/** WebSocket progress for video analysis: /ws/analysis/:uploadId */
export async function wsRoutes(app: FastifyInstance) {
  app.get("/ws/analysis/:uploadId", { websocket: true }, (socket, req) => {
    const { uploadId } = req.params as { uploadId: string };
    const channel = `analysis:${uploadId}`;
    const sub = redisConnection().duplicate();

    sub.subscribe(channel).catch((err) => {
      app.log.error(err);
      socket.send(JSON.stringify({ stage: "failed", percent: 0, error: "subscribe failed" }));
    });

    sub.on("message", (_ch, message) => {
      socket.send(message);
    });

    // Send current DB snapshot immediately
    prisma.videoUpload
      .findUnique({ where: { id: uploadId } })
      .then((u) => {
        if (!u) return;
        socket.send(
          JSON.stringify({
            uploadId,
            stage: u.status.toLowerCase(),
            percent: u.progressPct,
            message: u.progressMsg,
            error: u.error,
          }),
        );
      })
      .catch(() => undefined);

    socket.on("close", () => {
      sub.unsubscribe(channel).finally(() => sub.quit());
    });
  });

  app.get("/api/jobs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await prisma.jobRecord.findUnique({ where: { jobId: id } });
    if (!job) return reply.code(404).send({ error: "Not found" });
    return { job };
  });
}
