"use client";

import { useActionState, useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import type { ContactPersonFormState } from "@/lib/actions/contact-person-actions";

const initialState: ContactPersonFormState = {};
type Client = { id: string; name: string };
type Title = { id: string; title: string; clientId: string; clientName?: string };
type PurchaseOrder = { id: string; poNumber: string; clientId: string; clientName?: string };
type AssignmentMode = "movie" | "purchaseOrder";

export function ContactPersonForm({ clients, movies, purchaseOrders, action, initialValues, submitLabel, title }: {
  clients: Client[];
  movies: Title[];
  purchaseOrders: PurchaseOrder[];
  action: (state: ContactPersonFormState, formData: FormData) => Promise<ContactPersonFormState>;
  initialValues?: { id?: string; clientId: string; movieId: string | null; purchaseOrderId: string | null; name: string; email: string; contactNumber: string | null; };
  submitLabel: string;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialMode: AssignmentMode = initialValues?.purchaseOrderId ? "purchaseOrder" : "movie";
  const [selectedClientId, setSelectedClientId] = useState(initialValues?.clientId ?? "");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>(initialMode);
  const [selectedMovieId, setSelectedMovieId] = useState(initialValues?.movieId ?? "");
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState(initialValues?.purchaseOrderId ?? "");

  const clientOptions = useMemo(() => clients.map((client) => ({ value: client.id, label: client.name })), [clients]);
  const movieOptions = useMemo(() => movies.filter((movie) => !selectedClientId || movie.clientId === selectedClientId).map((movie) => ({ value: movie.id, label: movie.title, keywords: movie.clientName ?? "" })), [movies, selectedClientId]);
  const purchaseOrderOptions = useMemo(() => purchaseOrders.filter((po) => !selectedClientId || po.clientId === selectedClientId).map((po) => ({ value: po.id, label: po.poNumber, keywords: po.clientName ?? "" })), [purchaseOrders, selectedClientId]);

  function handleClientChange(nextClientId: string) {
    setSelectedClientId(nextClientId);
    const currentTitle = movies.find((movie) => movie.id === selectedMovieId);
    const currentPo = purchaseOrders.find((po) => po.id === selectedPurchaseOrderId);
    if (!currentTitle || currentTitle.clientId !== nextClientId) setSelectedMovieId("");
    if (!currentPo || currentPo.clientId !== nextClientId) setSelectedPurchaseOrderId("");
  }

  function handleModeChange(nextMode: AssignmentMode) {
    setAssignmentMode(nextMode);
    if (nextMode === "movie") setSelectedPurchaseOrderId("");
    if (nextMode === "purchaseOrder") setSelectedMovieId("");
  }

  return (
    <form action={formAction} className="card p-6">
      {initialValues?.id ? <input type="hidden" name="id" value={initialValues.id} /> : null}
      <input type="hidden" name="clientId" value={selectedClientId} />
      <input type="hidden" name="assignmentMode" value={assignmentMode} />
      <input type="hidden" name="movieId" value={assignmentMode === "movie" ? selectedMovieId : ""} />
      <input type="hidden" name="purchaseOrderId" value={assignmentMode === "purchaseOrder" ? selectedPurchaseOrderId : ""} />

      <h2 className="section-title">{title}</h2>
      <p className="section-subtitle">Fields marked <span className="text-red-600">*</span> are required. Contact Persons can be assigned to a Title or a Purchase Order (PO).</p>
      {state?.error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div> : null}
      {state?.success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Contact Person saved successfully.</div> : null}

      <div className="mt-5 space-y-4">
        <div><FormLabel htmlFor="clientId" required>Client</FormLabel><SearchableCombobox id="clientId" options={clientOptions} value={selectedClientId} onValueChange={handleClientChange} placeholder="Select client" searchPlaceholder="Search clients..." emptyLabel="No client found." /></div>
        <div><FormLabel htmlFor="assignmentMode" required>Assign Contact Person</FormLabel><div className="grid gap-3 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${assignmentMode === "movie" ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700"}`}><input type="radio" className="h-4 w-4" checked={assignmentMode === "movie"} onChange={() => handleModeChange("movie")} /><span className="font-medium">By Title</span></label>
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${assignmentMode === "purchaseOrder" ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700"}`}><input type="radio" className="h-4 w-4" checked={assignmentMode === "purchaseOrder"} onChange={() => handleModeChange("purchaseOrder")} /><span className="font-medium">By Purchase Order (PO)</span></label>
        </div></div>
        {assignmentMode === "movie" ? <div><FormLabel htmlFor="movieId" required>Title</FormLabel><SearchableCombobox id="movieId" options={movieOptions} value={selectedMovieId} onValueChange={setSelectedMovieId} placeholder={selectedClientId ? "Select title" : "Select client first"} searchPlaceholder="Search titles..." emptyLabel="No title found." disabled={!selectedClientId} /></div> : <div><FormLabel htmlFor="purchaseOrderId" required>Purchase Order (PO)</FormLabel><SearchableCombobox id="purchaseOrderId" options={purchaseOrderOptions} value={selectedPurchaseOrderId} onValueChange={setSelectedPurchaseOrderId} placeholder={selectedClientId ? "Select PO" : "Select client first"} searchPlaceholder="Search POs..." emptyLabel="No PO found." disabled={!selectedClientId} /></div>}
        <div><FormLabel htmlFor="name" required>Name</FormLabel><input id="name" name="name" className="input" defaultValue={initialValues?.name ?? ""} required /></div>
        <div><FormLabel htmlFor="email" required>Email</FormLabel><input id="email" name="email" type="email" className="input" defaultValue={initialValues?.email ?? ""} required /></div>
        <div><FormLabel htmlFor="contactNumber">Contact Number</FormLabel><input id="contactNumber" name="contactNumber" className="input" defaultValue={initialValues?.contactNumber ?? ""} /></div>
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </form>
  );
}
