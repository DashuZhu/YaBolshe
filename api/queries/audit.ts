import { getDb } from "./connection";
import { auditLogs } from "@db/schema";

export async function logAudit(
  actorId: number | null,
  actorName: string,
  action: string,
  entityType: string,
  entityId: string,
  meta?: unknown,
): Promise<void> {
  try {
    await getDb().insert(auditLogs).values({
      actorId,
      actorName,
      action,
      entityType,
      entityId,
      metaJson: meta === undefined ? null : (meta as object),
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
