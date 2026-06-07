import Link from "next/link";
import { redirect } from "next/navigation";

import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { PageHeader } from "@/components/ui/page-header";
import { DeleteButton } from "@/components/ui/delete-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { requireUser } from "@/lib/auth";
import { deleteContactPersonAction } from "@/lib/actions/contact-person-actions";
import { db } from "@/lib/db";
import {
  DEFAULT_PAGE_SIZE,
  paginateItems,
  parsePageParam,
} from "@/lib/pagination";
import { canManageContactPersons } from "@/lib/permissions";

export default async function ContactPersonsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    clientId?: string;
    page?: string;
    deleteError?: string;
    deleteSuccess?: string;
  }>;
}) {
  const currentUser = await requireUser();

  if (!canManageContactPersons(currentUser)) {
    redirect("/dashboard");
  }

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const clientId = params.clientId ?? "all";
  const page = parsePageParam(params.page);
  const deleteError = params.deleteError ?? "";
  const deleteSuccess = params.deleteSuccess ?? "";

  const [clients, contactPersons] = await Promise.all([
    db.client.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.contactPerson.findMany({
      where: {
        ...(q
          ? {
              OR: [
                {
                  name: {
                    contains: q,
                  },
                },
                {
                  email: {
                    contains: q,
                  },
                },
                {
                  contactNumber: {
                    contains: q,
                  },
                },
              ],
            }
          : {}),
        ...(clientId !== "all" ? { clientId } : {}),
      },
      include: {
        client: true,
        movie: true,
        purchaseOrder: true,
        country: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const {
    items: paginatedContactPersons,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
  } = paginateItems(contactPersons, page, DEFAULT_PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Contact Persons"
        description="Create and maintain client contact persons."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/billing-contacts" className="btn-secondary">
              Billing Contacts
            </Link>
            <Link href="/contact-persons/new" className="btn-primary">
              Create Contact Person
            </Link>
          </div>
        }
      />

      {deleteError ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      ) : null}

      {deleteSuccess ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {deleteSuccess}
        </div>
      ) : null}

      <div className="mb-6 card p-4">
        <AutoSubmitFilterForm
          className="grid gap-3 md:grid-cols-[1fr_220px_auto]"
          method="get"
        >
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Search by name, email, or contact number"
          />
          <SearchableCombobox
            id="clientId"
            name="clientId"
            defaultValue={clientId}
            options={[
              { value: "all", label: "All clients" },
              ...clients.map((client) => ({
                value: client.id,
                label: client.name,
              })),
            ]}
            placeholder="All clients"
            searchPlaceholder="Search clients..."
            emptyLabel="No client found."
          />
        </AutoSubmitFilterForm>
      </div>

      <div className="table-wrap">
        <table className="table-base">
          <thead className="table-head">
            <tr>
              <th className="table-cell">Name</th>
              <th className="table-cell">Email</th>
              <th className="table-cell">Contact Number</th>
              <th className="table-cell">Country</th>
              <th className="table-cell">Client</th>
              <th className="table-cell">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedContactPersons.map((person) => (
              <tr key={person.id}>
                <td className="table-cell">
                  <div className="font-medium text-slate-900">
                    {person.name}
                  </div>
                </td>
                <td className="table-cell">{person.email}</td>
                <td className="table-cell">{person.contactNumber || "—"}</td>
                <td className="table-cell">
                  {person.country?.isoCode
                    ? `${person.country.name} (${person.country.isoCode})`
                    : person.country?.name || "—"}
                </td>
                <td className="table-cell">{person.client.name}</td>
                <td className="table-cell">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/contact-persons/${person.id}`}
                      className="btn-secondary text-xs"
                    >
                      Edit
                    </Link>
                    <form action={deleteContactPersonAction}>
                      <input type="hidden" name="id" value={person.id} />
                      <DeleteButton confirmMessage="Delete this contact person?" />
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {contactPersons.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="table-cell text-center text-sm text-slate-500"
                >
                  No contact persons found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <PaginationControls
          basePath="/contact-persons"
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          searchParams={{ q, clientId }}
        />
      </div>
    </div>
  );
}
