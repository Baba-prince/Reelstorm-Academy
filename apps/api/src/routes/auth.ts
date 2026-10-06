import type { FastifyInstance } from "fastify";
import { prisma } from "@reelstorm/db";
import { TIER_MONTHLY_RTC } from "@reelstorm/domain";

function b64urlJson(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Record<string, unknown>;
    }
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function verifySupabaseJwt(token: string): Promise<{
  sub: string;
  email?: string;
  name?: string;
  avatar?: string;
} | null> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as {
      id?: string;
      email?: string;
      user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string };
    };
    if (!user.id) return null;
    return {
      sub: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.user_metadata?.name,
      avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture,
    };
  } catch {
    return null;
  }
}

async function upsertFromSupabase(sb: {
  sub: string;
  email?: string;
  name?: string;
  avatar?: string;
}) {
  const email = sb.email || `${sb.sub}@users.supabase`;
  const bySupabase = await prisma.user.findUnique({ where: { supabaseId: sb.sub } });
  if (bySupabase) {
    return prisma.user.update({
      where: { id: bySupabase.id },
      data: {
        email,
        name: sb.name || bySupabase.name,
        avatarUrl: sb.avatar || bySupabase.avatarUrl,
      },
    });
  }
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: sb.name || email.split("@")[0],
      avatarUrl: sb.avatar || null,
      supabaseId: sb.sub,
      tier: "free",
      rtcBalance: 1,
      freeDemoUsed: false,
    },
    update: {
      supabaseId: sb.sub,
      name: sb.name || undefined,
      avatarUrl: sb.avatar || undefined,
    },
  }).then(async (user) => {
    // First-time (or returning) free users get 1 RTC from SystemBank
    try {
      const { ensureUserWallet } = await import("../lib/rtc.js");
      await ensureUserWallet(user.id, (user.tier as "free") || "free");
    } catch {
      /* non-fatal — wallet can be created on next /wallet call */
    }
    return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  });
}

export async function resolveUserFromAuthHeader(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabaseUser = await verifySupabaseJwt(token);
  if (supabaseUser) return upsertFromSupabase(supabaseUser);

  const payload = b64urlJson(token);
  if (payload?.sub && typeof payload.sub === "string") {
    return prisma.user.findUnique({ where: { id: payload.sub } });
  }
  return null;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/dev-login", async (req, reply) => {
    const body = (req.body || {}) as { email?: string; name?: string };
    const email = body.email || "producer@reelstorm.academy";
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: body.name || "Producer", tier: "free", rtcBalance: 1 },
      update: { name: body.name || undefined },
    });
    try {
      const { ensureUserWallet } = await import("../lib/rtc.js");
      await ensureUserWallet(user.id, "free");
    } catch {
      /* ignore */
    }
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return reply.send({
      user: fresh,
      token: Buffer.from(JSON.stringify({ sub: user.id, email: user.email, mode: "dev" })).toString(
        "base64url",
      ),
      mode: "dev",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      hint: "Use Google OAuth via /login or exchange Supabase access_token",
    });
  });

  app.get("/api/auth/me", async (req, reply) => {
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    return {
      user,
      mode: user.supabaseId ? "supabase" : "token",
      googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
      hosts: {
        marketing: process.env.MARKETING_URL || "https://reelstorm.uk",
        app: process.env.APP_URL || "https://app.reelstorm.uk",
      },
    };
  });

  app.post("/api/auth/onboarding", async (req, reply) => {
    const user = await resolveUserFromAuthHeader(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = (req.body || {}) as {
      role?: string;
      region?: string;
      templateId?: string;
      tierInterest?: string;
    };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingCompleted: true,
        onboardingJson: {
          role: body.role || null,
          region: body.region || null,
          templateId: body.templateId || null,
          tierInterest: body.tierInterest || "free",
          completedAt: new Date().toISOString(),
        },
      },
    });

    // Ensure wallet exists for free tier
    const { ensureUserWallet } = await import("../lib/rtc.js");
    await ensureUserWallet(updated.id, updated.tier as never);

    return { user: updated, monthlyRtcHint: TIER_MONTHLY_RTC[updated.tier as keyof typeof TIER_MONTHLY_RTC] };
  });
}
