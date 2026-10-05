import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/dev-login", async (req, reply) => {
    const body = (req.body || {}) as { email?: string; name?: string };
    const email = body.email || "producer@reelstorm.academy";
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: body.name || "Producer" },
      update: { name: body.name || undefined },
    });
    // Dev token — replace with Supabase JWT verification in production
    return reply.send({
      user,
      token: Buffer.from(JSON.stringify({ sub: user.id, email: user.email })).toString("base64url"),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    });
  });

  app.get("/api/auth/me", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    try {
      const payload = JSON.parse(Buffer.from(auth.slice(7), "base64url").toString("utf8")) as {
        sub: string;
      };
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) return reply.code(401).send({ error: "Unauthorized" });
      return { user };
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });
}
