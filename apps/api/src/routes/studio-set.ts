import type { FastifyInstance } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@reelstorm/db";
import {
  COURTROOM_DRAMA_PACK,
  CORE_ARTIST_ANGLES,
  CORE_SET_ANGLES,
  evaluateStudioSetReadiness,
  roomPlatesFromAngleMap,
  soulAnglesFromPlateMap,
  type StudioAngle,
} from "@reelstorm/domain";
import { publicUrl, uploadBuffer } from "@reelstorm/media";

type PlateMap = Record<string, string | undefined>;

function asPlates(json: unknown): PlateMap {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    return json as PlateMap;
  }
  return {};
}

function softLaunchEnv(): boolean {
  return (
    process.env.SOFT_LAUNCH === "1" ||
    process.env.SOFT_LAUNCH === "true" ||
    process.env.ALLOW_MOCK_VIDEO === "1"
  );
}

async function loadStudioSet(id: string) {
  return prisma.studioSet.findUnique({
    where: { id },
    include: { rooms: true, artists: true, imagery: true },
  });
}

async function refreshCompleteness(studioSetId: string) {
  const set = await loadStudioSet(studioSetId);
  if (!set) return null;
  const readiness = evaluateStudioSetReadiness({
    id: set.id,
    softLaunch: softLaunchEnv(),
    rooms: set.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      requiredAngles: (r.requiredAngles as StudioAngle[]) || CORE_SET_ANGLES,
      plates: asPlates(r.platesJson),
    })),
    artists: set.artists.map((a) => ({
      id: a.id,
      name: a.name,
      requiredAngles: (a.requiredAngles as StudioAngle[]) || CORE_ARTIST_ANGLES,
      plates: asPlates(a.platesJson),
    })),
    imagery: set.imagery.map((i) => ({
      id: i.id,
      name: i.name,
      prompt: i.customizedPrompt || i.prompt,
      locked: i.locked,
    })),
  });
  const status =
    set.status === "applied"
      ? "applied"
      : readiness.ready
        ? "ready"
        : set.rooms.length || set.artists.length
          ? "building"
          : "draft";
  const updated = await prisma.studioSet.update({
    where: { id: studioSetId },
    data: { completenessPct: readiness.pct, status },
    include: { rooms: true, artists: true, imagery: true },
  });
  return { set: updated, readiness };
}

/** Soft-launch / MVP: store prompt DNA as plate keys when no real image gen */
function mockPlateKey(kind: string, id: string, angle: string, prompt: string): string {
  const hash = createHash("sha1").update(`${kind}:${id}:${angle}:${prompt}`).digest("hex").slice(0, 12);
  return `studio-set/${kind}/${id}/${angle}_${hash}.prompt`;
}

async function tryUploadPlaceholder(
  key: string,
  label: string,
): Promise<string> {
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
      <rect width="100%" height="100%" fill="#0A0A0A"/>
      <text x="50%" y="48%" fill="#00D9FF" font-family="sans-serif" font-size="28" text-anchor="middle">${label}</text>
      <text x="50%" y="56%" fill="#7C3AED" font-family="sans-serif" font-size="16" text-anchor="middle">REELSTORM Studio Set plate</text>
    </svg>`;
    await uploadBuffer(key, Buffer.from(svg), "image/svg+xml");
    return publicUrl(key) || key;
  } catch {
    return key;
  }
}

export async function studioSetRoutes(app: FastifyInstance) {
  /** Create or return latest Studio Set for a project */
  app.post("/api/studio-set", async (req, reply) => {
    const body = (req.body || {}) as {
      projectId?: string;
      title?: string;
      seedPackId?: string;
    };
    if (!body.projectId) return reply.code(400).send({ error: "projectId required" });
    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found" });

    const existing = await prisma.studioSet.findFirst({
      where: { projectId: body.projectId, status: { not: "applied" } },
      orderBy: { createdAt: "desc" },
      include: { rooms: true, artists: true, imagery: true },
    });
    if (existing && !body.seedPackId) {
      const refreshed = await refreshCompleteness(existing.id);
      return reply.send(refreshed);
    }

    const set = await prisma.studioSet.create({
      data: {
        projectId: body.projectId,
        title: body.title || `${project.title} · Studio Set`,
        seedPackId: body.seedPackId || null,
        status: "draft",
      },
      include: { rooms: true, artists: true, imagery: true },
    });

    if (body.seedPackId === COURTROOM_DRAMA_PACK.id || body.seedPackId === "courtroom") {
      await seedCourtroomPack(set.id, body.projectId);
      const refreshed = await refreshCompleteness(set.id);
      return reply.code(201).send(refreshed);
    }

    await prisma.project.update({
      where: { id: body.projectId },
      data: { status: "WORLD_BUILDING" },
    });
    return reply.code(201).send({ set, readiness: null });
  });

  app.get("/api/studio-set", async (req, reply) => {
    const q = req.query as { projectId?: string; id?: string };
    if (q.id) {
      const refreshed = await refreshCompleteness(q.id);
      if (!refreshed) return reply.code(404).send({ error: "Studio Set not found" });
      return reply.send(refreshed);
    }
    if (!q.projectId) return reply.code(400).send({ error: "projectId or id required" });
    const set = await prisma.studioSet.findFirst({
      where: { projectId: q.projectId },
      orderBy: { createdAt: "desc" },
      include: { rooms: true, artists: true, imagery: true },
    });
    if (!set) return reply.code(404).send({ error: "No Studio Set for project" });
    const refreshed = await refreshCompleteness(set.id);
    return reply.send(refreshed);
  });

  app.get("/api/studio-set/:id/readiness", async (req, reply) => {
    const { id } = req.params as { id: string };
    const refreshed = await refreshCompleteness(id);
    if (!refreshed) return reply.code(404).send({ error: "Studio Set not found" });
    return reply.send(refreshed.readiness);
  });

  app.get("/api/studio-set/packs", async (_req, reply) => {
    return reply.send({
      packs: [
        {
          id: COURTROOM_DRAMA_PACK.id,
          name: COURTROOM_DRAMA_PACK.name,
          locationKind: COURTROOM_DRAMA_PACK.locationKind,
          stylePreset: COURTROOM_DRAMA_PACK.stylePreset,
          requiredAngles: COURTROOM_DRAMA_PACK.requiredAngles,
          angles: COURTROOM_DRAMA_PACK.angles,
          defaultCast: COURTROOM_DRAMA_PACK.defaultCast,
          guideTips: COURTROOM_DRAMA_PACK.guideTips,
        },
      ],
    });
  });

  app.post("/api/studio-set/rooms", async (req, reply) => {
    const body = (req.body || {}) as {
      studioSetId?: string;
      name?: string;
      locationKind?: string;
      requiredAngles?: string[];
      promptDna?: string;
      lightingNotes?: string;
      lut?: string;
      plates?: PlateMap;
      seedPackId?: string;
    };
    if (!body.studioSetId || !body.name) {
      return reply.code(400).send({ error: "studioSetId and name required" });
    }
    const room = await prisma.sceneSet.create({
      data: {
        studioSetId: body.studioSetId,
        name: body.name,
        locationKind: body.locationKind || "generic",
        requiredAngles: body.requiredAngles || CORE_SET_ANGLES,
        platesJson: body.plates || {},
        promptDna: body.promptDna,
        lightingNotes: body.lightingNotes,
        lut: body.lut,
        seedPackId: body.seedPackId,
      },
    });
    const refreshed = await refreshCompleteness(body.studioSetId);
    return reply.code(201).send({ room, ...refreshed });
  });

  app.patch("/api/studio-set/rooms/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as {
      name?: string;
      plates?: PlateMap;
      promptDna?: string;
      lightingNotes?: string;
      lut?: string;
      locked?: boolean;
      requiredAngles?: string[];
    };
    const existing = await prisma.sceneSet.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "SceneSet not found" });
    const plates = body.plates
      ? { ...asPlates(existing.platesJson), ...body.plates }
      : asPlates(existing.platesJson);
    const room = await prisma.sceneSet.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        platesJson: plates,
        promptDna: body.promptDna ?? existing.promptDna,
        lightingNotes: body.lightingNotes ?? existing.lightingNotes,
        lut: body.lut ?? existing.lut,
        locked: body.locked ?? existing.locked,
        requiredAngles: body.requiredAngles ?? existing.requiredAngles,
      },
    });
    const refreshed = await refreshCompleteness(existing.studioSetId);
    return reply.send({ room, ...refreshed });
  });

  /** Generate plates for a room from prompt DNA (mock keys + optional SVG placeholders) */
  app.post("/api/studio-set/rooms/:id/generate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { prompt?: string; angles?: string[] };
    const room = await prisma.sceneSet.findUnique({ where: { id } });
    if (!room) return reply.code(404).send({ error: "SceneSet not found" });

    const prompt = (body.prompt || room.promptDna || "").trim();
    if (!prompt) return reply.code(400).send({ error: "prompt required" });

    const angles = (body.angles || room.requiredAngles || CORE_SET_ANGLES) as string[];
    const plates = { ...asPlates(room.platesJson) };
    for (const angle of angles) {
      const key = mockPlateKey("room", id, angle, `${prompt}:${angle}`);
      plates[angle] = await tryUploadPlaceholder(key, `${room.name} · ${angle}`);
    }

    const updated = await prisma.sceneSet.update({
      where: { id },
      data: {
        platesJson: plates,
        promptDna: prompt,
        locked: true,
      },
    });
    const refreshed = await refreshCompleteness(room.studioSetId);
    return reply.send({ room: updated, ...refreshed });
  });

  /** Import artist from image URL, video URL, or manual plate map */
  app.post("/api/studio-set/artists/import", async (req, reply) => {
    const body = (req.body || {}) as {
      studioSetId?: string;
      name?: string;
      role?: string;
      source?: "upload" | "image_url" | "video_url" | "manual" | "seed";
      url?: string;
      wardrobeNotes?: string;
      bodyNotes?: string;
      plates?: PlateMap;
      projectId?: string;
    };
    if (!body.studioSetId || !body.name) {
      return reply.code(400).send({ error: "studioSetId and name required" });
    }
    const set = await prisma.studioSet.findUnique({ where: { id: body.studioSetId } });
    if (!set) return reply.code(404).send({ error: "Studio Set not found" });

    const source = body.source || (body.url ? "image_url" : "manual");
    const plates: PlateMap = { ...(body.plates || {}) };

    if (body.url && (source === "image_url" || source === "video_url")) {
      // Soft-launch: stamp angle keys from URL so Director can reference identity source
      for (const angle of CORE_ARTIST_ANGLES) {
        if (!plates[angle]) {
          const key = mockPlateKey("artist", randomUUID(), angle, body.url);
          plates[angle] = `${body.url}#${angle}`;
          await prisma.asset.create({
            data: {
              projectId: set.projectId,
              type: "artistPlate",
              key,
              url: body.url,
              labels: [body.name, angle, source],
              meta: { importUrl: body.url, angle, artist: body.name },
            },
          });
        }
      }

      if (source === "video_url") {
        try {
          const { startReferenceVideoFetch } = await import("../lib/reference-from-url.js");
          await startReferenceVideoFetch({
            url: body.url,
            projectId: set.projectId,
            analyze: true,
            log: app.log,
          });
        } catch (e) {
          app.log.warn({ err: e }, "Artist video import — reference fetch deferred");
        }
      }
    }

    const soulAngles = soulAnglesFromPlateMap(plates);
    const soul = await prisma.soulIdentity.create({
      data: {
        projectId: set.projectId,
        name: body.name,
        faceHash: `artist_${createHash("sha1").update(`${body.name}:${body.url || Date.now()}`).digest("hex").slice(0, 10)}`,
        frontKey: soulAngles.front,
        leftKey: soulAngles.left,
        rightKey: soulAngles.right,
        threeQKey: soulAngles.threeQuarter,
        locked: Boolean(soulAngles.front),
      },
    });

    const artist = await prisma.artistProfile.create({
      data: {
        studioSetId: body.studioSetId,
        soulId: soul.id,
        name: body.name,
        role: body.role || "lead",
        wardrobeNotes: body.wardrobeNotes,
        bodyNotes: body.bodyNotes,
        requiredAngles: CORE_ARTIST_ANGLES,
        platesJson: plates,
        importSource: source,
        importUrl: body.url,
        locked: CORE_ARTIST_ANGLES.every((a) => Boolean(plates[a])),
      },
    });

    const refreshed = await refreshCompleteness(body.studioSetId);
    return reply.code(201).send({ artist, soul, ...refreshed });
  });

  app.patch("/api/studio-set/artists/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as {
      name?: string;
      role?: string;
      plates?: PlateMap;
      wardrobeNotes?: string;
      bodyNotes?: string;
      locked?: boolean;
    };
    const existing = await prisma.artistProfile.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Artist not found" });
    const plates = body.plates
      ? { ...asPlates(existing.platesJson), ...body.plates }
      : asPlates(existing.platesJson);
    const artist = await prisma.artistProfile.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        role: body.role ?? existing.role,
        platesJson: plates,
        wardrobeNotes: body.wardrobeNotes ?? existing.wardrobeNotes,
        bodyNotes: body.bodyNotes ?? existing.bodyNotes,
        locked: body.locked ?? existing.locked,
      },
    });
    if (existing.soulId && body.plates) {
      const angles = soulAnglesFromPlateMap(plates);
      await prisma.soulIdentity.update({
        where: { id: existing.soulId },
        data: {
          frontKey: angles.front,
          leftKey: angles.left,
          rightKey: angles.right,
          threeQKey: angles.threeQuarter,
          locked: Boolean(angles.front),
        },
      });
    }
    const refreshed = await refreshCompleteness(existing.studioSetId);
    return reply.send({ artist, ...refreshed });
  });

  app.post("/api/studio-set/imagery", async (req, reply) => {
    const body = (req.body || {}) as {
      studioSetId?: string;
      name?: string;
      stylePreset?: string;
      aesthetic?: string;
      prompt?: string;
      customizedPrompt?: string;
      sceneSetId?: string;
      lut?: string;
      mood?: string[];
    };
    if (!body.studioSetId || !body.prompt) {
      return reply.code(400).send({ error: "studioSetId and prompt required" });
    }
    const pack = await prisma.imageryPack.create({
      data: {
        studioSetId: body.studioSetId,
        name: body.name || "Imagery Pack",
        stylePreset: body.stylePreset || "STORM Signature",
        aesthetic: body.aesthetic,
        prompt: body.prompt,
        customizedPrompt: body.customizedPrompt || body.prompt,
        sceneSetId: body.sceneSetId,
        lut: body.lut,
        mood: body.mood || [],
        locked: true,
      },
    });

    // If bound to a scene set, regenerate plates with customized prompt
    if (body.sceneSetId) {
      const room = await prisma.sceneSet.findUnique({ where: { id: body.sceneSetId } });
      if (room) {
        const prompt = body.customizedPrompt || body.prompt;
        const plates = { ...asPlates(room.platesJson) };
        for (const angle of room.requiredAngles) {
          const key = mockPlateKey("room", room.id, angle, `${prompt}:${angle}`);
          plates[angle] = await tryUploadPlaceholder(key, `${room.name} · ${angle}`);
        }
        await prisma.sceneSet.update({
          where: { id: room.id },
          data: { platesJson: plates, promptDna: prompt, locked: true },
        });
      }
    }

    const refreshed = await refreshCompleteness(body.studioSetId);
    return reply.code(201).send({ pack, ...refreshed });
  });

  /** Bind Studio Set into Soul + RoomPlate + Blueprint meta for Director */
  app.post("/api/studio-set/:id/apply-to-director", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { force?: boolean; blueprintId?: string };
    const refreshed = await refreshCompleteness(id);
    if (!refreshed) return reply.code(404).send({ error: "Studio Set not found" });
    const { set, readiness } = refreshed;

    if (!readiness.ready && !readiness.softLaunchPartial && !body.force) {
      return reply.code(409).send({
        error: "Studio Set not ready — lock required angles first",
        readiness,
      });
    }

    const syncedRooms = [];
    for (const room of set.rooms) {
      const plates = asPlates(room.platesJson);
      const mapped = roomPlatesFromAngleMap(plates);
      const roomPlate = await prisma.roomPlate.create({
        data: {
          projectId: set.projectId,
          name: room.name,
          wideKey: mapped.wide,
          mediumKey: mapped.medium,
          oshKey: mapped.overShoulder,
          closeKey: mapped.close,
          lut: room.lut,
          lightingLocked: true,
        },
      });
      await prisma.sceneSet.update({
        where: { id: room.id },
        data: { roomPlateId: roomPlate.id, locked: true },
      });
      syncedRooms.push(roomPlate);
    }

    // Ensure souls exist for artists missing soulId
    for (const artist of set.artists) {
      if (artist.soulId) continue;
      const plates = asPlates(artist.platesJson);
      const angles = soulAnglesFromPlateMap(plates);
      const soul = await prisma.soulIdentity.create({
        data: {
          projectId: set.projectId,
          name: artist.name,
          faceHash: `artist_${artist.id.slice(0, 8)}`,
          frontKey: angles.front,
          leftKey: angles.left,
          rightKey: angles.right,
          threeQKey: angles.threeQuarter,
          locked: true,
        },
      });
      await prisma.artistProfile.update({
        where: { id: artist.id },
        data: { soulId: soul.id, locked: true },
      });
    }

    const studioMeta = {
      studioSetId: set.id,
      completenessPct: readiness.pct,
      rooms: set.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        plates: asPlates(r.platesJson),
        promptDna: r.promptDna,
      })),
      artists: set.artists.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        soulId: a.soulId,
        plates: asPlates(a.platesJson),
      })),
      imagery: set.imagery.map((i) => ({
        id: i.id,
        name: i.name,
        prompt: i.customizedPrompt || i.prompt,
        stylePreset: i.stylePreset,
      })),
      appliedAt: new Date().toISOString(),
    };

    let blueprint = body.blueprintId
      ? await prisma.blueprint.findUnique({ where: { id: body.blueprintId } })
      : await prisma.blueprint.findFirst({
          where: { projectId: set.projectId },
          orderBy: { createdAt: "desc" },
        });

    if (blueprint) {
      const worldBible = (blueprint.worldBible as Record<string, unknown>) || {};
      blueprint = await prisma.blueprint.update({
        where: { id: blueprint.id },
        data: {
          projectId: set.projectId,
          worldBible: { ...worldBible, studioSet: studioMeta },
          status: blueprint.status === "draft" ? "ready" : blueprint.status,
        },
      });
    } else {
      blueprint = await prisma.blueprint.create({
        data: {
          projectId: set.projectId,
          status: "ready",
          worldBible: { studioSet: studioMeta },
          sceneMap: set.rooms.map((r, i) => ({
            index: i,
            location: r.name,
            plates: asPlates(r.platesJson),
          })),
        },
      });
    }

    await prisma.asset.create({
      data: {
        projectId: set.projectId,
        type: "studioSet",
        key: `studio-set/${set.id}/applied.json`,
        labels: ["studioSet", "applied"],
        meta: studioMeta,
      },
    });

    const applied = await prisma.studioSet.update({
      where: { id: set.id },
      data: {
        status: "applied",
        appliedAt: new Date(),
        completenessPct: readiness.pct,
        meta: studioMeta,
      },
      include: { rooms: true, artists: true, imagery: true },
    });

    await prisma.project.update({
      where: { id: set.projectId },
      data: { status: "WORLD_BUILDING" },
    });

    return reply.send({
      set: applied,
      readiness,
      rooms: syncedRooms,
      blueprint,
      message: "Studio Set applied to Director — Soul + Room plates locked",
      next: { storyboard: "/storyboard", studio: "/studio", wizard: "/wizard" },
    });
  });
}

async function seedCourtroomPack(studioSetId: string, projectId: string) {
  const pack = COURTROOM_DRAMA_PACK;
  const plates: PlateMap = {};
  for (const spec of pack.angles) {
    const key = mockPlateKey("room", studioSetId, spec.angle, spec.prompt);
    plates[spec.angle] = await tryUploadPlaceholder(key, `${pack.name} · ${spec.label}`);
  }

  const room = await prisma.sceneSet.create({
    data: {
      studioSetId,
      name: pack.name,
      locationKind: pack.locationKind,
      requiredAngles: [...pack.requiredAngles],
      platesJson: plates,
      promptDna: pack.basePrompt,
      lightingNotes: pack.aesthetic,
      lut: pack.lut,
      locked: true,
      seedPackId: pack.id,
    },
  });

  await prisma.imageryPack.create({
    data: {
      studioSetId,
      name: `${pack.name} Imagery`,
      stylePreset: pack.stylePreset,
      aesthetic: pack.aesthetic,
      prompt: pack.basePrompt,
      customizedPrompt: pack.basePrompt,
      sceneSetId: room.id,
      lut: pack.lut,
      mood: [...pack.mood],
      locked: true,
    },
  });

  for (const cast of pack.defaultCast) {
    const artistPlates: PlateMap = {};
    for (const angle of CORE_ARTIST_ANGLES) {
      const key = mockPlateKey("artist", `${studioSetId}_${cast.role}`, angle, cast.name);
      artistPlates[angle] = await tryUploadPlaceholder(key, `${cast.name} · ${angle}`);
    }
    const soul = await prisma.soulIdentity.create({
      data: {
        projectId,
        name: cast.name,
        faceHash: `court_${cast.role}_${createHash("sha1").update(cast.name).digest("hex").slice(0, 8)}`,
        frontKey: artistPlates.front,
        leftKey: artistPlates.left,
        rightKey: artistPlates.right,
        threeQKey: artistPlates.threeQuarter,
        locked: true,
      },
    });
    await prisma.artistProfile.create({
      data: {
        studioSetId,
        soulId: soul.id,
        name: cast.name,
        role: cast.role,
        requiredAngles: CORE_ARTIST_ANGLES,
        platesJson: artistPlates,
        importSource: "seed",
        locked: true,
      },
    });
  }

  await prisma.studioSet.update({
    where: { id: studioSetId },
    data: {
      seedPackId: pack.id,
      title: pack.name,
      status: "building",
      meta: { guideTips: pack.guideTips, angles: pack.angles },
    },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "WORLD_BUILDING" },
  });
}
