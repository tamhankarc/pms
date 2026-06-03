import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PurchaseOrderForm } from "@/components/forms/purchase-order-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { updatePurchaseOrderAction } from "@/lib/actions/purchase-order-actions";
import { db } from "@/lib/db";
import { canManagePurchaseOrders } from "@/lib/permissions";

type AssignmentMode =
  | "TITLE"
  | "TITLE_BILLING_REPORT"
  | "TITLE_PROJECT"
  | "PROJECT"
  | "BILLING_REPORT";

type PurchaseOrderTitleOption = {
  id: string;
  title: string;
  clientId: string;
  client: {
    name: string;
  };
};

type PurchaseOrderProjectOption = {
  id: string;
  name: string;
  clientId: string;
  client: {
    name: string;
  };
  newsletters: {
    newsletterType: string | null;
  }[];
};

type PurchaseOrderAssignmentItem = {
  movieId: string | null;
};

function toFormAssignmentMode(value?: string | null): AssignmentMode {
  if (
    value === "TITLE_BILLING_REPORT" ||
    value === "TITLE_PROJECT" ||
    value === "PROJECT" ||
    value === "BILLING_REPORT"
  ) {
    return value;
  }

  return "TITLE";
}

function dateInput(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();

  if (!canManagePurchaseOrders(user)) {
    redirect("/dashboard");
  }

  const { id } = await params;

  const [clients, movies, projects, po] = await Promise.all([
    db.client.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        poAssignmentMode: true,
        showMoviesInEntries: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.movie.findMany({
      where: {
        isActive: true,
      },
      include: {
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        {
          client: {
            name: "asc",
          },
        },
        {
          title: "asc",
        },
      ],
    }),
    db.project.findMany({
      where: {
        isActive: true,
      },
      include: {
        client: {
          select: {
            name: true,
          },
        },
        newsletters: {
          select: {
            newsletterType: true,
          },
          take: 1,
        },
      },
      orderBy: [
        {
          client: {
            name: "asc",
          },
        },
        {
          name: "asc",
        },
      ],
    }),
    db.purchaseOrder.findUnique({
      where: {
        id,
      },
      include: {
        assignments: true,
      },
    }),
  ]);

  if (!po) {
    notFound();
  }

  const assignment = po.assignments[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Purchase Order · ${po.poNumber}`}
        description="Update PO details and assignment."
        actions={
          <Link href="/purchase-orders" className="btn-secondary">
            Back to Purchase Orders
          </Link>
        }
      />

      <div className="max-w-4xl">
        <PurchaseOrderForm
          clients={clients}
          titles={movies.map((movie: PurchaseOrderTitleOption) => ({
            id: movie.id,
            title: movie.title,
            clientId: movie.clientId,
            clientName: movie.client.name,
          }))}
          projects={projects.map((project: PurchaseOrderProjectOption) => ({
            id: project.id,
            name: project.name,
            clientId: project.clientId,
            clientName: project.client.name,
            newsletterType: project.newsletters[0]?.newsletterType ?? null,
          }))}
          action={updatePurchaseOrderAction}
          title={`Edit Purchase Order: ${po.poNumber}`}
          submitLabel="Save changes"
          initialValues={{
            id: po.id,
            clientId: po.clientId,
            poNumber: po.poNumber,
            amount: String(po.amount ?? "0"),
            currency: po.currency,
            poDate: dateInput(po.poDate),
            validFrom: dateInput(po.validFrom),
            validTo: dateInput(po.validTo),
            status: po.status,
            documentUrl: po.documentUrl ?? "",
            notes: po.notes ?? "",
            assignmentMode: toFormAssignmentMode(assignment?.assignmentMode),
            movieIds: po.assignments
              .map((item: PurchaseOrderAssignmentItem) => item.movieId)
              .filter((value): value is string => Boolean(value)),
            projectId: assignment?.projectId ?? "",
            billingReportType: assignment?.billingReportType ?? "",
          }}
        />
      </div>
    </div>
  );
}