"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BillingModel } from "@prisma/client";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type ClientOption = {
  id: string;
  name: string;
};

type ProjectOption = {
  id: string;
  name: string;
  clientId: string;
  billingModel: BillingModel;
};

const BILLING_MODEL_LABELS: Record<BillingModel, string> = {
  HOURLY: "Hourly",
  FIXED_FULL: "Fixed - Full Project",
  FIXED_MONTHLY: "Fixed - Monthly",
};

export function DashboardBillingFilters({
  billingStartDate,
  billingEndDate,
  billingClientId,
  billingProjectId,
  billingModel,
  leaveMonth,
  month,
  clientOptions,
  projectOptions,
}: {
  billingStartDate: string;
  billingEndDate: string;
  billingClientId: string;
  billingProjectId: string;
  billingModel: BillingModel | "";
  leaveMonth?: string;
  month?: string;
  clientOptions: ClientOption[];
  projectOptions: ProjectOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedClientId, setSelectedClientId] = useState(billingClientId);
  const [selectedProjectId, setSelectedProjectId] = useState(billingProjectId);
  const [selectedBillingModel, setSelectedBillingModel] = useState<BillingModel | "">(billingModel);

  const filteredProjectOptions = useMemo(() => {
    return selectedClientId
      ? projectOptions.filter((project) => project.clientId === selectedClientId)
      : projectOptions;
  }, [projectOptions, selectedClientId]);

  const filteredBillingOptions = useMemo(() => {
    const seen = new Set<BillingModel>();
    const next: Array<{ value: BillingModel; label: string }> = [];
    for (const project of filteredProjectOptions) {
      if (!seen.has(project.billingModel)) {
        seen.add(project.billingModel);
        next.push({ value: project.billingModel, label: BILLING_MODEL_LABELS[project.billingModel] });
      }
    }
    return next;
  }, [filteredProjectOptions]);

  function navigate(nextValues: {
    clientId: string;
    projectId: string;
    model: BillingModel | "";
  }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("billingStartDate", billingStartDate);
    params.set("billingEndDate", billingEndDate);
    if (nextValues.clientId) params.set("billingClientId", nextValues.clientId);
    else params.delete("billingClientId");
    if (nextValues.projectId) params.set("billingProjectId", nextValues.projectId);
    else params.delete("billingProjectId");
    if (nextValues.model) params.set("billingModel", nextValues.model);
    else params.delete("billingModel");
    params.delete("billingPage");
    if (leaveMonth) params.set("leaveMonth", leaveMonth);
    if (month) params.set("month", month);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form className="mt-5 grid gap-3 md:grid-cols-[180px_180px_1fr_1fr_220px_auto]" method="get">
      <input className="input" type="date" name="billingStartDate" defaultValue={billingStartDate} />
      <input className="input" type="date" name="billingEndDate" defaultValue={billingEndDate} />

      <SearchableCombobox
        id="billingClientId"
        name="billingClientId"
        value={selectedClientId}
        onValueChange={(value) => {
          setSelectedClientId(value);
          setSelectedProjectId("");
          setSelectedBillingModel("");
          navigate({ clientId: value, projectId: "", model: "" });
        }}
        options={[
          { value: "", label: "All clients" },
          ...clientOptions.map((client) => ({ value: client.id, label: client.name })),
        ]}
        placeholder="All clients"
        searchPlaceholder="Search clients..."
        emptyLabel="No clients found."
      />

      <SearchableCombobox
        id="billingProjectId"
        name="billingProjectId"
        value={selectedProjectId}
        onValueChange={setSelectedProjectId}
        options={[
          { value: "", label: "All projects" },
          ...filteredProjectOptions.map((project) => ({ value: project.id, label: project.name })),
        ]}
        placeholder="All projects"
        searchPlaceholder="Search projects..."
        emptyLabel="No projects found."
      />

      <SearchableCombobox
        id="billingModel"
        name="billingModel"
        value={selectedBillingModel}
        onValueChange={(value) => setSelectedBillingModel(value as BillingModel | "")}
        options={[
          { value: "", label: "All billing types" },
          ...filteredBillingOptions.map((option) => ({ value: option.value, label: option.label })),
        ]}
        placeholder="All billing types"
        searchPlaceholder="Search billing types..."
        emptyLabel="No billing type found."
      />

      {leaveMonth ? <input type="hidden" name="leaveMonth" value={leaveMonth} /> : null}
      {month ? <input type="hidden" name="month" value={month} /> : null}

      <button className="btn-secondary" type="submit">
        Apply
      </button>
    </form>
  );
}
