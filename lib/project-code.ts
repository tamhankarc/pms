import { db } from "@/lib/db";

function makePrefix(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9]+/g, " ").trim();
  if (!cleaned) return "PRJ";
  const words = cleaned.split(/\s+/).filter(Boolean);
  const joined =
    words.length > 1
      ? words.slice(0, 3).map((word) => word[0]).join("")
      : cleaned.slice(0, 4);
  return joined.toUpperCase();
}

export async function generateProjectCode(clientId: string) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { code: true, name: true },
  });

  if (!client) {
    throw new Error("Client not found for project code generation.");
  }

  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = (client.code?.trim() || makePrefix(client.name)).toUpperCase();

  const count = await db.project.count({
    where: {
      clientId,
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
  });

  let sequence = count + 1;
  let code = `${prefix}-${yyyymm}-${String(sequence).padStart(3, "0")}`;

  while (await db.project.findUnique({ where: { code }, select: { id: true } })) {
    sequence += 1;
    code = `${prefix}-${yyyymm}-${String(sequence).padStart(3, "0")}`;
  }

  return code;
}
