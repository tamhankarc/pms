import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { getOrCreateLeaveYearProfile } from "@/lib/ems-queries";
import { formatDateInIst, getIstDateKey } from "@/lib/ist";
import {
  formatFunctionalRoleLabel,
  formatUserTypeLabel,
} from "@/lib/display-labels";

export type UserProfileExportFormat = "xlsx" | "pdf";

type ExportRow = Array<string | number>;

const headers = [
  "Full Name",
  "Username",
  "Email",
  "Employee Code",
  "Designation",
  "Joining Date",
  "Phone Number",
  "Secondary Phone Number",
  "Status",
  "Shift",
  "Employment Status",
  "Casual Leaves Remaining",
  "Earned Leaves Remaining",
  "Current Address",
  "Current City",
  "Current State",
  "Current Country",
  "Current Postal Code",
  "Permanent Address",
  "Permanent City",
  "Permanent State",
  "Permanent Country",
  "Permanent Postal Code",
];

function normalizeAddress(line?: string | null, address?: string | null) {
  return [line, address].filter(Boolean).join(", ") || "—";
}

export async function getUserProfileExportRows() {
  const year = Number(getIstDateKey().slice(0, 4));
  const users = await db.user.findMany({
    where: {
      userType: { in: ["MANAGER", "TEAM_LEAD", "EMPLOYEE"] },
      OR: [
        { functionalRole: null },
        { functionalRole: { not: "GENERAL_MANAGER" } },
      ],
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      employeeCode: true,
      designation: true,
      joiningDate: true,
      phoneNumber: true,
      secondaryPhoneNumber: true,
      isActive: true,
      currentAddress: true,
      currentAddressLine: true,
      currentCity: true,
      currentState: true,
      currentCountry: true,
      currentPostalCode: true,
      permanentAddress: true,
      permanentAddressLine: true,
      permanentCity: true,
      permanentState: true,
      permanentCountry: true,
      permanentPostalCode: true,
    },
    orderBy: [{ userType: "asc" }, { fullName: "asc" }],
  });

  const rows: ExportRow[] = await Promise.all(
    users.map(async (user) => {
      const profile = await getOrCreateLeaveYearProfile(user.id, year);
      return [
        user.fullName,
        user.username,
        user.email,
        user.employeeCode || "—",
        user.designation || "—",
        user.joiningDate ? formatDateInIst(user.joiningDate) : "—",
        user.phoneNumber || "—",
        user.secondaryPhoneNumber || "—",
        user.isActive ? "Active" : "Inactive",
        profile.shift,
        profile.employmentStatus.replaceAll("_", " "),
        Number(profile.casualLeaves),
        Number(profile.earnedLeaves),
        normalizeAddress(user.currentAddressLine, user.currentAddress),
        user.currentCity || "—",
        user.currentState || "—",
        user.currentCountry || "—",
        user.currentPostalCode || "—",
        normalizeAddress(user.permanentAddressLine, user.permanentAddress),
        user.permanentCity || "—",
        user.permanentState || "—",
        user.permanentCountry || "—",
        user.permanentPostalCode || "—",
      ];
    }),
  );

  return { year, headers, rows };
}

export async function buildUserProfileWorkbook() {
  const data = await getUserProfileExportRows();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS";
  const sheet = workbook.addWorksheet("User Profiles");
  sheet.addRow(["User Profile & Shift Details"]);
  sheet.addRow(["Leave Year", data.year]);
  sheet.addRow([]);
  sheet.addRow(data.headers);
  data.rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.getRow(4).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.columns.forEach((column) => {
    column.width = Math.min(Math.max(column.width ?? 14, 14), 45);
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function escapePdfText(value: string | number) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^\x20-\x7E]/g, "-");
}

export async function buildUserProfilePdf() {
  const data = await getUserProfileExportRows();
  const lines = [
    "User Profile & Shift Details",
    `Leave Year: ${data.year}`,
    "",
    data.headers.join(" | "),
    ...data.rows.map((row) => row.map(String).join(" | ")),
  ];
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 42) {
    pages.push(lines.slice(index, index + 42));
  }

  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3;
  let nextId = 4;
  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 6 Tf",
      "24 805 Td",
      ...pageLines.flatMap((line, index) =>
        index === 0
          ? [`(${escapePdfText(line.slice(0, 210))}) Tj`]
          : ["0 -14 Td", `(${escapePdfText(line.slice(0, 210))}) Tj`],
      ),
      "ET",
    ].join("\n");
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    objects[contentId] =
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
  }
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = Buffer.byteLength(pdf);
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

export function getUserProfileExportFileName(format: UserProfileExportFormat) {
  return `user_profile_shift_details_${getIstDateKey()}.${format}`;
}
