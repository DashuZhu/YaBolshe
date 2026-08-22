import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, therapistQuery, authedQuery, clientQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  homework,
  agreements,
  roadmaps,
  therapistNotes,
  checkIns,
  clientProfiles,
  insights,
} from "@db/schema";
import {
  serializeHomework,
  serializeAgreement,
  serializeRoadmap,
  serializeNote,
  serializeCheckIn,
} from "../queries/serialize";
import { logAudit } from "../queries/audit";

async function clientProfileIdFor(userId: number): Promise<number> {
  const db = getDb();
  const p = await db.query.clientProfiles.findFirst({ where: eq(clientProfiles.userId, userId) });
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Профиль клиента не найден" });
  return p.id;
}

async function assertClientOfTherapist(therapistId: number, clientId: number) {
  const db = getDb();
  const p = await db.query.clientProfiles.findFirst({
    where: and(eq(clientProfiles.id, clientId), eq(clientProfiles.therapistId, therapistId)),
  });
  if (!p) throw new TRPCError({ code: "FORBIDDEN", message: "Это не ваш клиент" });
  return p;
}

// Resolve which client scope the caller may see; null clientId = all own clients (therapist)
async function visibleClientIds(ctxUser: { id: number; role: string }, clientId?: number) {
  if (ctxUser.role === "client") return [await clientProfileIdFor(ctxUser.id)];
  if (ctxUser.role === "therapist") {
    if (clientId) {
      await assertClientOfTherapist(ctxUser.id, clientId);
      return [clientId];
    }
    const db = getDb();
    const rows = await db
      .select({ id: clientProfiles.id })
      .from(clientProfiles)
      .where(eq(clientProfiles.therapistId, ctxUser.id));
    return rows.map((r) => r.id);
  }
  return clientId ? [clientId] : [];
}

export const homeworkRouter = createRouter({
  list: authedQuery
    .input(z.object({ clientId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const ids = await visibleClientIds(ctx.user, input.clientId);
      if (ids.length === 0) return [];
      const db = getDb();
      const rows = await db
        .select()
        .from(homework)
        .where(
          ctx.user.role === "client"
            ? and(eq(homework.clientId, ids[0]), eq(homework.approved, true))
            : ids.length === 1
              ? eq(homework.clientId, ids[0])
              : undefined,
        )
        .orderBy(desc(homework.createdAt));
      return rows.map(serializeHomework);
    }),

  create: therapistQuery
    .input(
      z.object({
        clientId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().min(1),
        purpose: z.string().default(""),
        frequency: z.string().default(""),
        dueDate: z.string().default(""),
        insightTitle: z.string().optional(),
        approved: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertClientOfTherapist(ctx.user.id, input.clientId);
      const [{ id }] = await getDb()
        .insert(homework)
        .values({
          clientId: input.clientId,
          title: input.title,
          description: input.description,
          purpose: input.purpose,
          frequency: input.frequency,
          dueDate: input.dueDate,
          insightTitle: input.insightTitle,
          approved: input.approved,
        })
        .$returningId();
      await logAudit(ctx.user.id, ctx.user.firstName, "homework.create", "homework", String(id));
      return { id };
    }),

  toggleApproval: therapistQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const row = await db.query.homework.findFirst({ where: eq(homework.id, input.id) });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await assertClientOfTherapist(ctx.user.id, row.clientId);
      await db.update(homework).set({ approved: !row.approved }).where(eq(homework.id, row.id));
      return { approved: !row.approved };
    }),

  complete: clientQuery
    .input(z.object({ id: z.number(), reflection: z.string().max(2000).default("") }))
    .mutation(async ({ ctx, input }) => {
      const profileId = await clientProfileIdFor(ctx.user.id);
      const db = getDb();
      const row = await db.query.homework.findFirst({ where: eq(homework.id, input.id) });
      if (!row || row.clientId !== profileId || !row.approved) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Задание не найдено" });
      }
      await db
        .update(homework)
        .set({ status: "done", reflection: input.reflection, completedAt: new Date() })
        .where(eq(homework.id, row.id));
      await logAudit(ctx.user.id, ctx.user.firstName, "homework.complete", "homework", String(row.id));
      return { ok: true };
    }),
});

export const agreementsRouter = createRouter({
  list: authedQuery
    .input(z.object({ clientId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const ids = await visibleClientIds(ctx.user, input.clientId);
      if (ids.length === 0) return [];
      const db = getDb();
      const rows = await db
        .select()
        .from(agreements)
        .where(
          ctx.user.role === "client"
            ? and(eq(agreements.clientId, ids[0]), eq(agreements.approved, true))
            : ids.length === 1
              ? eq(agreements.clientId, ids[0])
              : undefined,
        )
        .orderBy(desc(agreements.createdAt));
      return rows.map(serializeAgreement);
    }),

  create: therapistQuery
    .input(
      z.object({
        clientId: z.number(),
        text: z.string().min(1),
        type: z.enum(["installation", "agreement", "rule", "intention", "experiment"]),
        reviewDate: z.string().default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertClientOfTherapist(ctx.user.id, input.clientId);
      const [{ id }] = await getDb()
        .insert(agreements)
        .values({
          clientId: input.clientId,
          text: input.text,
          type: input.type,
          reviewDate: input.reviewDate,
          approved: true,
        })
        .$returningId();
      await logAudit(ctx.user.id, ctx.user.firstName, "agreement.create", "agreement", String(id));
      return { id };
    }),

  toggleApproval: therapistQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const row = await db.query.agreements.findFirst({ where: eq(agreements.id, input.id) });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await assertClientOfTherapist(ctx.user.id, row.clientId);
      await db.update(agreements).set({ approved: !row.approved }).where(eq(agreements.id, row.id));
      return { approved: !row.approved };
    }),
});

export const roadmapRouter = createRouter({
  get: authedQuery
    .input(z.object({ clientId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const ids = await visibleClientIds(ctx.user, input.clientId);
      if (ids.length === 0) return null;
      const db = getDb();
      const row = await db.query.roadmaps.findFirst({ where: eq(roadmaps.clientId, ids[0]) });
      if (!row) return null;
      const dto = serializeRoadmap(row);
      if (ctx.user.role === "client" && !row.approved) return null;
      return dto;
    }),

  upsert: therapistQuery
    .input(
      z.object({
        clientId: z.number(),
        currentFocus: z.string(),
        goals: z.array(z.object({ goal: z.string(), progress: z.number().min(0).max(100), note: z.string() })),
        stages: z.array(z.object({ title: z.string(), status: z.enum(["done", "current", "next"]) })),
        resources: z.array(z.string()),
        obstacles: z.array(z.string()),
        nextSteps: z.array(z.string()),
        experiments: z.array(z.string()),
        reviewDate: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertClientOfTherapist(ctx.user.id, input.clientId);
      const db = getDb();
      const existing = await db.query.roadmaps.findFirst({
        where: eq(roadmaps.clientId, input.clientId),
      });
      if (existing) {
        await db
          .update(roadmaps)
          .set({
            currentFocus: input.currentFocus,
            goalsJson: input.goals,
            stagesJson: input.stages,
            resourcesJson: input.resources,
            obstaclesJson: input.obstacles,
            nextStepsJson: input.nextSteps,
            experimentsJson: input.experiments,
            reviewDate: input.reviewDate,
            version: existing.version + 1,
            approved: true,
            draftPending: false,
            updatedAt: new Date(),
          })
          .where(eq(roadmaps.id, existing.id));
      } else {
        await db.insert(roadmaps).values({
          clientId: input.clientId,
          currentFocus: input.currentFocus,
          goalsJson: input.goals,
          stagesJson: input.stages,
          resourcesJson: input.resources,
          obstaclesJson: input.obstacles,
          nextStepsJson: input.nextSteps,
          experimentsJson: input.experiments,
          reviewDate: input.reviewDate,
          approved: true,
        });
      }
      await logAudit(ctx.user.id, ctx.user.firstName, "roadmap.upsert", "client", String(input.clientId));
      return { ok: true };
    }),

  approveDraft: therapistQuery
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertClientOfTherapist(ctx.user.id, input.clientId);
      await getDb()
        .update(roadmaps)
        .set({ draftPending: false, approved: true, updatedAt: new Date() })
        .where(eq(roadmaps.clientId, input.clientId));
      await logAudit(ctx.user.id, ctx.user.firstName, "roadmap.approve_draft", "client", String(input.clientId));
      return { ok: true };
    }),
});

export const notesRouter = createRouter({
  list: therapistQuery
    .input(z.object({ clientId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertClientOfTherapist(ctx.user.id, input.clientId);
      const rows = await getDb()
        .select()
        .from(therapistNotes)
        .where(
          and(eq(therapistNotes.clientId, input.clientId), eq(therapistNotes.therapistId, ctx.user.id)),
        )
        .orderBy(desc(therapistNotes.createdAt));
      return rows.map(serializeNote);
    }),

  create: therapistQuery
    .input(
      z.object({
        clientId: z.number(),
        text: z.string().min(1),
        tags: z.array(z.string()).default([]),
        useAsAiContext: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertClientOfTherapist(ctx.user.id, input.clientId);
      const [{ id }] = await getDb()
        .insert(therapistNotes)
        .values({
          therapistId: ctx.user.id,
          clientId: input.clientId,
          text: input.text,
          tagsJson: input.tags,
          useAsAiContext: input.useAsAiContext,
        })
        .$returningId();
      return { id };
    }),
});

export const checkInsRouter = createRouter({
  create: clientQuery
    .input(
      z.object({
        mood: z.number().int().min(1).max(10),
        energy: z.number().int().min(1).max(10),
        anxiety: z.number().int().min(1).max(10),
        bodyNotes: z.string().max(1000).default(""),
        request: z.string().max(1000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const profileId = await clientProfileIdFor(ctx.user.id);
      await getDb().insert(checkIns).values({
        clientId: profileId,
        mood: input.mood,
        energy: input.energy,
        anxiety: input.anxiety,
        bodyNotes: input.bodyNotes,
        request: input.request,
      });
      await logAudit(ctx.user.id, ctx.user.firstName, "checkin.create", "client", String(profileId));
      return { ok: true };
    }),

  list: authedQuery
    .input(z.object({ clientId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const ids = await visibleClientIds(ctx.user, input.clientId);
      if (ids.length === 0) return [];
      const rows = await getDb()
        .select()
        .from(checkIns)
        .where(eq(checkIns.clientId, ids[0]))
        .orderBy(checkIns.createdAt)
        .limit(60);
      return rows.map(serializeCheckIn);
    }),
});

// insights list for the client cabinet (approved only) / therapist (all)
export const insightsRouter = createRouter({
  listForClient: authedQuery.query(async ({ ctx }) => {
    const ids = await visibleClientIds(ctx.user);
    if (ids.length === 0) return [];
    const db = getDb();
    const rows = await db
      .select()
      .from(insights)
      .where(
        ctx.user.role === "client"
          ? and(eq(insights.clientId, ids[0]), eq(insights.approved, true))
          : eq(insights.clientId, ids[0]),
      )
      .orderBy(desc(insights.createdAt));
    return rows.map((i) => ({
      ...{
        id: String(i.id),
        title: i.title,
        description: i.description,
        clientAction: i.clientAction,
        confidence: i.confidence,
        evidence: (i.evidenceJson as string[] | null) ?? [],
        approved: i.approved,
      },
    }));
  }),
});
