import { db } from "@/lib/db";

function makePrefix(value: string, fallback = "PRJ") {
  const cleaned = value.replace(/[^A-Za-z0-9]+/g, " ").trim();
  if (!cleaned) return fallback;
  const words = cleaned.split(/\s+/).filter(Boolean);
  const joined =
    words.length > 1
      ? words.slice(0, 3).map((word) => word[0]).join("")
      : cleaned.slice(0, 4);
  return joined.toUpperCase();
}

function getYearMonthStamp(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function generateClientCode(clientName: string) {
  const prefix = makePrefix(clientName, "CLT");
  const yyyymm = getYearMonthStamp();
  const now = new Date();

  const count = await db.client.count({
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    },
  });

  let sequence = count + 1;
  let code = `${prefix}-${yyyymm}-${String(sequence).padStart(3, "0")}`;

  while (await db.client.findUnique({ where: { code }, select: { id: true } })) {
    sequence += 1;
    code = `${prefix}-${yyyymm}-${String(sequence).padStart(3, "0")}`;
  }

  return code;
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
  const yyyymm = getYearMonthStamp(now);
  const prefix = (client.code?.trim() || makePrefix(client.name, "PRJ")).toUpperCase();

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

export async function generateMovieCode(clientId: string, movieTitle: string) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { code: true, name: true },
  });

  if (!client) {
    throw new Error("Client not found for movie code generation.");
  }

  const clientPrefix = (client.code?.trim() || makePrefix(client.name, "CLT")).toUpperCase();
  const moviePrefix = makePrefix(movieTitle, "MOV");
  const basePrefix = `${clientPrefix}-${moviePrefix}`;

  const count = await db.movie.count({
    where: { clientId },
  });

  let sequence = count + 1;
  let code = `${basePrefix}-${String(sequence).padStart(3, "0")}`;

  while (await db.movie.findUnique({ where: { code }, select: { id: true } })) {
    sequence += 1;
    code = `${basePrefix}-${String(sequence).padStart(3, "0")}`;
  }

  return code;
}
