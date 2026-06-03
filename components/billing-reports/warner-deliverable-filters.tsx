"use client";


import { AutoSubmitFilterForm } from "@/components/forms/auto-submit-filter-form";
import { useEffect, useRef, useState } from "react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type Option = {
  value: string;
  label: string;
};

type Props = {
  clientId: string;
  reportType: string;
  movieId: string;
  countryId: string;
  movieOptions: Option[];
  countryOptions: Option[];
  hasCountryFilter: boolean;
  movieEmptyLabel: string;
};

export function WarnerDeliverableFiltersClient({
  clientId,
  reportType,
  movieId,
  countryId,
  movieOptions,
  countryOptions,
  hasCountryFilter,
  movieEmptyLabel,
}: Props) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const countryInputRef = useRef<HTMLInputElement | null>(null);
  const shouldSubmitAfterTitleChangeRef = useRef(false);
  const [selectedMovieId, setSelectedMovieId] = useState(movieId);
  const [selectedCountryId, setSelectedCountryId] = useState(countryId);

  useEffect(() => {
    setSelectedMovieId(movieId);
  }, [movieId]);

  useEffect(() => {
    setSelectedCountryId(countryId);
  }, [countryId]);

  useEffect(() => {
    if (!shouldSubmitAfterTitleChangeRef.current) return;
    shouldSubmitAfterTitleChangeRef.current = false;
    formRef.current?.requestSubmit();
  }, [selectedMovieId]);

  function handleTitleChange(nextTitleId: string) {
    setSelectedMovieId(nextTitleId);
    setSelectedCountryId("");
    if (countryInputRef.current) {
      countryInputRef.current.value = "";
    }
    shouldSubmitAfterTitleChangeRef.current = true;
  }

  function handleCountryChange(nextCountryId: string) {
    setSelectedCountryId(nextCountryId);
  }

  const countryDisabled = hasCountryFilter && (!selectedMovieId || selectedMovieId === "all");

  return (
    <AutoSubmitFilterForm ref={formRef} method="get" action={`/billing-reports/${clientId}`} className="card p-5">
      <input type="hidden" name="report" value={reportType} />
      <div className={hasCountryFilter ? "grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" : "grid gap-4 md:grid-cols-[1fr_auto] md:items-end"}>
        <div>
          <label className="label" htmlFor="movieId">Title</label>
          <SearchableCombobox
            id="movieId"
            name="movieId"
            value={selectedMovieId}
            onValueChange={handleTitleChange}
            options={movieOptions}
            placeholder="Select title"
            searchPlaceholder="Search titles..."
            emptyLabel={movieEmptyLabel}
          />
        </div>
        {hasCountryFilter ? (
          <div>
            <label className="label" htmlFor="countryId">Country</label>
            <SearchableCombobox
              id="countryId"
              name="countryId"
              value={selectedCountryId}
              onValueChange={handleCountryChange}
              options={countryOptions}
              placeholder={countryDisabled ? "Select one title first" : "Select country"}
              searchPlaceholder="Search countries..."
              emptyLabel={countryDisabled ? "Select one title first." : "No countries found for selected title."}
              disabled={countryDisabled}
            />
            <input ref={countryInputRef} type="hidden" aria-hidden="true" tabIndex={-1} value={selectedCountryId} readOnly className="hidden" />
          </div>
        ) : null}
      </div>
    </AutoSubmitFilterForm>
  );
}
