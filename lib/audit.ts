import { db } from "@/lib/db";

export type AuditLogAction = "CREATE" | "UPDATE" | "DELETE";

type AuditPayload = {
  actorId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: AuditLogAction;
  before?: unknown;
  after?: unknown;
  description?: string | null;
};

function auditEnabled() {
  return String(process.env.ENABLE_AUDIT_LOGS ?? "false").toLowerCase() === "true";
}

function safeJson(value: unknown) {
  if (value === undefined) return null;
  return JSON.stringify(value, (_key, currentValue) => {
    if (typeof currentValue === "bigint") return currentValue.toString();
    if (currentValue instanceof Date) return currentValue.toISOString();
    if (currentValue && typeof currentValue === "object" && "toJSON" in currentValue) {
      return currentValue;
    }
    return currentValue;
  });
}

export async function recordAuditLog(payload: AuditPayload) {
  if (!auditEnabled()) return;

  try {
    await db.$executeRawUnsafe(
      "INSERT INTO AuditLog (id, actorId, entityType, entityId, actionType, description, beforeJson, afterJson, createdAt) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, NOW())",
      payload.actorId ?? null,
      payload.entityType,
      payload.entityId ?? null,
      payload.action,
      payload.description ?? null,
      safeJson(payload.before),
      safeJson(payload.after),
    );
  } catch (error) {
    console.error("Audit log write failed", error);
  }
}
