import { getSession } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import {
  buildUserProfilePdf,
  buildUserProfileWorkbook,
  getUserProfileExportFileName,
} from "@/lib/user-profile-export";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canManageUsers(user)) return new Response("Forbidden", { status: 403 });

  try {
    const params = new URL(request.url).searchParams;
    const format = params.get("format") === "pdf" ? "pdf" : "xlsx";
    if (format === "pdf") {
      return new Response(await buildUserProfilePdf(), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${getUserProfileExportFileName("pdf")}"`,
        },
      });
    }
    return new Response(await buildUserProfileWorkbook(), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${getUserProfileExportFileName("xlsx")}"`,
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error
        ? error.message
        : "Unable to generate user export.",
      { status: 400 },
    );
  }
}
