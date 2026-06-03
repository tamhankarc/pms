import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseOrderForm } from "@/components/forms/purchase-order-form";
import { createPurchaseOrderAction } from "@/lib/actions/purchase-order-actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManagePurchaseOrders } from "@/lib/permissions";

export default async function NewPurchaseOrderPage() {
  const user = await requireUser();
  if (!canManagePurchaseOrders(user)) redirect("/dashboard");
  const [clients, movies, projects] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, select: { id: true, name: true, poAssignmentMode: true }, orderBy: { name: "asc" } }),
    db.movie.findMany({ where: { isActive: true }, include: { client: { select: { name: true } } }, orderBy: [{ client: { name: "asc" } }, { title: "asc" }] }),
    db.project.findMany({ where: { isActive: true }, include: { client: { select: { name: true } } }, orderBy: [{ client: { name: "asc" } }, { name: "asc" }] }),
  ]);
  return <div className="space-y-6"><PageHeader title="Create Purchase Order" description="Create a PO and assign it using the selected client rule." actions={<Link href="/purchase-orders" className="btn-secondary">Back to Purchase Orders</Link>} /><div className="max-w-4xl"><PurchaseOrderForm clients={clients} titles={movies.map((movie) => ({ id: movie.id, title: movie.title, clientId: movie.clientId, clientName: movie.client.name }))} projects={projects.map((project) => ({ id: project.id, name: project.name, clientId: project.clientId, clientName: project.client.name }))} action={createPurchaseOrderAction} title="Create Purchase Order" submitLabel="Create Purchase Order" /></div></div>;
}
