import Link from "next/link";
import { redirect } from "next/navigation";

import { PurchaseOrderForm } from "@/components/forms/purchase-order-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth";
import { createPurchaseOrderAction } from "@/lib/actions/purchase-order-actions";
import { db } from "@/lib/db";
import { canManagePurchaseOrders } from "@/lib/permissions";

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

export default async function NewPurchaseOrderPage() {
  const user = await requireUser();

  if (!canManagePurchaseOrders(user)) {
    redirect("/dashboard");
  }

  const [clients, movies, projects] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Purchase Order"
        description="Create a PO and assign it using the selected client rule."
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
          action={createPurchaseOrderAction}
          title="Create Purchase Order"
          submitLabel="Create Purchase Order"
        />
      </div>
    </div>
  );
}